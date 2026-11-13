import { GAME_CONFIG, type GameConfig } from '../config/gameConfig'
import type { AnswerResult, Question } from './types'

/** Evalúa una respuesta. `opcion` null significa que se agotó el tiempo. */
export function evaluateAnswer(
  question: Question,
  opcion: number | null,
  tiempoMs: number,
  config: GameConfig = GAME_CONFIG,
): AnswerResult {
  const tiempo = Math.min(Math.max(0, Math.round(tiempoMs)), config.tiempoPreguntaMs)
  if (opcion === null || tiempo >= config.tiempoPreguntaMs) {
    return { opcion: null, correcta: false, tiempoMs: config.tiempoPreguntaMs }
  }
  return { opcion, correcta: opcion === question.respuestaCorrecta, tiempoMs: tiempo }
}

/** Resultado de una pregunta cuyo tiempo se agotó sin responder. */
export function timeoutResult(config: GameConfig = GAME_CONFIG): AnswerResult {
  return { opcion: null, correcta: false, tiempoMs: config.tiempoPreguntaMs }
}

/** Puntos de una pregunta del día: +5 si acierta, +2 extra si fue en menos de 8 s. */
export function dailyPoints(result: Pick<AnswerResult, 'correcta' | 'tiempoMs'>, config: GameConfig = GAME_CONFIG): number {
  if (!result.correcta) return 0
  return config.puntosCorrecta + (result.tiempoMs < config.umbralRapidezMs ? config.bonoRapidez : 0)
}

/**
 * Tiempo transcurrido de la pregunta: el temporizador arranca `pausaRevelacionMs` después
 * del registro en el servidor (`revealedAtMs`), cuando termina la animación de la carta.
 */
export function elapsedMs(revealedAtMs: number, nowMs: number, config: GameConfig = GAME_CONFIG): number {
  return Math.max(0, nowMs - revealedAtMs - config.pausaRevelacionMs)
}

/** Tiempo restante de una pregunta revelada en `revealedAtMs`. */
export function remainingMs(revealedAtMs: number, nowMs: number, config: GameConfig = GAME_CONFIG): number {
  return Math.max(0, config.tiempoPreguntaMs - elapsedMs(revealedAtMs, nowMs, config))
}

/** true si ya pasó el tiempo para responder (la respuesta abierta debe cerrarse como tiempo agotado). */
export function isExpired(revealedAtMs: number, nowMs: number, config: GameConfig = GAME_CONFIG): boolean {
  return remainingMs(revealedAtMs, nowMs, config) <= 0
}
