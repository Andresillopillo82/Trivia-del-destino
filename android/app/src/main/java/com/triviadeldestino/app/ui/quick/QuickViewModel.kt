package com.triviadeldestino.app.ui.quick

import android.app.Application
import android.os.SystemClock
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.triviadeldestino.app.TriviaApp
import com.triviadeldestino.app.data.ServerClock
import com.triviadeldestino.app.data.friendlyMessage
import com.triviadeldestino.app.game.AvatarId
import com.triviadeldestino.app.game.QUICK_BOTS
import com.triviadeldestino.app.game.QuickBotRun
import com.triviadeldestino.app.game.QuickClock
import com.triviadeldestino.app.game.QuickPlayer
import com.triviadeldestino.app.game.QuickRoom
import com.triviadeldestino.app.game.QuickStatus
import com.triviadeldestino.app.game.Question
import com.triviadeldestino.app.game.applyAnswer
import com.triviadeldestino.app.game.botProgress
import com.triviadeldestino.app.game.buildQuickSequence
import com.triviadeldestino.app.game.hardDeadlineMs
import com.triviadeldestino.app.game.isExpired
import com.triviadeldestino.app.game.playersOfRound
import com.triviadeldestino.app.game.shouldFinish
import com.triviadeldestino.app.game.simulateQuickBot
import com.triviadeldestino.app.game.startClock
import com.triviadeldestino.app.game.tick
import com.triviadeldestino.app.game.usedQuestionIds
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** Dónde está el jugador dentro de la Partida Rápida (null = fuera, en el Modo Destino). */
sealed interface RutaRapida {
    data object Menu : RutaRapida
    data class Sala(val code: String) : RutaRapida
}

data class Flotante(val id: Long, val bien: Boolean)

/** Partida en curso de este dispositivo. Los tiempos son de SystemClock.elapsedRealtime (monotónico). */
data class QuickPlay(
    val round: Int,
    val inicio: Long,
    /** Límite global (5 min desde el inicio en el servidor), pasado a reloj local. */
    val limiteLocal: Long,
    val clock: QuickClock? = null,
    val idx: Int = 0,
    val pregunta: Question? = null,
    val elegida: Int? = null,
    val flotantes: List<Flotante> = emptyList(),
    val temblor: Int = 0,
    val now: Long = inicio,
)

/** Lo que el jugador vio y respondió (solo en memoria, para su resumen final). */
data class QuickAnswered(val question: Question, val opcion: Int, val correcta: Boolean)

data class QuickResult(val round: Int, val correctas: Int, val falladas: Int, val historial: List<QuickAnswered>)

data class QuickUiState(
    val uid: String? = null,
    val code: String? = null,
    val room: QuickRoom? = null,
    val roomLoaded: Boolean = false,
    val players: List<QuickPlayer> = emptyList(),
    val error: String? = null,
    val joinError: String? = null,
    val busy: String? = null,
    val play: QuickPlay? = null,
    val result: QuickResult? = null,
    val reentradaRonda: Int? = null,
    /** Hora del servidor (estimada), se actualiza cada segundo. */
    val now: Long = ServerClock.now(),
) {
    val isHost: Boolean get() = room != null && room.hostUid == uid
    val yo: QuickPlayer? get() = players.firstOrNull { it.uid == uid }
    val participo: Boolean get() = room != null && yo?.round == room.round
    val vencida: Boolean get() = room?.status == QuickStatus.playing && hardDeadlineMs(room)?.let { now >= it } == true
    val terminada: Boolean get() = room?.status == QuickStatus.finished || vencida
    val termineYo: Boolean get() = result != null && result.round == room?.round
    val reentrada: Boolean get() = reentradaRonda != null && reentradaRonda == room?.round
    val expirada: Boolean get() = room != null && isExpired(room, now)
    val ronda: List<QuickPlayer> get() = room?.let { playersOfRound(it, players) }.orEmpty()

    /** Durante la partida los jugadores solo escuchan la sala; el anfitrión, también a los jugadores. */
    val escucharJugadores: Boolean
        get() = room != null && (room.status != QuickStatus.playing || isHost || termineYo || reentrada || vencida)

    /** ¿Este dispositivo está jugando ahora mismo? */
    val jugando: Boolean
        get() = room?.status == QuickStatus.playing && !vencida && participo && !termineYo && !reentrada && play?.round == room.round
}

private const val CUENTA_MS = 3_000L

/**
 * Partida Rápida (igual que la web): salas temporales por código, independientes de los grupos.
 * Cada jugador tiene su propio reloj; el anfitrión simula los bots y cierra la partida.
 */
class QuickViewModel(app: Application) : AndroidViewModel(app) {
    private val c = (app as TriviaApp).container
    private val repo = c.quick
    private val bank: List<Question> get() = c.questions.all

    val ruta = MutableStateFlow<RutaRapida?>(null)

    private val _state = MutableStateFlow(QuickUiState())
    val state: StateFlow<QuickUiState> = _state.asStateFlow()

    /** true = acierto, false = fallo (la pantalla reproduce el sonido y la vibración). */
    private val _efectos = MutableSharedFlow<Boolean>(extraBufferCapacity = 4)
    val efectos: SharedFlow<Boolean> = _efectos.asSharedFlow()

    private var yo: Triple<String, String, AvatarId>? = null
    private var roomJob: Job? = null
    private var playersJob: Job? = null
    private var gameJob: Job? = null
    private var syncJob: Job? = null
    private var hostJob: Job? = null
    private var hostKey: String? = null
    private var primeraVista: QuickStatus? = null
    private var unido = false
    private var resetEnviado: Int? = null
    private val botsReiniciados = HashSet<String>()

    private var seq: List<Question> = emptyList()
    private var historial: List<QuickAnswered> = emptyList()
    private var enviado = 0 to 0
    private var terminado = false

    private var botRuns: List<QuickBotRun> = emptyList()
    private val botEnviado = HashMap<String, String>()
    private var ultimoEnvioBots = 0L
    private var cerrando: String? = null

    init {
        viewModelScope.launch {
            while (isActive) {
                _state.update { it.copy(now = ServerClock.now()) }
                evaluar()
                delay(1_000)
            }
        }
    }

    // ---------- menú ----------

    suspend fun crear(uid: String, apodo: String, avatar: AvatarId, hostPlays: Boolean): Result<String> =
        runCatching { repo.create(uid, apodo, avatar, hostPlays) }

    fun parseCode(texto: String): Result<String> = runCatching { repo.parseCode(texto) }

    // ---------- sala ----------

    /** Abre la sala `code` (y entra si está en el lobby). */
    fun abrir(code: String, uid: String, apodo: String, avatar: AvatarId) {
        yo = Triple(uid, apodo, avatar)
        if (_state.value.code == code && roomJob != null) return
        cerrarVista()
        _state.value = QuickUiState(uid = uid, code = code)
        roomJob = viewModelScope.launch {
            repo.watchRoom(code)
                .catch { e -> _state.update { it.copy(error = e.friendlyMessage(), roomLoaded = true) } }
                .collect { r ->
                    if (r != null && primeraVista == null) primeraVista = r.status
                    _state.update { it.copy(room = r, roomLoaded = true) }
                    evaluar()
                }
        }
    }

    /** Deja de escuchar la sala (al salir de la pantalla). */
    fun cerrarVista() {
        listOf(roomJob, playersJob, gameJob, syncJob, hostJob).forEach { it?.cancel() }
        roomJob = null
        playersJob = null
        gameJob = null
        syncJob = null
        hostJob = null
        hostKey = null
        primeraVista = null
        unido = false
        resetEnviado = null
        botsReiniciados.clear()
        _state.value = QuickUiState(uid = yo?.first)
    }

    /** Reacciona a cualquier cambio de la sala, de los jugadores o del reloj. */
    private fun evaluar() {
        val s = _state.value
        val room = s.room ?: return
        val (uid, apodo, avatar) = yo ?: return
        val code = room.code

        // Jugadores: solo cuando hace falta (ahorro de lecturas durante la partida).
        if (s.escucharJugadores && playersJob == null) {
            playersJob = viewModelScope.launch {
                repo.watchPlayers(code)
                    .catch { e -> _state.update { it.copy(error = e.friendlyMessage()) } }
                    .collect { ps ->
                        _state.update { it.copy(players = ps) }
                        evaluar()
                    }
            }
        } else if (!s.escucharJugadores && playersJob != null) {
            playersJob?.cancel()
            playersJob = null
        }

        // Entrar automáticamente (solo en el lobby).
        if (room.status == QuickStatus.lobby && !unido && !(room.hostUid == uid && !room.hostPlays)) {
            unido = true
            viewModelScope.launch {
                runCatching { repo.join(code, uid, apodo, avatar) }.onFailure { e ->
                    unido = false
                    _state.update { it.copy(joinError = e.friendlyMessage()) }
                }
            }
        }

        // Revancha: la ficha propia (y la de los bots, si soy anfitrión) vuelve a cero.
        val mia = s.yo
        if (room.status == QuickStatus.lobby && mia != null && mia.round != room.round && resetEnviado != room.round) {
            resetEnviado = room.round
            viewModelScope.launch { runCatching { repo.resetPlayer(code, uid, room.round) } }
        }
        if (s.isHost && room.status == QuickStatus.lobby) {
            s.players.filter { it.esBot && it.round != room.round && botsReiniciados.add("${it.uid}:${room.round}") }.forEach { b ->
                viewModelScope.launch { runCatching { repo.resetPlayer(code, b.uid, room.round) } }
            }
        }

        // Si se abre la sala con la partida ya en juego, este dispositivo recargó: queda terminado.
        if (primeraVista == QuickStatus.playing && s.reentradaRonda == null) {
            _state.update { it.copy(reentradaRonda = room.round) }
            viewModelScope.launch {
                runCatching {
                    val p = repo.getPlayer(code, uid)
                    if (p != null && p.round == room.round && !p.finished) repo.markFinished(code, uid)
                }
            }
        }

        // Empieza mi partida.
        val ahora = _state.value
        if (room.status == QuickStatus.playing && !ahora.vencida && ahora.participo && !ahora.termineYo && !ahora.reentrada &&
            ahora.play?.round != room.round
        ) {
            empezar(room)
        }

        // Tareas del anfitrión durante la partida.
        val clave = "$code:${room.round}"
        if (s.isHost && room.status == QuickStatus.playing && room.startedAtMs != null) {
            if (hostKey != clave) iniciarAnfitrion(clave)
        } else if (hostJob != null) {
            hostJob?.cancel()
            hostJob = null
            hostKey = null
        }
    }

    // ---------- partida del jugador ----------

    private fun pregunta(room: QuickRoom, i: Int): Question {
        if (seq.size <= i) seq = buildQuickSequence(room.seed, bank, room.config.difficulty, i + 20, room.evitar)
        return seq[i]
    }

    private fun empezar(room: QuickRoom) {
        val inicio = SystemClock.elapsedRealtime()
        val limite = room.startedAtMs?.let { inicio + it + room.config.hardTimeoutMs - ServerClock.now() } ?: Long.MAX_VALUE
        seq = emptyList()
        historial = emptyList()
        enviado = 0 to 0
        terminado = false
        _state.update { it.copy(play = QuickPlay(room.round, inicio, limite, pregunta = pregunta(room, 0))) }
        gameJob?.cancel()
        syncJob?.cancel()
        gameJob = viewModelScope.launch {
            while (isActive) {
                val t = SystemClock.elapsedRealtime()
                val p = _state.value.play ?: break
                var clock = p.clock
                if (clock == null && t - p.inicio >= CUENTA_MS) clock = startClock(room.config, p.inicio + CUENTA_MS)
                if (clock != null && !terminado) {
                    val tc = if (t >= p.limiteLocal) clock.copy(finished = true) else tick(clock, t)
                    if (tc.finished) {
                        _state.update { it.copy(play = it.play?.copy(clock = tc, now = t)) }
                        terminar(room, tc)
                        break
                    }
                }
                _state.update { it.copy(play = it.play?.copy(clock = clock, now = t)) }
                delay(100)
            }
        }
        // Contadores: como mucho cada syncEveryMs y solo si cambiaron.
        syncJob = viewModelScope.launch {
            while (isActive) {
                delay(room.config.syncEveryMs)
                val c = _state.value.play?.clock ?: continue
                if (terminado) break
                if (c.correctas to c.falladas == enviado) continue
                enviado = c.correctas to c.falladas
                runCatching { repo.syncProgress(room.code, yo!!.first, room.round, c.correctas, c.falladas, false) }
            }
        }
    }

    fun responder(opcion: Int) {
        val s = _state.value
        val room = s.room ?: return
        val p = s.play ?: return
        val c = p.clock ?: return
        if (c.finished || p.elegida != null || terminado) return
        val t = SystemClock.elapsedRealtime()
        val q = pregunta(room, p.idx)
        val correcta = opcion == q.respuestaCorrecta
        val nuevo = applyAnswer(c, correcta, t, room.config)
        if (nuevo.correctas + nuevo.falladas == c.correctas + c.falladas) {
            _state.update { it.copy(play = p.copy(clock = nuevo)) }
            terminar(room, nuevo) // con el reloj en 0, la respuesta no cuenta
            return
        }
        historial = historial + QuickAnswered(q, opcion, correcta)
        _efectos.tryEmit(correcta)
        val flotante = Flotante(t, correcta)
        _state.update {
            it.copy(
                play = p.copy(
                    clock = nuevo,
                    elegida = opcion,
                    flotantes = (p.flotantes.takeLast(3) + flotante),
                    temblor = if (correcta) p.temblor else p.temblor + 1,
                ),
            )
        }
        viewModelScope.launch {
            delay(900)
            _state.update { st -> st.copy(play = st.play?.let { pl -> pl.copy(flotantes = pl.flotantes - flotante) }) }
        }
        viewModelScope.launch {
            delay(room.config.feedbackMs)
            if (nuevo.finished) {
                _state.update { st -> st.copy(play = st.play?.copy(elegida = null)) }
                terminar(room, nuevo)
            } else {
                _state.update { st -> st.copy(play = st.play?.let { pl -> pl.copy(elegida = null, idx = pl.idx + 1, pregunta = pregunta(room, pl.idx + 1)) }) }
            }
        }
    }

    private fun terminar(room: QuickRoom, c: QuickClock) {
        if (terminado) return
        terminado = true
        val uid = yo?.first ?: return
        _state.update { it.copy(result = QuickResult(room.round, c.correctas, c.falladas, historial)) }
        // La última escritura importa: se reintenta (si la sala ya terminó, las reglas la rechazan).
        viewModelScope.launch {
            repeat(4) { intento ->
                if (runCatching { repo.syncProgress(room.code, uid, room.round, c.correctas, c.falladas, true) }.isSuccess) return@launch
                delay(1000L * (intento + 1))
            }
        }
        evaluar()
    }

    // ---------- anfitrión ----------

    private fun iniciarAnfitrion(clave: String) {
        hostJob?.cancel()
        hostKey = clave
        botEnviado.clear()
        val inicial = _state.value
        val room = inicial.room ?: return
        botRuns = playersOfRound(room, inicial.players).filter { it.esBot }.mapNotNull { b ->
            QUICK_BOTS.firstOrNull { it.uid == b.uid }?.let { simulateQuickBot(it, room.seed, bank, room.config, room.evitar) }
        }
        hostJob = viewModelScope.launch {
            while (isActive) {
                val s = _state.value
                val r = s.room ?: break
                val inicio = r.startedAtMs ?: break
                if (r.status != QuickStatus.playing) break
                val ahora = ServerClock.now()
                val forzar = ahora - ultimoEnvioBots >= r.config.syncEveryMs
                for (run in botRuns) {
                    val p = botProgress(run, ahora - inicio - CUENTA_MS)
                    val firma = "${r.round}:${p.correctas}:${p.falladas}:${p.finished}"
                    val antes = botEnviado[run.uid]
                    if (antes == firma) continue
                    // Igual que un jugador: como mucho cada syncEveryMs, y siempre al terminar.
                    if (!forzar && !(p.finished && antes?.endsWith(":true") != true)) continue
                    botEnviado[run.uid] = firma
                    launch { runCatching { repo.syncProgress(r.code, run.uid, r.round, p.correctas, p.falladas, p.finished) }.onFailure { botEnviado.remove(run.uid) } }
                }
                if (forzar) ultimoEnvioBots = ahora
                if (cerrando != clave && shouldFinish(r, s.players, ahora)) {
                    cerrando = clave
                    launch { runCatching { repo.finish(r.code) }.onFailure { cerrando = null } }
                }
                delay(500)
            }
        }
    }

    private fun accion(nombre: String, f: suspend () -> Unit) {
        if (_state.value.busy != null) return
        _state.update { it.copy(busy = nombre, error = null) }
        viewModelScope.launch {
            val r = runCatching { f() }
            _state.update { it.copy(busy = null, error = r.exceptionOrNull()?.friendlyMessage()) }
        }
    }

    fun iniciar() {
        val r = _state.value.room ?: return
        accion("iniciar") { repo.start(r.code) }
    }

    fun anadirBot() {
        val s = _state.value
        val r = s.room ?: return
        val libre = QUICK_BOTS.firstOrNull { b -> s.players.none { it.uid == b.uid } } ?: return
        accion("bot") { repo.addBot(r.code, libre, r.round) }
    }

    fun sacar(uid: String) {
        val r = _state.value.room ?: return
        accion("sacar") { repo.remove(r.code, uid) }
    }

    fun terminarAhora() {
        val r = _state.value.room ?: return
        accion("terminar") { repo.finish(r.code) }
    }

    fun revancha() {
        val s = _state.value
        val r = s.room ?: return
        accion("revancha") {
            if (r.status == QuickStatus.playing) repo.finish(r.code)
            repo.rematch(r.copy(status = QuickStatus.finished), usedQuestionIds(r, s.players, bank))
            _state.update { it.copy(result = null, play = null) }
        }
    }

    fun cerrarSala(despues: () -> Unit) {
        val r = _state.value.room ?: return
        accion("cerrar") {
            repo.close(r.code)
            despues()
        }
    }

    /** Salir del lobby: borra la ficha propia. */
    fun salirDelLobby(despues: () -> Unit) {
        val s = _state.value
        val r = s.room
        val uid = yo?.first
        accion("salir") {
            if (r != null && uid != null && s.yo != null) repo.leave(r.code, uid)
            despues()
        }
    }

    companion object {
        val Factory = viewModelFactory {
            initializer { QuickViewModel(this[APPLICATION_KEY] as TriviaApp) }
        }
    }
}
