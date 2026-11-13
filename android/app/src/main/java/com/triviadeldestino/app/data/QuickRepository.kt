package com.triviadeldestino.app.data

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import com.triviadeldestino.app.game.AvatarId
import com.triviadeldestino.app.game.JoinCheck
import com.triviadeldestino.app.game.QuickBotProfile
import com.triviadeldestino.app.game.QuickDifficultyStep
import com.triviadeldestino.app.game.QuickMatchConfig
import com.triviadeldestino.app.game.QuickPlayer
import com.triviadeldestino.app.game.QuickRoom
import com.triviadeldestino.app.game.QuickStatus
import com.triviadeldestino.app.game.canJoin
import com.triviadeldestino.app.game.generateGroupCode
import com.triviadeldestino.app.game.groupCodeFrom
import com.triviadeldestino.app.game.newQuickSeed
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import java.util.Date

/*
 * Partida Rápida: salas temporales quickRooms/{code} con sus jugadores (igual que
 * src/services/quick.ts). No lee ni escribe nada de groups/ ni del perfil del Modo Destino.
 */

object QuickPaths {
    fun room(code: String) = "quickRooms/$code"
    fun players(code: String) = "quickRooms/$code/players"
    fun player(code: String, uid: String) = "quickRooms/$code/players/$uid"
}

// ---------- documentos ----------

fun quickRoomDoc(hostUid: String, hostPlays: Boolean, seed: Long, config: QuickMatchConfig, nowMs: Long): Map<String, Any?> = mapOf(
    "hostUid" to hostUid,
    "hostPlays" to hostPlays,
    "status" to "lobby",
    "round" to 1,
    "seed" to seed,
    "config" to configDoc(config),
    "evitar" to emptyList<String>(),
    "createdAt" to FieldValue.serverTimestamp(),
    "startedAt" to null,
    // Las reglas exigen creación + roomTtlMs (6 h).
    "expiresAt" to Timestamp(Date(nowMs + config.roomTtlMs)),
)

private fun configDoc(c: QuickMatchConfig): Map<String, Any?> = mapOf(
    "startSeconds" to c.startSeconds,
    "correctBonus" to c.correctBonus,
    "wrongPenalty" to c.wrongPenalty,
    "maxSeconds" to c.maxSeconds,
    "hardTimeoutMs" to c.hardTimeoutMs,
    "maxPlayers" to c.maxPlayers,
    "maxBots" to c.maxBots,
    "feedbackMs" to c.feedbackMs,
    "syncEveryMs" to c.syncEveryMs,
    "roomTtlMs" to c.roomTtlMs,
    "difficulty" to c.difficulty.map { mapOf("desde" to it.desde, "hard" to it.hard) },
)

fun quickPlayerDoc(apodo: String, avatar: AvatarId, esBot: Boolean, round: Int): Map<String, Any?> = mapOf(
    "apodo" to apodo,
    "avatar" to avatar.id,
    "esBot" to esBot,
    "round" to round,
    "correctas" to 0,
    "falladas" to 0,
    "finished" to false,
    "updatedAt" to FieldValue.serverTimestamp(),
)

/** Incluye la ronda: una escritura atrasada de la ronda anterior la rechazan las reglas. */
fun quickProgressPatch(round: Int, correctas: Int, falladas: Int, finished: Boolean): Map<String, Any?> = mapOf(
    "round" to round,
    "correctas" to correctas,
    "falladas" to falladas,
    "finished" to finished,
    "updatedAt" to FieldValue.serverTimestamp(),
)

private fun DocumentSnapshot.ms(campo: String): Long? =
    getTimestamp(campo, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)?.toDate()?.time

private fun readConfig(v: Any?): QuickMatchConfig {
    val d = QuickMatchConfig.DEFAULT
    val m = v as? Map<*, *> ?: return d
    fun int(k: String, def: Int) = (m[k] as? Number)?.toInt() ?: def
    fun long(k: String, def: Long) = (m[k] as? Number)?.toLong() ?: def
    val pasos = (m["difficulty"] as? List<*>)?.mapNotNull { p ->
        val pm = p as? Map<*, *> ?: return@mapNotNull null
        val desde = (pm["desde"] as? Number)?.toInt() ?: return@mapNotNull null
        val hard = (pm["hard"] as? Number)?.toDouble() ?: return@mapNotNull null
        QuickDifficultyStep(desde, hard)
    } ?: d.difficulty
    return QuickMatchConfig(
        startSeconds = int("startSeconds", d.startSeconds),
        correctBonus = int("correctBonus", d.correctBonus),
        wrongPenalty = int("wrongPenalty", d.wrongPenalty),
        maxSeconds = if (m.containsKey("maxSeconds") && m["maxSeconds"] == null) null else int("maxSeconds", d.maxSeconds ?: 60),
        hardTimeoutMs = long("hardTimeoutMs", d.hardTimeoutMs),
        maxPlayers = int("maxPlayers", d.maxPlayers),
        maxBots = int("maxBots", d.maxBots),
        feedbackMs = long("feedbackMs", d.feedbackMs),
        syncEveryMs = long("syncEveryMs", d.syncEveryMs),
        roomTtlMs = long("roomTtlMs", d.roomTtlMs),
        difficulty = pasos,
    )
}

fun DocumentSnapshot.toQuickRoom(): QuickRoom = QuickRoom(
    code = id,
    hostUid = getString("hostUid").orEmpty(),
    hostPlays = getBoolean("hostPlays") == true,
    status = when (getString("status")) {
        "playing" -> QuickStatus.playing
        "finished" -> QuickStatus.finished
        else -> QuickStatus.lobby
    },
    round = getLong("round")?.toInt() ?: 1,
    seed = getLong("seed") ?: 0,
    config = readConfig(get("config")),
    evitar = (get("evitar") as? List<*>)?.filterIsInstance<String>().orEmpty(),
    createdAtMs = ms("createdAt") ?: 0,
    startedAtMs = ms("startedAt"),
    expiresAtMs = ms("expiresAt") ?: 0,
)

fun DocumentSnapshot.toQuickPlayer(): QuickPlayer = QuickPlayer(
    uid = id,
    apodo = getString("apodo") ?: "¿?",
    avatar = AvatarId.fromId(getString("avatar")),
    esBot = getBoolean("esBot") == true,
    round = getLong("round")?.toInt() ?: 0,
    correctas = getLong("correctas")?.toInt() ?: 0,
    falladas = getLong("falladas")?.toInt() ?: 0,
    finished = getBoolean("finished") == true,
)

// ---------- repositorio ----------

class QuickRepository(private val db: FirebaseFirestore) {
    private fun room(code: String) = db.document(QuickPaths.room(code))
    private fun player(code: String, uid: String) = db.document(QuickPaths.player(code, uid))

    /** null si la sala no existe (o se cerró). */
    fun watchRoom(code: String): Flow<QuickRoom?> = room(code).asFlow().map { if (it.exists()) it.toQuickRoom() else null }

    /** Solo en el lobby, al terminar y en la pantalla de sala (durante la partida, solo el anfitrión). */
    fun watchPlayers(code: String): Flow<List<QuickPlayer>> = db.collection(QuickPaths.players(code)).asListFlow { it.toQuickPlayer() }

    fun parseCode(texto: String): String =
        groupCodeFrom(texto) ?: throw GameException("El código tiene 5 caracteres: letras y números (sin 0, O, 1 ni I).")

    /** Crea una sala con código único (transacción: no pisa una sala existente). */
    suspend fun create(uid: String, apodo: String, avatar: AvatarId, hostPlays: Boolean): String {
        val config = QuickMatchConfig.DEFAULT
        repeat(6) {
            val code = generateGroupCode()
            val creada = withTimeout(TIMEOUT_MS) {
                db.runTransaction { tx ->
                    val ref = room(code)
                    if (tx.get(ref).exists()) return@runTransaction false
                    tx.set(ref, quickRoomDoc(uid, hostPlays, newQuickSeed(), config, ServerClock.now()))
                    if (hostPlays) tx.set(player(code, uid), quickPlayerDoc(apodo, avatar, false, 1))
                    true
                }.await()
            }
            if (creada) return code
        }
        throw GameException("No se pudo generar un código de sala libre. Inténtalo de nuevo.")
    }

    /** Entra a una sala en el lobby (si ya estaba dentro, no hace nada). */
    suspend fun join(texto: String, uid: String, apodo: String, avatar: AvatarId): QuickRoom {
        val code = parseCode(texto)
        val snap = withTimeout(TIMEOUT_MS) { room(code).get(Source.SERVER).await() }
        if (!snap.exists()) throw GameException("No existe ninguna sala con ese código.")
        val sala = snap.toQuickRoom()
        val jugadores = withTimeout(TIMEOUT_MS) { db.collection(QuickPaths.players(code)).get(Source.SERVER).await() }.documents.map { it.toQuickPlayer() }
        when (canJoin(sala, jugadores, uid, ServerClock.now())) {
            JoinCheck.dentro -> return sala
            JoinCheck.expirada -> throw GameException("Esta sala ya caducó.")
            JoinCheck.empezada -> throw GameException("La partida ya empezó. Espera a la revancha.")
            JoinCheck.llena -> throw GameException("La sala está llena (máximo ${sala.config.maxPlayers} jugadores).")
            JoinCheck.ok -> Unit
        }
        withTimeout(TIMEOUT_MS) { player(code, uid).set(quickPlayerDoc(apodo, avatar, false, sala.round)).await() }
        return sala
    }

    /** Al empezar una ronda nueva (revancha), el jugador pone sus contadores a cero. */
    suspend fun resetPlayer(code: String, uid: String, round: Int) {
        player(code, uid).update(
            mapOf("round" to round, "correctas" to 0, "falladas" to 0, "finished" to false, "updatedAt" to FieldValue.serverTimestamp()),
        ).await()
    }

    suspend fun syncProgress(code: String, uid: String, round: Int, correctas: Int, falladas: Int, finished: Boolean) {
        player(code, uid).update(quickProgressPatch(round, correctas, falladas, finished)).await()
    }

    /** Lee una vez la ficha propia (al volver a abrir la sala en mitad de una partida). */
    suspend fun getPlayer(code: String, uid: String): QuickPlayer? {
        val snap = withTimeout(TIMEOUT_MS) { player(code, uid).get(Source.SERVER).await() }
        return if (snap.exists()) snap.toQuickPlayer() else null
    }

    /** Quien vuelve en mitad de la partida no puede volver a empezar: queda terminado. */
    suspend fun markFinished(code: String, uid: String) {
        player(code, uid).update(mapOf("finished" to true, "updatedAt" to FieldValue.serverTimestamp())).await()
    }

    suspend fun leave(code: String, uid: String) {
        player(code, uid).delete().await()
    }

    // ---------- anfitrión ----------

    suspend fun start(code: String) {
        withTimeout(TIMEOUT_MS) { room(code).update(mapOf("status" to "playing", "startedAt" to FieldValue.serverTimestamp())).await() }
    }

    suspend fun finish(code: String) {
        room(code).update("status", "finished").await()
    }

    /** Revancha: ronda siguiente, semilla nueva y las preguntas de esta ronda para evitarlas. */
    suspend fun rematch(sala: QuickRoom, evitar: List<String>) {
        withTimeout(TIMEOUT_MS) {
            room(sala.code).update(
                mapOf("status" to "lobby", "round" to sala.round + 1, "seed" to newQuickSeed(), "evitar" to evitar, "startedAt" to null),
            ).await()
        }
    }

    suspend fun addBot(code: String, bot: QuickBotProfile, round: Int) {
        withTimeout(TIMEOUT_MS) { player(code, bot.uid).set(quickPlayerDoc(bot.apodo, bot.avatar, true, round)).await() }
    }

    suspend fun remove(code: String, uid: String) {
        player(code, uid).delete().await()
    }

    /** Cierra la sala: borra a todos los jugadores y la sala en un lote. */
    suspend fun close(code: String) {
        val jugadores = withTimeout(TIMEOUT_MS) { db.collection(QuickPaths.players(code)).get(Source.SERVER).await() }
        val batch = db.batch()
        jugadores.documents.forEach { batch.delete(it.reference) }
        batch.delete(room(code))
        withTimeout(TIMEOUT_MS) { batch.commit().await() }
    }
}
