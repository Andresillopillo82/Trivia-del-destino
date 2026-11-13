package com.triviadeldestino.app.game

import kotlinx.serialization.Serializable

/**
 * Modelo del juego: mismos conceptos y valores que src/game/types.ts de la web.
 * Esta capa es Kotlin puro (sin Android ni Firebase), así se prueba con JUnit en la JVM.
 */

/** Puntos y tiempos (igual que src/config/gameConfig.ts). */
data class GameConfig(
    /** Preguntas (cartas) por jugador y día. */
    val preguntasPorDia: Int = 3,
    val puntosCorrecta: Int = 5,
    val bonoRapidez: Int = 2,
    val umbralRapidezMs: Long = 8_000,
    val tiempoPreguntaMs: Long = 20_000,
    /** Pausa entre el registro de la pregunta en el servidor y el inicio del temporizador (cuenta atrás). */
    val pausaRevelacionMs: Long = 3_000,
    /** Comodines por día para cambiar la carta antes de ver la pregunta. */
    val comodinesPorDia: Int = 1,
    /** Aciertos del día que desbloquean el reto (uno por día). */
    val aciertosParaRetar: Int = 2,
    /** Para quien gana un reto. */
    val puntosReto: Int = 10,
    /** Lo que pierde quien falla una pregunta de reto. */
    val penalizacionReto: Int = 5,
    /** Probabilidad (%) de que devolver un reto salga bien: ms del servidor % 100 < este valor. */
    val porcentajeDevolucion: Int = 30,
    val diasTemporada: Int = 7,
    val maxRetosRecibidosPorDia: Int = 1,
) {
    companion object {
        val DEFAULT = GameConfig()
    }
}

enum class Nivel { normal, hard }

/** Pregunta tal como viene en questions.json. */
@Serializable
data class Question(
    val id: String,
    val categoria: String,
    val carta: String,
    val nivel: Nivel,
    val pregunta: String,
    val opciones: List<String>,
    val respuestaCorrecta: Int,
    val explicacion: String,
) {
    /** Carta (arcano) de la pregunta. */
    val card: CardId get() = requireNotNull(CardId.fromNombre(carta)) { "Carta desconocida: $carta" }
}

data class PlayerInfo(
    val uid: String,
    val apodo: String,
    val avatar: AvatarId,
    val esBot: Boolean,
)

/** carta (volteada, comodín disponible) → abierta (corre el tiempo) → cerrada. */
enum class AnswerState { carta, abierta, cerrada }

/** Respuesta a una de las 3 preguntas del día (documento `answers/{uid}_{dia}_{n}`). */
data class AnswerEvent(
    val uid: String,
    val dia: Int,
    /** Número de pregunta del día: 0, 1 o 2. */
    val n: Int,
    /** null mientras la carta no se abre (la pregunta se elige al pulsar "Ver la pregunta"). */
    val preguntaId: String?,
    val carta: CardId,
    /** true si en esta carta se usó el comodín del día. */
    val comodin: Boolean,
    val estado: AnswerState,
    /** Opción elegida; null si se agotó el tiempo o sigue abierta. */
    val opcion: Int?,
    val correcta: Boolean,
    val tiempoMs: Long,
    /** uid del compañero retado ese día (en la respuesta que desbloqueó el reto). */
    val retoPara: String?,
    /** Hora del servidor en que se abrió la pregunta. */
    val reveladoEnMs: Long? = null,
)

/** pendiente → (devuelto) → abierto → resuelto. */
enum class ChallengeState { pendiente, devuelto, abierto, resuelto }

/**
 * Reto (documento `challenges/{para}_{dia}`). Si la devolución falla, el retado responde además
 * la pregunta extra `challenges/{para}_{dia}_2`.
 */
data class ChallengeEvent(
    val id: String,
    val de: String,
    val para: String,
    val dia: Int,
    val preguntaId: String,
    val carta: CardId,
    val estado: ChallengeState,
    /** true en la segunda pregunta del doble reto. */
    val extra: Boolean,
    /** Hora del servidor en que el retado lo devolvió (null si no lo devolvió o aún no se confirma). */
    val devueltoEnMs: Long?,
    val correcta: Boolean?,
    val tiempoMs: Long?,
    /** Hora del servidor en que el retado lo abrió. */
    val abiertoEnMs: Long? = null,
)

/** Resultado de responder una pregunta. */
data class AnswerResult(val opcion: Int?, val correcta: Boolean, val tiempoMs: Long)

data class StandingRow(
    val uid: String,
    val apodo: String,
    val avatar: AvatarId,
    val esBot: Boolean,
    val puntos: Int,
    val aciertos: Int,
    val respondidas: Int,
    val tiempoPromedioMs: Double?,
    /** Aciertos seguidos que lleva ahora (preguntas del día, en orden). */
    val rachaActual: Int,
    /** Mayor número de aciertos seguidos. */
    val mejorRacha: Int,
    val retosLanzados: Int,
    val retosGanados: Int,
    /** 1 = primero; empatados en todos los criterios comparten posición. */
    val posicion: Int,
)

data class Titles(
    val duenoDelDestino: StandingRow?,
    val vidente: StandingRow?,
    val retador: StandingRow?,
)
