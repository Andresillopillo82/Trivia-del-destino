import type { QuickMatchConfig } from '../../config/gameConfig'

type ClockConfig = Pick<QuickMatchConfig, 'startSeconds' | 'correctBonus' | 'wrongPenalty' | 'maxSeconds'>

/** Reloj de un jugador de la Partida Rápida. Los tiempos son de un reloj monotónico (performance.now). */
export interface QuickClock {
  /** Momento en que el reloj llega a 0. */
  deadlineMs: number
  correctas: number
  falladas: number
  finished: boolean
}

export function startClock(config: ClockConfig, nowMs: number): QuickClock {
  return { deadlineMs: nowMs + config.startSeconds * 1000, correctas: 0, falladas: 0, finished: false }
}

export function remainingMs(state: QuickClock, nowMs: number): number {
  return state.finished ? 0 : Math.max(0, state.deadlineMs - nowMs)
}

/** Termina el reloj si ya llegó a 0. */
export function tick(state: QuickClock, nowMs: number): QuickClock {
  return !state.finished && nowMs >= state.deadlineMs ? { ...state, finished: true } : state
}

/**
 * Aplica una respuesta: acierto +bonus (sin pasar de maxSeconds), fallo −penalización (si deja el
 * reloj en 0 o menos, termina). Una respuesta con el reloj ya en 0 no cuenta.
 */
export function applyAnswer(state: QuickClock, correct: boolean, nowMs: number, config: ClockConfig): QuickClock {
  if (state.finished) return state
  if (nowMs >= state.deadlineMs) return { ...state, finished: true }
  if (correct) {
    let deadlineMs = state.deadlineMs + config.correctBonus * 1000
    if (config.maxSeconds !== null) deadlineMs = Math.min(deadlineMs, nowMs + config.maxSeconds * 1000)
    return { ...state, deadlineMs, correctas: state.correctas + 1 }
  }
  const deadlineMs = state.deadlineMs - config.wrongPenalty * 1000
  return { deadlineMs, correctas: state.correctas, falladas: state.falladas + 1, finished: deadlineMs <= nowMs }
}
