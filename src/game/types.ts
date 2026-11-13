import type { AvatarId } from './avatars'
import type { CardId } from './cards'

export type Nivel = 'normal' | 'hard'

/** Pregunta tal como viene en src/data/questions.json. */
export interface Question {
  id: string
  categoria: string
  /** Nombre de la carta ("El Loco"). */
  carta: string
  nivel: Nivel
  pregunta: string
  opciones: string[]
  /** Índice (0–3) de la opción correcta. */
  respuestaCorrecta: number
  explicacion: string
}

export interface PlayerInfo {
  uid: string
  apodo: string
  avatar: AvatarId
  esBot: boolean
  /** Probabilidad de acierto (0–1); solo bots. */
  habilidad?: number
}

/**
 * Respuesta a una de las preguntas del día (id `${uid}_${dia}_${n}`). Ciclo de vida:
 * "carta" (se volteó la carta; aún se puede usar el comodín) → "abierta" (se vio la pregunta y
 * corre el tiempo) → "cerrada" (respondida o tiempo agotado). Cada paso ocurre una sola vez.
 */
export interface AnswerEvent {
  uid: string
  dia: number
  /** Número de pregunta del día (0, 1 o 2). */
  n: number
  /** null mientras la carta no se abre: la pregunta se elige al pulsar "Ver la pregunta". */
  preguntaId: string | null
  carta: CardId
  /** true si en esta carta se usó el comodín del día. */
  comodin: boolean
  estado: AnswerState
  /** Opción elegida; null si se agotó el tiempo o sigue abierta. */
  opcion: number | null
  correcta: boolean
  tiempoMs: number
  /** uid del compañero retado ese día; se marca en la respuesta que desbloqueó el reto. */
  retoPara: string | null
}

export type AnswerState = 'carta' | 'abierta' | 'cerrada'

/**
 * - pendiente: el retado aún no lo abre (puede responderlo o devolverlo).
 * - devuelto: el retado lo devolvió; según `devueltoEnMs` le toca al retador o al retado (doble reto).
 * - abierto: quien debe responder vio la pregunta y corre su tiempo.
 * - resuelto: respondido.
 */
export type ChallengeState = 'pendiente' | 'devuelto' | 'abierto' | 'resuelto'

/**
 * Reto: id determinista `${para}_${dia}` (un reto recibido por día). Si la devolución falla,
 * el retado responde además una segunda pregunta: un reto "extra" con id `${para}_${dia}_2`
 * (se crea junto con la devolución y solo cuenta si la devolución falló).
 */
export interface ChallengeEvent {
  id: string
  de: string
  para: string
  dia: number
  preguntaId: string
  carta: CardId
  estado: ChallengeState
  /** true en la segunda pregunta del doble reto. */
  extra: boolean
  /** Hora del servidor (ms) en que el retado lo devolvió; null si no lo devolvió. */
  devueltoEnMs: number | null
  /** Solo cuando está resuelto. */
  correcta: boolean | null
  tiempoMs: number | null
}

/** Resultado de responder una pregunta (diaria o reto). */
export interface AnswerResult {
  opcion: number | null
  correcta: boolean
  tiempoMs: number
}

export interface StandingRow {
  uid: string
  apodo: string
  avatar: AvatarId
  esBot: boolean
  puntos: number
  /** Preguntas diarias acertadas. */
  aciertos: number
  /** Preguntas diarias respondidas (cerradas). */
  respondidas: number
  /** Promedio de tiempo de las preguntas diarias respondidas; null si no hay ninguna. */
  tiempoPromedioMs: number | null
  /** Aciertos seguidos (preguntas diarias, en orden) que lleva ahora. */
  rachaActual: number
  /** Mayor número de aciertos seguidos de la temporada. */
  mejorRacha: number
  retosLanzados: number
  /** Retos en los que este jugador se llevó los puntos del reto. */
  retosGanados: number
  /** Posición (1 = primero). Jugadores empatados en todos los criterios comparten posición. */
  posicion: number
}

export interface Titles {
  /** "Dueño del Destino": primero de la clasificación. */
  duenoDelDestino: StandingRow | null
  /** "El Vidente": más aciertos seguidos. */
  vidente: StandingRow | null
  /** "El Retador": más retos ganados. */
  retador: StandingRow | null
}
