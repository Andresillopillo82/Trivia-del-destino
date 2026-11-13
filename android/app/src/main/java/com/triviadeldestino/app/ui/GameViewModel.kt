package com.triviadeldestino.app.ui

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.triviadeldestino.app.TriviaApp
import com.triviadeldestino.app.data.GameException
import com.triviadeldestino.app.data.Group
import com.triviadeldestino.app.data.ServerClock
import com.triviadeldestino.app.data.UserProfile
import com.triviadeldestino.app.data.friendlyMessage
import com.triviadeldestino.app.data.isPermissionDenied
import com.triviadeldestino.app.data.toGroup
import com.triviadeldestino.app.game.AnswerEvent
import com.triviadeldestino.app.game.AnswerState
import com.triviadeldestino.app.game.AvatarId
import com.triviadeldestino.app.game.ChallengeEvent
import com.triviadeldestino.app.game.ChallengeState
import com.triviadeldestino.app.game.GameConfig
import com.triviadeldestino.app.game.PlayerInfo
import com.triviadeldestino.app.game.StandingRow
import com.triviadeldestino.app.game.canSendChallenge
import com.triviadeldestino.app.game.computeStandings
import com.triviadeldestino.app.game.answersOfDay
import com.triviadeldestino.app.game.canReturnChallenge
import com.triviadeldestino.app.game.drawCard
import com.triviadeldestino.app.game.drawQuestionForCard
import com.triviadeldestino.app.game.elapsedMs
import com.triviadeldestino.app.game.eligibleTargets
import com.triviadeldestino.app.game.evaluateAnswer
import com.triviadeldestino.app.game.isExpired
import com.triviadeldestino.app.game.isSeasonOver
import com.triviadeldestino.app.game.pendingChallengesFor
import com.triviadeldestino.app.game.pickChallengeQuestion
import com.triviadeldestino.app.game.seasonDay
import com.triviadeldestino.app.game.seenQuestionIds
import com.triviadeldestino.app.game.timeoutResult
import com.triviadeldestino.app.game.unlockingAnswer
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.retryWhen
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlin.random.Random

enum class Session { Conectando, Error, Listo }

/** Estado del grupo actual. */
sealed interface GroupData {
    data object SinGrupo : GroupData
    data object Cargando : GroupData
    data class Error(val mensaje: String) : GroupData
    data class Listo(
        val group: Group,
        val players: List<PlayerInfo>,
        val answers: List<AnswerEvent>,
        val challenges: List<ChallengeEvent>,
    ) : GroupData
}

/** Todo lo que las pantallas necesitan, ya calculado (equivale al GameContext de la web). */
data class GameUiState(
    val session: Session = Session.Conectando,
    val sessionError: String? = null,
    val online: Boolean = true,
    val uid: String? = null,
    /** false mientras se carga el perfil por primera vez. */
    val profileLoaded: Boolean = false,
    val profile: UserProfile? = null,
    val groupData: GroupData = GroupData.SinGrupo,
    val day: Int = 0,
    val seasonOver: Boolean = false,
    val standings: List<StandingRow> = emptyList(),
    /** Quien creó el grupo (ve la clave de administración). */
    val isCreator: Boolean = false,
    val isPlayer: Boolean = false,
    val myRow: StandingRow? = null,
    /** Mis respuestas de hoy, en orden (0, 1, 2). */
    val myTodayAnswers: List<AnswerEvent> = emptyList(),
    /** Preguntas de reto que me toca responder: obligatorias antes de sacar otra carta. */
    val myPending: List<ChallengeEvent> = emptyList(),
    val now: Long = 0L,
) {
    val group: Group? get() = (groupData as? GroupData.Listo)?.group
    val players: List<PlayerInfo> get() = (groupData as? GroupData.Listo)?.players.orEmpty()
    val answers: List<AnswerEvent> get() = (groupData as? GroupData.Listo)?.answers.orEmpty()
    val challenges: List<ChallengeEvent> get() = (groupData as? GroupData.Listo)?.challenges.orEmpty()
    fun apodoDe(uid: String): String = players.firstOrNull { it.uid == uid }?.apodo ?: "Alguien"

    /** La carta en juego (volteada o con la pregunta abierta), o la última respondida hoy. */
    val myToday: AnswerEvent? get() = myTodayAnswers.firstOrNull { it.estado != AnswerState.cerrada } ?: myTodayAnswers.lastOrNull()

    /** ¿Puede sacar la siguiente carta? Quedan cartas, la anterior está respondida y no debe retos. */
    val puedeSacarCarta: Boolean
        get() = isPlayer && !seasonOver && myPending.isEmpty() &&
            myTodayAnswers.size < GameConfig.DEFAULT.preguntasPorDia && myTodayAnswers.all { it.estado == AnswerState.cerrada }

    /** El comodín del día sigue sin usar. */
    val comodinDisponible: Boolean get() = myTodayAnswers.none { it.comodin }
}

private const val MAX_REINTENTOS = 3L

/**
 * ViewModel principal (MVVM): escucha Firebase a través de los repositorios y expone un único
 * StateFlow. Las pantallas lo observan y llaman a sus acciones; nunca hablan con Firebase.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GameViewModel(app: Application) : AndroidViewModel(app) {
    private val c = (app as TriviaApp).container
    private val config = GameConfig.DEFAULT

    private val session = MutableStateFlow(Session.Conectando)
    private val sessionError = MutableStateFlow<String?>(null)
    private val uid = MutableStateFlow<String?>(null)

    /** Código recibido por enlace o QR, pendiente de que el jugador tenga perfil. */
    val pendingJoin = MutableStateFlow<String?>(null)

    private val online: Flow<Boolean> = callbackFlow {
        val cm = app.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        fun conectado() = cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { trySend(true) }
            // Con registerDefaultNetworkCallback, onLost significa que ya no hay red por defecto;
            // si otra la reemplaza llegará onAvailable. Consultar activeNetwork aquí puede devolver aún la red perdida.
            override fun onLost(network: Network) { trySend(false) }
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                trySend(caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET))
            }
        }
        trySend(conectado() || cm.activeNetwork != null)
        cm.registerDefaultNetworkCallback(callback)
        awaitClose { cm.unregisterNetworkCallback(callback) }
    }.distinctUntilChanged()

    // Perfil (reintenta si la primera lectura llega antes que el token de la sesión).
    private val profileSnap = uid.filterNotNull().flatMapLatest { id ->
        c.profiles.watch(id)
            .retryWhen { causa, intento ->
                (causa.isPermissionDenied() && intento < MAX_REINTENTOS).also { if (it) delay(400 * (intento + 1)) }
            }
            .catch { e ->
                sessionError.value = e.friendlyMessage("No se pudo cargar tu perfil.")
                session.value = Session.Error
            }
    }.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    // El grupo solo cambia con datos confirmados por el servidor (si no, sus listeners podrían
    // arrancar antes de que exista la ficha del jugador recién unido).
    private val codigo = profileSnap.filterNotNull().filter { it.confirmado }.map { it.profile?.grupoActual }.distinctUntilChanged()

    private val groupData: StateFlow<GroupData> = codigo.flatMapLatest { code ->
        if (code == null) {
            flowOf(GroupData.SinGrupo)
        } else {
            combine(c.groups.watch(code), c.game.players(code), c.game.answers(code), c.game.challenges(code)) { g, p, a, ch ->
                if (!g.exists()) GroupData.Error("Este grupo ya no existe.") else GroupData.Listo(g.toGroup(), p, a, ch)
            }
                .retryWhen { causa, intento ->
                    (causa.isPermissionDenied() && intento < MAX_REINTENTOS).also { if (it) delay(600 * (intento + 1)) }
                }
                .catch { e ->
                    emit(GroupData.Error(if (e.isPermissionDenied()) "Ya no formas parte de este grupo (pudo ser reiniciado o borrado)." else e.friendlyMessage("No se pudo cargar el grupo.")))
                }
                .onStart { emit(GroupData.Cargando) }
        }
    }.stateIn(viewModelScope, SharingStarted.Eagerly, GroupData.SinGrupo)

    /** Reloj del servidor: recalcula el día y los contadores cada segundo. */
    private val reloj = flow {
        while (true) {
            emit(ServerClock.now())
            delay(1_000)
        }
    }

    private val base = combine(session, sessionError, uid, online) { s, err, id, on -> Base(s, err, id, on) }

    private data class Base(val session: Session, val error: String?, val uid: String?, val online: Boolean)

    val state: StateFlow<GameUiState> = combine(base, profileSnap, groupData, reloj) { b, perfil, datos, ahora ->
        val listo = datos as? GroupData.Listo
        val dia = listo?.let { seasonDay(it.group.fechaInicioMs, it.group.dayOffset, ahora) } ?: 0
        val terminada = listo != null && (isSeasonOver(dia, config) || listo.group.finalizado)
        val filas = if (listo == null) emptyList() else computeStandings(listo.players, listo.answers, listo.challenges, terminada, config)
        GameUiState(
            session = b.session,
            sessionError = b.error,
            online = b.online,
            uid = b.uid,
            profileLoaded = perfil != null,
            profile = perfil?.profile,
            groupData = datos,
            day = dia,
            seasonOver = terminada,
            standings = filas,
            isCreator = listo != null && listo.group.adminUid == b.uid,
            isPlayer = listo?.players?.any { it.uid == b.uid } == true,
            myRow = filas.firstOrNull { it.uid == b.uid },
            myTodayAnswers = if (listo != null && b.uid != null) answersOfDay(b.uid, dia, listo.answers) else emptyList(),
            myPending = if (listo != null && b.uid != null) pendingChallengesFor(b.uid, listo.challenges, config) else emptyList(),
            now = ahora,
        )
    }.stateIn(viewModelScope, SharingStarted.Eagerly, GameUiState())

    private val cerrados = HashSet<String>()

    init {
        iniciarSesion()
        // Pregunta o reto que quedó abierto y cuyo tiempo expiró: se cierra como tiempo agotado.
        viewModelScope.launch {
            state.collect { s ->
                val code = s.group?.code ?: return@collect
                val id = s.uid ?: return@collect
                if (!s.online) return@collect
                val hoy = s.myToday
                if (hoy != null && hoy.estado == AnswerState.abierta && hoy.reveladoEnMs != null &&
                    s.now > hoy.reveladoEnMs + config.pausaRevelacionMs + config.tiempoPreguntaMs + 4_000 &&
                    cerrados.add("a-${hoy.dia}-${hoy.n}")
                ) {
                    c.game.close(code, id, hoy.dia, hoy.n, timeoutResult(config))
                }
                s.myPending.filter { it.estado == ChallengeState.abierto && it.abiertoEnMs != null }.forEach { r ->
                    if (s.now > r.abiertoEnMs!! + config.pausaRevelacionMs + config.tiempoPreguntaMs + 4_000 && cerrados.add("c-${r.id}")) {
                        c.game.resolveChallenge(code, r.id, timeoutResult(config))
                    }
                }
            }
        }
    }

    fun iniciarSesion() {
        session.value = Session.Conectando
        sessionError.value = null
        viewModelScope.launch {
            runCatching { c.auth.ensureSignedIn() }
                .onSuccess {
                    uid.value = it
                    session.value = Session.Listo
                }
                .onFailure {
                    sessionError.value = it.friendlyMessage("No se pudo iniciar la sesión.")
                    session.value = Session.Error
                }
        }
    }

    // ---------- acciones (devuelven Result para que la pantalla muestre el error) ----------

    private fun perfilActual(): UserProfile = state.value.profile ?: throw GameException("Primero crea tu perfil.")

    suspend fun guardarPerfil(apodo: String, avatar: AvatarId): Result<Unit> = runCatching {
        val id = uid.value ?: throw GameException("Sin sesión.")
        c.profiles.save(id, apodo, avatar, state.value.profile?.grupoActual)
    }

    suspend fun crearGrupo(nombre: String, juega: Boolean): Result<String> = runCatching {
        c.groups.create(perfilActual(), nombre, juega).also { pendingJoin.value = null }
    }

    suspend fun unirse(codigo: String): Result<Unit> = runCatching {
        c.groups.join(perfilActual(), codigo)
        pendingJoin.value = null
    }

    suspend fun salir(): Result<Unit> = runCatching { c.groups.leave(perfilActual()) }

    /** Clave de administración del grupo (solo para quien lo creó). */
    suspend fun claveAdmin(): String? = state.value.group?.code?.let { c.groups.adminKey(it) }

    private fun seen(s: GameUiState, uid: String) = seenQuestionIds(uid, s.answers, s.challenges)

    /** Voltea la siguiente carta del día (al azar entre las que aún tienen preguntas sin ver). */
    suspend fun sacarCarta(): Result<Unit> = runCatching {
        val s = state.value
        val id = s.uid ?: throw GameException("Sin sesión.")
        if (!s.puedeSacarCarta) throw GameException("Ahora no puedes sacar otra carta.")
        val carta = drawCard(c.questions.all, seen(s, id), Random.Default)
            ?: throw GameException("Ya respondiste todas las preguntas disponibles.")
        c.game.drawCard(s.group!!.code, id, s.day, s.myTodayAnswers.size, carta)
    }

    /** Comodín del día: cambia la carta volteada por otra de otra categoría. */
    suspend fun usarComodin(): Result<Unit> = runCatching {
        val s = state.value
        val id = s.uid ?: throw GameException("Sin sesión.")
        val hoy = s.myToday?.takeIf { it.estado == AnswerState.carta } ?: throw GameException("No hay carta para cambiar.")
        if (!s.comodinDisponible) throw GameException("Ya usaste tu comodín de hoy.")
        val nueva = drawCard(c.questions.all, seen(s, id), Random.Default, setOf(hoy.carta))
            ?: throw GameException("No quedan otras cartas para cambiar.")
        c.game.useComodin(s.group!!.code, id, hoy.dia, hoy.n, nueva)
    }

    /** "Ver la pregunta": elige una pregunta de la carta y empieza el tiempo. */
    suspend fun verPregunta(): Result<Unit> = runCatching {
        val s = state.value
        val id = s.uid ?: throw GameException("Sin sesión.")
        val hoy = s.myToday?.takeIf { it.estado == AnswerState.carta } ?: throw GameException("No hay carta volteada.")
        val q = drawQuestionForCard(c.questions.all, seen(s, id), hoy.carta, Random.Default)
            ?: throw GameException("No quedan preguntas de esta carta.")
        c.game.openQuestion(s.group!!.code, id, hoy.dia, hoy.n, q.id)
    }

    /** Saca la carta y abre su pregunta de una vez (sin pasar por el comodín). */
    suspend fun revelar(): Result<Unit> = runCatching {
        sacarCarta().getOrThrow()
        // Esperar a que la carta volteada llegue al estado antes de abrirla.
        state.first { it.myToday?.estado == AnswerState.carta }
        verPregunta().getOrThrow()
    }

    /** Responde la pregunta abierta (null = tiempo agotado). */
    fun responder(opcion: Int?): Result<Unit> = runCatching {
        val s = state.value
        val hoy = s.myToday?.takeIf { it.estado == AnswerState.abierta } ?: throw GameException("No hay pregunta abierta.")
        val q = hoy.preguntaId?.let { c.questions[it] } ?: throw GameException("Pregunta desconocida.")
        val r = if (opcion == null) timeoutResult(config) else evaluateAnswer(q, opcion, elapsedMs(hoy.reveladoEnMs ?: ServerClock.now(), ServerClock.now(), config), config)
        c.game.close(s.group!!.code, s.uid!!, hoy.dia, hoy.n, r)
    }

    /** Con 2 aciertos hoy y sin haber retado aún. */
    fun puedeRetar(): Boolean {
        val s = state.value
        return !s.seasonOver && s.uid != null && canSendChallenge(s.uid, s.day, s.answers, config)
    }

    /** Compañeros que aún pueden recibir un reto hoy. */
    fun retables(): Set<String> {
        val s = state.value
        return eligibleTargets(s.uid ?: "", s.players, s.challenges, s.day, config).map { it.uid }.toSet()
    }

    suspend fun retar(para: String): Result<Unit> = runCatching {
        val s = state.value
        val id = s.uid ?: throw GameException("Sin sesión.")
        val llave = unlockingAnswer(id, s.day, s.answers, config) ?: throw GameException("Necesitas 2 aciertos hoy para retar.")
        val q = pickChallengeQuestion(c.questions.all, seen(s, para), llave.carta, Random.Default)
            ?: throw GameException("Esa persona ya respondió todas las preguntas difíciles. Elige a otra.")
        c.game.sendChallenge(s.group!!.code, id, para, s.day, llave.n, q)
    }

    /**
     * Devuelve un reto recibido. El resultado lo decide la hora del servidor: la pantalla lo lee del
     * reto en vivo (devueltoEnMs llega cuando el servidor confirma), no de una hora estimada aquí.
     */
    suspend fun devolverReto(id: String): Result<Unit> = runCatching {
        val s = state.value
        val reto = s.challenges.firstOrNull { it.id == id } ?: throw GameException("Reto no encontrado.")
        if (!canReturnChallenge(reto, s.uid ?: "")) throw GameException("Este reto ya no se puede devolver.")
        val extra = pickChallengeQuestion(c.questions.all, seen(s, reto.para) + reto.preguntaId, null, Random.Default)
            ?: throw GameException("No quedan preguntas difíciles para el doble reto.")
        // La hora devuelta solo sincroniza el reloj; el resultado se lee del reto en vivo.
        c.game.returnChallenge(s.group!!.code, reto, extra).let { }
    }

    suspend fun abrirReto(id: String): Result<Unit> = runCatching { c.game.openChallenge(state.value.group!!.code, id) }

    fun responderReto(id: String, opcion: Int?): Result<Unit> = runCatching {
        val s = state.value
        val reto = s.challenges.firstOrNull { it.id == id } ?: throw GameException("Reto no encontrado.")
        val q = c.questions[reto.preguntaId] ?: throw GameException("Pregunta desconocida.")
        val r = if (opcion == null) timeoutResult(config) else evaluateAnswer(q, opcion, elapsedMs(reto.abiertoEnMs ?: ServerClock.now(), ServerClock.now(), config), config)
        c.game.resolveChallenge(s.group!!.code, id, r)
    }

    fun pregunta(id: String) = c.questions[id]

    fun expirado(desdeMs: Long?) = desdeMs != null && isExpired(desdeMs, ServerClock.now(), config)

    companion object {
        val Factory = viewModelFactory {
            initializer { GameViewModel(this[APPLICATION_KEY] as TriviaApp) }
        }
    }
}
