package com.triviadeldestino.app.game

import java.time.Instant
import java.time.ZoneId
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

// ---------- Día de temporada (src/game/day.ts) ----------

const val MS_DIA = 86_400_000L

/**
 * Día de temporada (0 = primer día). Misma fórmula que la web y que firestore.rules:
 * floor((ahora − fechaInicio) / 24 h) + dayOffset.
 */
fun seasonDay(fechaInicioMs: Long, dayOffset: Int, nowMs: Long): Int {
    val transcurridos = floor((nowMs - fechaInicioMs).toDouble() / MS_DIA).toInt()
    return max(0, transcurridos + dayOffset)
}

fun isSeasonOver(day: Int, config: GameConfig = GameConfig.DEFAULT): Boolean = day >= config.diasTemporada

/** Milisegundos que faltan para el siguiente día de temporada. */
fun msUntilNextDay(fechaInicioMs: Long, nowMs: Long): Long {
    val transcurrido = Math.floorMod(nowMs - fechaInicioMs, MS_DIA)
    return MS_DIA - transcurrido
}

/** Medianoche local del día que contiene `nowMs`. */
fun startOfLocalDay(nowMs: Long, zona: ZoneId = ZoneId.systemDefault()): Long =
    Instant.ofEpochMilli(nowMs).atZone(zona).toLocalDate().atStartOfDay(zona).toInstant().toEpochMilli()

// ---------- Puntuación y tiempo (src/game/scoring.ts) ----------

/** Evalúa una respuesta. `opcion` null significa que se agotó el tiempo. */
fun evaluateAnswer(question: Question, opcion: Int?, tiempoMs: Long, config: GameConfig = GameConfig.DEFAULT): AnswerResult {
    val tiempo = min(max(0L, tiempoMs), config.tiempoPreguntaMs)
    if (opcion == null || tiempo >= config.tiempoPreguntaMs) return timeoutResult(config)
    return AnswerResult(opcion, opcion == question.respuestaCorrecta, tiempo)
}

fun timeoutResult(config: GameConfig = GameConfig.DEFAULT) = AnswerResult(null, false, config.tiempoPreguntaMs)

/** +5 por acertar y +2 extra si fue en menos de 8 s. */
fun dailyPoints(correcta: Boolean, tiempoMs: Long, config: GameConfig = GameConfig.DEFAULT): Int {
    if (!correcta) return 0
    return config.puntosCorrecta + if (tiempoMs < config.umbralRapidezMs) config.bonoRapidez else 0
}

/** Tiempo de la pregunta: el temporizador arranca `pausaRevelacionMs` después de abrirla en el servidor. */
fun elapsedMs(revealedAtMs: Long, nowMs: Long, config: GameConfig = GameConfig.DEFAULT): Long =
    max(0L, nowMs - revealedAtMs - config.pausaRevelacionMs)

fun remainingMs(revealedAtMs: Long, nowMs: Long, config: GameConfig = GameConfig.DEFAULT): Long =
    max(0L, config.tiempoPreguntaMs - elapsedMs(revealedAtMs, nowMs, config))

fun isExpired(revealedAtMs: Long, nowMs: Long, config: GameConfig = GameConfig.DEFAULT): Boolean =
    remainingMs(revealedAtMs, nowMs, config) <= 0L

// ---------- Sorteo de la carta (src/game/draw.ts) ----------

data class Draw(val card: CardId, val question: Question)

private fun disponiblesPorCarta(questions: List<Question>, seenIds: Set<String>, nivel: Nivel): Map<CardId, List<Question>> =
    questions.filter { it.nivel == nivel && it.id !in seenIds }.groupBy { it.card }

/**
 * Carta al azar entre las que aún tienen preguntas sin ver para el jugador. `excluir` deja fuera
 * cartas (el comodín cambia a otra categoría). null si no queda ninguna.
 */
fun drawCard(
    questions: List<Question>,
    seenIds: Set<String>,
    random: Random,
    excluir: Set<CardId> = emptySet(),
    nivel: Nivel = Nivel.normal,
): CardId? {
    val disponibles = disponiblesPorCarta(questions, seenIds, nivel)
    // En el orden de CardId para que el resultado solo dependa del generador aleatorio.
    val cartas = CardId.entries.filter { it in disponibles && it !in excluir }
    return if (cartas.isEmpty()) null else cartas.random(random)
}

/** Pregunta no vista de la carta indicada (se elige al pulsar "Ver la pregunta"). */
fun drawQuestionForCard(questions: List<Question>, seenIds: Set<String>, card: CardId, random: Random, nivel: Nivel = Nivel.normal): Question? =
    disponiblesPorCarta(questions, seenIds, nivel)[card]?.random(random)

/** Carta y pregunta de una vez. */
fun drawQuestion(questions: List<Question>, seenIds: Set<String>, random: Random, nivel: Nivel = Nivel.normal): Draw? {
    val carta = drawCard(questions, seenIds, random, emptySet(), nivel) ?: return null
    return Draw(carta, drawQuestionForCard(questions, seenIds, carta, random, nivel)!!)
}

/** Preguntas que un jugador ya vio: sus respuestas, los retos recibidos y los que le devolvieron. */
fun seenQuestionIds(uid: String, answers: List<AnswerEvent>, challenges: List<ChallengeEvent>): Set<String> =
    buildSet {
        answers.filter { it.uid == uid }.forEach { a -> a.preguntaId?.let(::add) }
        challenges.filter { it.para == uid || responsable(it) == uid }.forEach { add(it.preguntaId) }
    }

// ---------- Preguntas del día ----------

/** Respuestas del jugador en un día, en orden (0, 1, 2). */
fun answersOfDay(uid: String, dia: Int, answers: List<AnswerEvent>): List<AnswerEvent> =
    answers.filter { it.uid == uid && it.dia == dia }.sortedBy { it.n }

/** Id del documento de una respuesta: `{uid}_{dia}_{n}`. */
fun answerId(uid: String, dia: Int, n: Int) = "${uid}_${dia}_$n"

// ---------- Retos (src/game/challenges.ts) ----------

/** Id determinista: un jugador recibe como máximo un reto por día. */
fun challengeId(para: String, dia: Int) = "${para}_$dia"

/** Id de la segunda pregunta del doble reto. */
fun extraChallengeId(para: String, dia: Int) = "${para}_${dia}_2"

/** ¿La devolución salió bien? Milisegundos del servidor % 100 < 30, igual que la web y firestore.rules. */
fun devolucionExitosa(devueltoEnMs: Long, config: GameConfig = GameConfig.DEFAULT): Boolean =
    Math.floorMod(devueltoEnMs, 100L) < config.porcentajeDevolucion

/** Reto principal devuelto cuya devolución falló: el retado responde dos preguntas. */
fun esDobleReto(c: ChallengeEvent, config: GameConfig = GameConfig.DEFAULT): Boolean =
    !c.extra && c.devueltoEnMs != null && !devolucionExitosa(c.devueltoEnMs, config)

/** Quién debe responder: el retador si le devolvieron el reto con éxito; si no, el retado. */
fun responsable(c: ChallengeEvent, config: GameConfig = GameConfig.DEFAULT): String =
    if (!c.extra && c.devueltoEnMs != null && devolucionExitosa(c.devueltoEnMs, config)) c.de else c.para

fun baseOf(extra: ChallengeEvent, challenges: List<ChallengeEvent>): ChallengeEvent? =
    challenges.firstOrNull { it.id == challengeId(extra.para, extra.dia) }

/** Los retos principales siempre cuentan; la pregunta extra, solo si la devolución falló. */
fun isRequired(c: ChallengeEvent, challenges: List<ChallengeEvent>, config: GameConfig = GameConfig.DEFAULT): Boolean =
    !c.extra || baseOf(c, challenges)?.let { esDobleReto(it, config) } == true

/** Se devuelve un reto recibido que aún no se abrió; ni uno devuelto ni la pregunta extra. */
fun canReturnChallenge(c: ChallengeEvent, uid: String): Boolean =
    c.para == uid && !c.extra && c.estado == ChallengeState.pendiente && c.devueltoEnMs == null

/** La respuesta que completa los 2 aciertos del día: solo una por día, así que un solo reto. */
fun unlockingAnswer(uid: String, dia: Int, answers: List<AnswerEvent>, config: GameConfig = GameConfig.DEFAULT): AnswerEvent? {
    var aciertos = 0
    for (a in answersOfDay(uid, dia, answers)) {
        if (a.estado != AnswerState.cerrada || !a.correcta) continue
        aciertos++
        if (aciertos == config.aciertosParaRetar) return a
    }
    return null
}

/** Se desbloquea un reto al día al acertar 2 preguntas, y solo se lanza uno. */
fun canSendChallenge(uid: String, dia: Int, answers: List<AnswerEvent>, config: GameConfig = GameConfig.DEFAULT): Boolean =
    unlockingAnswer(uid, dia, answers, config)?.let { it.retoPara == null } == true

/** Reto que el jugador lanzó ese día, si lo hizo. */
fun sentChallenge(uid: String, dia: Int, challenges: List<ChallengeEvent>): ChallengeEvent? =
    challenges.firstOrNull { it.de == uid && it.dia == dia && !it.extra }

fun receivedOnDay(uid: String, dia: Int, challenges: List<ChallengeEvent>): Int =
    challenges.count { it.para == uid && it.dia == dia && !it.extra }

/** Compañeros a los que se puede retar (no uno mismo ni quien ya recibió su reto del día). */
fun eligibleTargets(
    challengerUid: String,
    players: List<PlayerInfo>,
    challenges: List<ChallengeEvent>,
    dia: Int,
    config: GameConfig = GameConfig.DEFAULT,
): List<PlayerInfo> = players.filter { it.uid != challengerUid && receivedOnDay(it.uid, dia, challenges) < config.maxRetosRecibidosPorDia }

/** Pregunta difícil que el retado no vio; prefiere la carta indicada (la del retador ese día). */
fun pickChallengeQuestion(
    questions: List<Question>,
    seenByTarget: Set<String>,
    preferred: CardId?,
    random: Random,
): Question? {
    val libres = questions.filter { it.nivel == Nivel.hard && it.id !in seenByTarget }
    if (libres.isEmpty()) return null
    val preferidas = if (preferred != null) libres.filter { it.card == preferred } else emptyList()
    return (preferidas.ifEmpty { libres }).random(random)
}

/**
 * Preguntas de reto que el jugador debe responder (obligatorias antes de sacar otra carta), de la
 * más antigua a la más nueva: incluye los retos que le devolvieron y la extra de un doble reto.
 */
fun pendingChallengesFor(uid: String, challenges: List<ChallengeEvent>, config: GameConfig = GameConfig.DEFAULT): List<ChallengeEvent> =
    challenges
        .filter { it.estado != ChallengeState.resuelto && responsable(it, config) == uid && isRequired(it, challenges, config) }
        .sortedWith(compareBy<ChallengeEvent> { it.dia }.thenBy { it.extra })

/**
 * Clase de pregunta de reto, para los textos de la interfaz (igual que tipoReto de la web):
 * reto (recibido, sin devolver o aún sin hora del servidor), devuelto (lo responde el retador),
 * doble (1.ª del doble reto) o extra (2.ª del doble reto).
 */
enum class TipoReto { reto, devuelto, doble, extra }

fun tipoReto(c: ChallengeEvent, config: GameConfig = GameConfig.DEFAULT): TipoReto = when {
    c.extra -> TipoReto.extra
    c.devueltoEnMs == null -> TipoReto.reto
    devolucionExitosa(c.devueltoEnMs, config) -> TipoReto.devuelto
    else -> TipoReto.doble
}

private enum class Resultado { acierto, fallo, pendiente }

/** Una pregunta sin responder al cerrar la temporada cuenta como fallo. */
private fun resultado(c: ChallengeEvent?, seasonClosed: Boolean): Resultado = when {
    c?.estado == ChallengeState.resuelto -> if (c.correcta == true) Resultado.acierto else Resultado.fallo
    seasonClosed -> Resultado.fallo
    else -> Resultado.pendiente
}

data class ChallengeScore(val uid: String, val puntos: Int, val gano: Boolean)

/**
 * Puntos de un reto y, si hubo doble reto, de su pregunta extra (igual que scoreChallenge de la web):
 * - Sin devolver: el retado que acierta gana el premio; si falla pierde 5 y el premio es del retador.
 * - Devuelto con éxito: responde el retador sin premio; si falla pierde 5.
 * - Devolución fallida: gana el premio una vez si acierta alguna y pierde 5 por cada fallo;
 *   si falla las dos, el premio es del retador.
 */
fun scoreChallenge(base: ChallengeEvent, extra: ChallengeEvent?, seasonClosed: Boolean, config: GameConfig = GameConfig.DEFAULT): List<ChallengeScore> {
    fun premio(uid: String) = ChallengeScore(uid, config.puntosReto, true)
    fun castigo(uid: String, veces: Int = 1) = ChallengeScore(uid, -config.penalizacionReto * veces, false)

    val devuelto = base.devueltoEnMs
    if (devuelto == null) {
        return when (resultado(base, seasonClosed)) {
            Resultado.acierto -> listOf(premio(base.para))
            Resultado.fallo -> listOf(castigo(base.para), premio(base.de))
            Resultado.pendiente -> emptyList()
        }
    }
    if (devolucionExitosa(devuelto, config)) {
        return if (resultado(base, seasonClosed) == Resultado.fallo) listOf(castigo(base.de)) else emptyList()
    }
    val rs = listOf(resultado(base, seasonClosed), resultado(extra, seasonClosed))
    val fallos = rs.count { it == Resultado.fallo }
    return buildList {
        if (fallos > 0) add(castigo(base.para, fallos))
        if (Resultado.acierto in rs) add(premio(base.para)) else if (fallos == rs.size) add(premio(base.de))
    }
}

// ---------- Validaciones (src/game/validation.ts) ----------

const val APODO_MIN = 2
const val APODO_MAX = 16

fun cleanText(input: String): String = input.replace(Regex("[\\u0000-\\u001f\\u007f]"), "").replace(Regex("\\s+"), " ").trim()

/** Mensaje de error en español, o null si el apodo es válido. */
fun validateApodo(input: String): String? {
    val largo = cleanText(input).codePointCount(0, cleanText(input).length)
    return when {
        largo < APODO_MIN -> "El apodo debe tener al menos $APODO_MIN caracteres."
        largo > APODO_MAX -> "El apodo puede tener como máximo $APODO_MAX caracteres."
        else -> null
    }
}

// ---------- Códigos de grupo (src/game/codes.ts) ----------

const val CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const val CODE_LENGTH = 5

fun normalizeGroupCode(input: String): String = input.uppercase().replace(Regex("[\\s-]"), "")

fun isValidGroupCode(code: String): Boolean = code.length == CODE_LENGTH && code.all { it in CODE_ALPHABET }

/** Extrae el código de un enlace de invitación (…/unirse/A7K2Q) o de un código escrito a mano. */
fun groupCodeFrom(texto: String): String? {
    val candidato = Regex("/unirse/([A-Za-z0-9]{5})").find(texto)?.groupValues?.get(1) ?: texto
    return normalizeGroupCode(candidato).takeIf(::isValidGroupCode)
}

const val ADMIN_KEY_LENGTH = 8

fun generateGroupCode(random: Random = Random.Default): String =
    (1..CODE_LENGTH).map { CODE_ALPHABET[random.nextInt(CODE_ALPHABET.length)] }.joinToString("")

/** Clave de administración del grupo (8 caracteres): permite administrarlo desde la web. */
fun generateAdminKey(random: Random = Random.Default): String =
    (1..ADMIN_KEY_LENGTH).map { CODE_ALPHABET[random.nextInt(CODE_ALPHABET.length)] }.joinToString("")

const val NOMBRE_GRUPO_MIN = 3
const val NOMBRE_GRUPO_MAX = 30

fun validateGroupName(input: String): String? {
    val limpio = cleanText(input)
    val largo = limpio.codePointCount(0, limpio.length)
    return when {
        largo < NOMBRE_GRUPO_MIN -> "El nombre del grupo debe tener al menos $NOMBRE_GRUPO_MIN caracteres."
        largo > NOMBRE_GRUPO_MAX -> "El nombre del grupo puede tener como máximo $NOMBRE_GRUPO_MAX caracteres."
        else -> null
    }
}
