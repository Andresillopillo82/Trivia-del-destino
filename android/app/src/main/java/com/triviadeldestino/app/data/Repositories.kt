package com.triviadeldestino.app.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.Source
import com.triviadeldestino.app.game.AnswerEvent
import com.triviadeldestino.app.game.AnswerResult
import com.triviadeldestino.app.game.AvatarId
import com.triviadeldestino.app.game.ChallengeEvent
import com.triviadeldestino.app.game.CardId
import com.triviadeldestino.app.game.GameConfig
import com.triviadeldestino.app.game.PlayerInfo
import com.triviadeldestino.app.game.Question
import com.triviadeldestino.app.game.challengeId
import com.triviadeldestino.app.game.extraChallengeId
import com.triviadeldestino.app.game.cleanText
import com.triviadeldestino.app.game.generateAdminKey
import com.triviadeldestino.app.game.generateGroupCode
import com.triviadeldestino.app.game.groupCodeFrom
import com.triviadeldestino.app.game.startOfLocalDay
import com.triviadeldestino.app.game.validateApodo
import com.triviadeldestino.app.game.validateGroupName
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout

/** Tiempo máximo de espera para operaciones que necesitan confirmación del servidor. */
internal const val TIMEOUT_MS = 12_000L

// ---------- utilidades de Flow ----------

/** Documento en tiempo real como Flow (el listener se quita al dejar de recolectar). */
internal fun DocumentReference.asFlow(metadata: MetadataChanges = MetadataChanges.EXCLUDE): Flow<DocumentSnapshot> = callbackFlow {
    val registro = addSnapshotListener(metadata) { snap, error ->
        if (error != null) close(error) else if (snap != null) trySend(snap)
    }
    awaitClose { registro.remove() }
}

internal fun <T> Query.asListFlow(map: (DocumentSnapshot) -> T?): Flow<List<T>> = callbackFlow {
    val registro = addSnapshotListener { snap, error ->
        if (error != null) close(error) else if (snap != null) trySend(snap.documents.mapNotNull(map))
    }
    awaitClose { registro.remove() }
}

// ---------- sesión ----------

/** Sesión anónima: persiste en el dispositivo, así el jugador conserva su identidad al volver. */
class AuthRepository(private val auth: FirebaseAuth) {
    private val mutex = Mutex()

    /** uid de la sesión, creándola si no existe. Las llamadas simultáneas comparten un solo inicio de sesión. */
    suspend fun ensureSignedIn(): String = mutex.withLock {
        auth.currentUser?.uid ?: requireNotNull(auth.signInAnonymously().await().user).uid
    }
}

// ---------- perfil ----------

/** Perfil y si viene confirmado por el servidor (sin escrituras locales pendientes). */
data class ProfileSnapshot(val profile: UserProfile?, val confirmado: Boolean)

class ProfileRepository(private val db: FirebaseFirestore) {
    fun watch(uid: String): Flow<ProfileSnapshot> = callbackFlow {
        val registro = db.document(Paths.user(uid)).addSnapshotListener(MetadataChanges.INCLUDE) { snap, error ->
            if (error != null) close(error)
            else if (snap != null) trySend(ProfileSnapshot(snap.takeIf { it.exists() }?.toUser(), !snap.metadata.hasPendingWrites()))
        }
        awaitClose { registro.remove() }
    }

    /** Guarda apodo y avatar; si juega en un grupo, actualiza también su ficha en el mismo lote. */
    suspend fun save(uid: String, apodo: String, avatar: AvatarId, grupoActual: String?) {
        val limpio = cleanText(apodo)
        validateApodo(limpio)?.let { throw GameException(it) }
        val batch = db.batch()
        batch.set(db.document(Paths.user(uid)), userDoc(limpio, avatar, grupoActual), SetOptions.merge())
        if (grupoActual != null) {
            val ficha = db.document(Paths.player(grupoActual, uid))
            val existe = runCatching { ficha.get().await().exists() }.getOrDefault(false)
            if (existe) batch.update(ficha, mapOf("apodo" to limpio, "avatar" to avatar.id))
        }
        val inicio = System.currentTimeMillis()
        withTimeout(TIMEOUT_MS) { batch.commit().await() }
        syncClock(db.document(Paths.user(uid)), "vistoEn", inicio)
    }
}

/** Lee del servidor una marca de tiempo recién escrita y sincroniza el reloj local con ella. */
private suspend fun syncClock(ref: DocumentReference, campo: String, inicio: Long): Long {
    val fin = System.currentTimeMillis()
    return runCatching {
        val ts = withTimeout(TIMEOUT_MS) { ref.get(Source.SERVER).await() }.getTimestamp(campo)
        val ms = requireNotNull(ts).toDate().time
        ServerClock.sync(ms, inicio, fin)
        ms
    }.getOrElse { ServerClock.now() }
}

// ---------- grupos ----------

class GroupRepository(private val db: FirebaseFirestore) {
    fun watch(code: String): Flow<DocumentSnapshot> = db.document(Paths.group(code)).asFlow()

    /** Busca un grupo en el servidor (para unirse hace falta conexión). */
    suspend fun find(textoOCodigo: String): Group? {
        val code = groupCodeFrom(textoOCodigo) ?: throw GameException("El código tiene 5 caracteres: letras y números (sin 0, O, 1 ni I).")
        val snap = withTimeout(TIMEOUT_MS) { db.document(Paths.group(code)).get(Source.SERVER).await() }
        return if (snap.exists()) snap.toGroup() else null
    }

    /**
     * Crea un grupo con código único y su clave de administración, en una transacción.
     * El creador entra como jugador si `juega`; la administración avanzada se hace en la web.
     */
    suspend fun create(profile: UserProfile, nombre: String, juega: Boolean): String {
        val limpio = cleanText(nombre)
        validateGroupName(limpio)?.let { throw GameException(it) }
        repeat(6) {
            val code = generateGroupCode()
            val creado = withTimeout(TIMEOUT_MS) {
                db.runTransaction { tx ->
                    val ref = db.document(Paths.group(code))
                    if (tx.get(ref).exists()) return@runTransaction false
                    tx.set(ref, newGroupDoc(profile.uid, limpio, juega, startOfLocalDay(ServerClock.now())))
                    tx.set(db.document(Paths.adminKey(code)), adminKeyDoc(generateAdminKey()))
                    profile.grupoActual?.takeIf { it != code }?.let { anterior ->
                        tx.delete(db.document(Paths.player(anterior, profile.uid)))
                        tx.delete(db.document(Paths.coAdmin(anterior, profile.uid)))
                    }
                    tx.set(db.document(Paths.user(profile.uid)), userDoc(profile.apodo, profile.avatar, code), SetOptions.merge())
                    if (juega) tx.set(db.document(Paths.player(code, profile.uid)), humanPlayerDoc(profile.apodo, profile.avatar))
                    true
                }.await()
            }
            if (creado) return code
        }
        throw GameException("No se pudo generar un código de grupo libre. Inténtalo de nuevo.")
    }

    /** Se une a un grupo; como solo se puede estar en uno a la vez, sale del anterior en el mismo lote. */
    suspend fun join(profile: UserProfile, textoOCodigo: String): Group {
        val group = find(textoOCodigo) ?: throw GameException("No existe ningún grupo con ese código.")
        if (profile.grupoActual == group.code) return group
        val batch = db.batch()
        profile.grupoActual?.let { anterior ->
            batch.delete(db.document(Paths.player(anterior, profile.uid)))
            batch.delete(db.document(Paths.coAdmin(anterior, profile.uid)))
        }
        batch.set(db.document(Paths.user(profile.uid)), userDoc(profile.apodo, profile.avatar, group.code), SetOptions.merge())
        batch.set(db.document(Paths.player(group.code, profile.uid)), humanPlayerDoc(profile.apodo, profile.avatar))
        withTimeout(TIMEOUT_MS) { batch.commit().await() }
        return group
    }

    suspend fun leave(profile: UserProfile) {
        val code = profile.grupoActual ?: return
        val batch = db.batch()
        batch.delete(db.document(Paths.player(code, profile.uid)))
        batch.delete(db.document(Paths.coAdmin(code, profile.uid)))
        batch.set(db.document(Paths.user(profile.uid)), userDoc(profile.apodo, profile.avatar, null), SetOptions.merge())
        withTimeout(TIMEOUT_MS) { batch.commit().await() }
    }

    /** Clave de administración (solo la lee quien creó el grupo; para los demás, null). */
    suspend fun adminKey(code: String): String? = runCatching {
        withTimeout(TIMEOUT_MS) { db.document(Paths.adminKey(code)).get().await() }.getString("clave")
    }.getOrNull()
}

// ---------- juego: jugadores, respuestas y retos ----------

class GameRepository(private val db: FirebaseFirestore) {
    fun players(code: String): Flow<List<PlayerInfo>> = db.collection(Paths.players(code)).asListFlow { it.toPlayer() }
    fun answers(code: String): Flow<List<AnswerEvent>> = db.collection(Paths.answers(code)).asListFlow { it.toAnswer() }
    fun challenges(code: String): Flow<List<ChallengeEvent>> = db.collection(Paths.challenges(code)).asListFlow { it.toChallenge() }

    /**
     * Voltea la carta `n` del día (aún sin pregunta). La clave {uid}_{dia}_{n} impide sacarla dos veces
     * y las reglas exigen haber respondido la anterior.
     */
    suspend fun drawCard(code: String, uid: String, dia: Int, n: Int, carta: CardId) {
        try {
            withTimeout(TIMEOUT_MS) { db.document(Paths.answer(code, uid, dia, n)).set(cardAnswerDoc(uid, dia, n, carta)).await() }
        } catch (e: Exception) {
            if (e.isPermissionDenied()) throw GameException("Ya sacaste esta carta, o el día cambió.")
            throw e
        }
    }

    /** Comodín del día: cambia la carta antes de ver la pregunta. */
    suspend fun useComodin(code: String, uid: String, dia: Int, n: Int, carta: CardId) {
        try {
            withTimeout(TIMEOUT_MS) { db.document(Paths.answer(code, uid, dia, n)).update(comodinPatch(carta)).await() }
        } catch (e: Exception) {
            if (e.isPermissionDenied()) throw GameException("Ya usaste tu comodín de hoy.")
            throw e
        }
    }

    /** "Ver la pregunta": la fija y devuelve la hora del servidor desde la que corre el tiempo. */
    suspend fun openQuestion(code: String, uid: String, dia: Int, n: Int, preguntaId: String): Long {
        val ref = db.document(Paths.answer(code, uid, dia, n))
        val inicio = System.currentTimeMillis()
        withTimeout(TIMEOUT_MS) { ref.update(openAnswerPatch(preguntaId)).await() }
        return syncClock(ref, "reveladoEn", inicio)
    }

    /** Cierra la respuesta (sin esperar al servidor: la caché local la muestra al instante). */
    fun close(code: String, uid: String, dia: Int, n: Int, result: AnswerResult) =
        db.document(Paths.answer(code, uid, dia, n)).update(closeAnswerPatch(result))

    /**
     * Lanza un reto: marca la respuesta que lo desbloqueó (el 2.º acierto del día) y crea el reto
     * en el mismo lote (las reglas exigen ambas cosas).
     */
    suspend fun sendChallenge(code: String, de: String, para: String, dia: Int, respuestaN: Int, question: Question) {
        val batch = db.batch()
        batch.update(db.document(Paths.answer(code, de, dia, respuestaN)), mapOf("retoPara" to para))
        batch.set(
            db.document(Paths.challenge(code, challengeId(para, dia))),
            newChallengeDoc(de, para, dia, question.id, question.card, respuestaN),
        )
        try {
            withTimeout(TIMEOUT_MS) { batch.commit().await() }
        } catch (e: Exception) {
            if (e.isPermissionDenied()) throw GameException("No se pudo lanzar el reto: esa persona ya recibió uno hoy o ya usaste tu reto.")
            throw e
        }
    }

    /**
     * Devuelve el reto recibido. En el mismo lote crea la pregunta extra (solo cuenta si la devolución
     * falla). Devuelve la hora del servidor de la devolución, que decide el resultado.
     */
    suspend fun returnChallenge(code: String, reto: ChallengeEvent, extra: Question): Long {
        val ref = db.document(Paths.challenge(code, reto.id))
        val batch = db.batch()
        batch.update(ref, returnChallengePatch())
        batch.set(
            db.document(Paths.challenge(code, extraChallengeId(reto.para, reto.dia))),
            extraChallengeDoc(reto.de, reto.para, reto.dia, extra.id, extra.card),
        )
        val inicio = System.currentTimeMillis()
        try {
            withTimeout(TIMEOUT_MS) { batch.commit().await() }
        } catch (e: Exception) {
            if (e.isPermissionDenied()) throw GameException("Este reto ya no se puede devolver.")
            throw e
        }
        return syncClock(ref, "devueltoEn", inicio)
    }

    /** Quien debe responder abre la pregunta del reto: el temporizador corre desde la hora del servidor. */
    suspend fun openChallenge(code: String, id: String): Long {
        val ref = db.document(Paths.challenge(code, id))
        val inicio = System.currentTimeMillis()
        withTimeout(TIMEOUT_MS) { ref.update(openChallengePatch()).await() }
        return syncClock(ref, "abiertoEn", inicio)
    }

    fun resolveChallenge(code: String, id: String, result: AnswerResult) =
        db.document(Paths.challenge(code, id)).update(resolveChallengePatch(result))
}

// ---------- recordatorio diario ----------

/**
 * Decide si hay que recordarle al jugador sus cartas del día: tiene grupo, juega en él, la temporada
 * sigue y todavía no respondió las 3 preguntas de hoy. Devuelve el texto del aviso o null.
 */
class RecordatorioRepository(private val db: FirebaseFirestore) {
    suspend fun mensaje(uid: String, ahoraMs: Long = ServerClock.now()): String? {
        val code = db.document(Paths.user(uid)).get().await().getString("grupoActual") ?: return null
        val grupoSnap = db.document(Paths.group(code)).get().await()
        if (!grupoSnap.exists()) return null
        val grupo = grupoSnap.toGroup()
        val dia = com.triviadeldestino.app.game.seasonDay(grupo.fechaInicioMs, grupo.dayOffset, ahoraMs)
        if (grupo.finalizado || com.triviadeldestino.app.game.isSeasonOver(dia)) return null
        if (!db.document(Paths.player(code, uid)).get().await().exists()) return null
        val total = GameConfig.DEFAULT.preguntasPorDia
        val respondidas = (0 until total).count { n ->
            db.document(Paths.answer(code, uid, dia, n)).get().await().getString("estado") == "cerrada"
        }
        if (respondidas >= total) return null
        val faltan = total - respondidas
        val cartas = if (faltan == 1) "te queda 1 carta" else "te quedan $faltan cartas"
        return "Día ${dia + 1} de 7 en «${grupo.nombre}»: $cartas por revelar antes de que termine el día."
    }
}
