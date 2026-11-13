package com.triviadeldestino.app.game

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/*
 * Partida Rápida: salas temporales por código, independientes de los grupos. Es la misma lógica que
 * la web (src/game/quick); ParityTest exige los mismos resultados con la misma semilla.
 */

/** Tramo de dificultad: desde la pregunta `desde` (1-based), esta proporción es de nivel hard. */
data class QuickDifficultyStep(val desde: Int, val hard: Double)

data class QuickMatchConfig(
    val startSeconds: Int = 45,
    val correctBonus: Int = 2,
    val wrongPenalty: Int = 2,
    /** Techo del reloj (segundos restantes); null = sin techo. */
    val maxSeconds: Int? = 60,
    val hardTimeoutMs: Long = 300_000,
    val maxPlayers: Int = 20,
    val maxBots: Int = 6,
    val feedbackMs: Long = 250,
    val syncEveryMs: Long = 5_000,
    val roomTtlMs: Long = 6L * 60 * 60 * 1000,
    val difficulty: List<QuickDifficultyStep> = listOf(
        QuickDifficultyStep(1, 0.0),
        QuickDifficultyStep(6, 0.25),
        QuickDifficultyStep(11, 0.5),
        QuickDifficultyStep(16, 0.75),
        QuickDifficultyStep(21, 1.0),
    ),
) {
    companion object {
        val DEFAULT = QuickMatchConfig()
    }
}

// ---------------------------------------------------------------- PRNG (igual que src/game/rng.ts)

/** mulberry32: mismo generador que la web, para que la secuencia sea idéntica. */
class SeededRng(seed: Long) {
    private var a = seed.toInt()

    fun next(): Double {
        a += 0x6D2B79F5
        var t = a
        t = (t xor (t ushr 15)) * (t or 1)
        t = t xor (t + (t xor (t ushr 7)) * (t or 61))
        return ((t xor (t ushr 14)).toLong() and 0xFFFFFFFFL).toDouble() / 4294967296.0
    }

    fun randInt(min: Int, maxInclusive: Int): Int = min + floor(next() * (maxInclusive - min + 1)).toInt()

    fun chance(p: Double): Boolean = next() < p
}

/** FNV-1a de 32 bits sobre unidades UTF-16 (igual que hashString de la web). */
fun hashString(s: String): Long {
    var h = 2166136261L.toInt()
    for (c in s) {
        h = h xor c.code
        h *= 16777619
    }
    return h.toLong() and 0xFFFFFFFFL
}

/** Semilla nueva (entero de 32 bits sin signo). */
fun newQuickSeed(random: kotlin.random.Random = kotlin.random.Random.Default): Long =
    random.nextInt().toLong() and 0xFFFFFFFFL

/** Código de sala desde un enlace (…/rapida/ABCDE o …/sala/ABCDE/pantalla) o escrito a mano. */
fun quickCodeFrom(texto: String): String? {
    val candidato = Regex("/(?:rapida|sala)/([A-Za-z0-9]{5})").find(texto)?.groupValues?.get(1)
        ?: texto.takeIf { !it.contains('/') }
        ?: return null
    return normalizeGroupCode(candidato).takeIf(::isValidGroupCode)
}

// ---------------------------------------------------------------- Secuencia

private const val BLOQUE_ABIERTO = 5

private fun planTramo(pos: Int, steps: List<QuickDifficultyStep>, rng: SeededRng): BooleanArray {
    var s = -1
    steps.forEachIndexed { i, st -> if (st.desde <= pos) s = i }
    val siguiente = steps.getOrNull(s + 1)
    val tam = if (siguiente != null) siguiente.desde - pos else BLOQUE_ABIERTO
    val p = if (s >= 0) steps[s].hard else 0.0
    val k = floor(p * tam + 0.5).toInt()
    val idx = IntArray(tam) { it }
    for (j in 0 until k) {
        val r = j + floor(rng.next() * (tam - j)).toInt()
        val t = idx[j]
        idx[j] = idx[r]
        idx[r] = t
    }
    val flags = BooleanArray(tam)
    for (j in 0 until k) flags[idx[j]] = true
    return flags
}

private fun elegir(
    questions: List<Question>,
    hard: Boolean,
    usadas: Set<String>,
    evitar: Set<String>,
    ultimaCarta: String?,
    rng: SeededRng,
): Question? {
    val nivel = if (hard) Nivel.hard else Nivel.normal
    val filtros: List<(Question) -> Boolean> = listOf(
        { q -> q.nivel == nivel && q.id !in usadas && q.id !in evitar && q.carta != ultimaCarta },
        { q -> q.nivel == nivel && q.id !in usadas && q.carta != ultimaCarta },
        { q -> q.id !in usadas && q.id !in evitar && q.carta != ultimaCarta },
        { q -> q.id !in usadas && q.carta != ultimaCarta },
    )
    for (f in filtros) {
        val c = questions.filter(f)
        if (c.isNotEmpty()) return c[floor(rng.next() * c.size).toInt()]
    }
    return null
}

/**
 * Secuencia determinista de la Partida Rápida: misma semilla ⇒ mismas preguntas para todos (web y
 * Android). Sin repetir, sin dos cartas seguidas iguales y con dificultad progresiva. El prefijo no
 * depende de `length`, así que se puede generar bajo demanda.
 */
fun buildQuickSequence(
    seed: Long,
    questions: List<Question>,
    difficulty: List<QuickDifficultyStep>,
    length: Int,
    evitar: List<String> = emptyList(),
): List<Question> {
    require(questions.isNotEmpty()) { "buildQuickSequence: banco vacío" }
    val rng = SeededRng(seed)
    val evitarSet = evitar.toHashSet()
    val usadas = HashSet<String>()
    val seq = ArrayList<Question>(length)
    var tramo = BooleanArray(0)
    var t = 0
    while (seq.size < length) {
        if (t >= tramo.size) {
            tramo = planTramo(seq.size + 1, difficulty, rng)
            t = 0
        }
        val hard = tramo[t++]
        val ultima = seq.lastOrNull()?.carta
        var q = elegir(questions, hard, usadas, evitarSet, ultima, rng)
        if (q == null) {
            // Banco agotado (o solo queda la carta anterior): empieza otra vuelta del mazo.
            usadas.clear()
            q = elegir(questions, hard, usadas, evitarSet, ultima, rng) ?: elegir(questions, hard, usadas, evitarSet, null, rng)!!
        }
        usadas.add(q.id)
        seq.add(q)
    }
    return seq
}

// ---------------------------------------------------------------- Reloj

/** Reloj de un jugador. Los tiempos son de un reloj monotónico (SystemClock.elapsedRealtime). */
data class QuickClock(val deadlineMs: Long, val correctas: Int = 0, val falladas: Int = 0, val finished: Boolean = false)

fun startClock(config: QuickMatchConfig, nowMs: Long) = QuickClock(nowMs + config.startSeconds * 1000L)

fun remainingMs(state: QuickClock, nowMs: Long): Long = if (state.finished) 0 else max(0, state.deadlineMs - nowMs)

fun tick(state: QuickClock, nowMs: Long): QuickClock =
    if (!state.finished && nowMs >= state.deadlineMs) state.copy(finished = true) else state

/** Acierto +bonus (sin pasar de maxSeconds), fallo −penalización; una respuesta con 0 s no cuenta. */
fun applyAnswer(state: QuickClock, correct: Boolean, nowMs: Long, config: QuickMatchConfig): QuickClock {
    if (state.finished) return state
    if (nowMs >= state.deadlineMs) return state.copy(finished = true)
    if (correct) {
        var d = state.deadlineMs + config.correctBonus * 1000L
        config.maxSeconds?.let { d = min(d, nowMs + it * 1000L) }
        return state.copy(deadlineMs = d, correctas = state.correctas + 1)
    }
    val d = state.deadlineMs - config.wrongPenalty * 1000L
    return QuickClock(d, state.correctas, state.falladas + 1, d <= nowMs)
}

// ---------------------------------------------------------------- Sala

enum class QuickStatus { lobby, playing, finished }

data class QuickRoom(
    val code: String,
    val hostUid: String,
    val hostPlays: Boolean,
    val status: QuickStatus,
    val round: Int,
    val seed: Long,
    val config: QuickMatchConfig,
    val evitar: List<String>,
    val createdAtMs: Long,
    val startedAtMs: Long?,
    val expiresAtMs: Long,
)

data class QuickPlayer(
    val uid: String,
    val apodo: String,
    val avatar: AvatarId,
    val esBot: Boolean,
    val round: Int,
    val correctas: Int,
    val falladas: Int,
    val finished: Boolean,
)

enum class JoinCheck { ok, expirada, empezada, llena, dentro }

fun newRoom(code: String, hostUid: String, hostPlays: Boolean, seed: Long, nowMs: Long, config: QuickMatchConfig = QuickMatchConfig.DEFAULT) =
    QuickRoom(code, hostUid, hostPlays, QuickStatus.lobby, 1, seed, config, emptyList(), nowMs, null, nowMs + config.roomTtlMs)

fun isExpired(room: QuickRoom, nowMs: Long) = nowMs >= room.expiresAtMs

fun playersOfRound(room: QuickRoom, players: List<QuickPlayer>) = players.filter { it.round == room.round }

fun canJoin(room: QuickRoom, players: List<QuickPlayer>, uid: String, nowMs: Long): JoinCheck = when {
    isExpired(room, nowMs) -> JoinCheck.expirada
    players.any { it.uid == uid } -> JoinCheck.dentro
    room.status != QuickStatus.lobby -> JoinCheck.empezada
    players.count { !it.esBot } >= room.config.maxPlayers -> JoinCheck.llena
    else -> JoinCheck.ok
}

/** Al menos un jugador en la ronda, y el anfitrión (si juega) y los bots ya en la ronda actual. */
fun canStart(room: QuickRoom, players: List<QuickPlayer>) =
    room.status == QuickStatus.lobby && playersOfRound(room, players).isNotEmpty() &&
        (!room.hostPlays || players.any { it.uid == room.hostUid && it.round == room.round }) &&
        players.filter { it.esBot }.all { it.round == room.round }

fun hardDeadlineMs(room: QuickRoom): Long? = room.startedAtMs?.let { it + room.config.hardTimeoutMs }

fun stillPlaying(room: QuickRoom, players: List<QuickPlayer>) = playersOfRound(room, players).count { !it.finished }

fun shouldFinish(room: QuickRoom, players: List<QuickPlayer>, nowMs: Long): Boolean {
    if (room.status != QuickStatus.playing) return false
    val limite = hardDeadlineMs(room)
    if (limite != null && nowMs >= limite) return true
    val ronda = playersOfRound(room, players)
    return ronda.isNotEmpty() && ronda.all { it.finished }
}

/** Preguntas que vio alguien en la ronda (las que evitará la revancha). */
fun usedQuestionIds(room: QuickRoom, players: List<QuickPlayer>, questions: List<Question>): List<String> {
    val maxN = playersOfRound(room, players).maxOfOrNull { it.correctas + it.falladas + 1 } ?: 0
    return buildQuickSequence(room.seed, questions, room.config.difficulty, maxN, room.evitar).map { it.id }
}

// ---------------------------------------------------------------- Ranking

data class QuickRankRow(val player: QuickPlayer, val posicion: Int)

private fun compara(a: QuickPlayer, b: QuickPlayer): Int =
    (b.correctas - a.correctas).takeIf { it != 0 } ?: (a.falladas - b.falladas)

/** Más aciertos; desempate, menos fallos; si persiste, empate (mismo puesto). */
fun rankQuick(players: List<QuickPlayer>): List<QuickRankRow> {
    val orden = players.sortedWith { a, b -> compara(a, b).takeIf { it != 0 } ?: a.uid.compareTo(b.uid) }
    return orden.map { p -> QuickRankRow(p, 1 + orden.count { compara(it, p) < 0 }) }
}

fun quickWinners(players: List<QuickPlayer>) = rankQuick(players).filter { it.posicion == 1 }.map { it.player }

// ---------------------------------------------------------------- Bots

/** Mismos bots que la web (src/game/bots.ts), con su habilidad y rango de tiempo de respuesta. */
data class QuickBotProfile(val uid: String, val apodo: String, val avatar: AvatarId, val habilidad: Double, val minMs: Int, val maxMs: Int)

val QUICK_BOTS = listOf(
    QuickBotProfile("bot-onix", "Oráculo Ónix", AvatarId.OJO, 0.85, 3_000, 9_000),
    QuickBotProfile("bot-luna", "Luna Errante", AvatarId.LUNA, 0.72, 5_000, 14_000),
    QuickBotProfile("bot-sibila", "Sibila de Neón", AvatarId.ESTRELLA, 0.62, 2_500, 7_000),
    QuickBotProfile("bot-merlin", "Merlín de Bolsillo", AvatarId.LLAVE, 0.5, 6_000, 16_000),
    QuickBotProfile("bot-tito", "Tito Tarot", AvatarId.COPA, 0.4, 4_000, 18_000),
    QuickBotProfile("bot-casandra", "Casandra", AvatarId.ROSA, 0.3, 7_000, 19_000),
)

private const val FACTOR_TIEMPO = 0.6
private const val FACTOR_HARD = 0.7

data class QuickBotEvent(val atMs: Long, val correcta: Boolean)

data class QuickBotRun(val uid: String, val eventos: List<QuickBotEvent>, val finMs: Long)

/** Simula la partida completa de un bot (determinista: misma semilla y bot ⇒ misma partida). */
fun simulateQuickBot(bot: QuickBotProfile, seed: Long, questions: List<Question>, config: QuickMatchConfig, evitar: List<String> = emptyList()): QuickBotRun {
    val rng = SeededRng((seed xor hashString(bot.uid)) and 0xFFFFFFFFL)
    val minMs = floor(bot.minMs * FACTOR_TIEMPO + 0.5).toInt()
    val maxMs = floor(bot.maxMs * FACTOR_TIEMPO + 0.5).toInt()
    val seq = buildQuickSequence(seed, questions, config.difficulty, ceil(config.hardTimeoutMs.toDouble() / minMs).toInt() + 1, evitar)
    var reloj = startClock(config, 0)
    val eventos = ArrayList<QuickBotEvent>()
    var t = 0L
    for (q in seq) {
        t += rng.randInt(minMs, maxMs)
        if (t >= reloj.deadlineMs || t >= config.hardTimeoutMs) break
        val correcta = rng.chance(if (q.nivel == Nivel.hard) bot.habilidad * FACTOR_HARD else bot.habilidad)
        reloj = applyAnswer(reloj, correcta, t, config)
        eventos.add(QuickBotEvent(t, correcta))
        if (reloj.finished) return QuickBotRun(bot.uid, eventos, t)
    }
    return QuickBotRun(bot.uid, eventos, min(reloj.deadlineMs, config.hardTimeoutMs))
}

data class BotProgress(val correctas: Int, val falladas: Int, val finished: Boolean)

fun botProgress(run: QuickBotRun, elapsedMs: Long): BotProgress {
    var c = 0
    var f = 0
    for (e in run.eventos) {
        if (e.atMs > elapsedMs) break
        if (e.correcta) c++ else f++
    }
    return BotProgress(c, f, elapsedMs >= run.finMs)
}
