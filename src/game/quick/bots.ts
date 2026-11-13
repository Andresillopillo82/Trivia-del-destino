import type { QuickMatchConfig } from '../../config/gameConfig'
import { BOT_PROFILES, type BotProfile } from '../bots'
import { chance, hashString, randInt, seededRng } from '../rng'
import type { Question } from '../types'
import { applyAnswer, startClock } from './clock'
import { buildQuickSequence } from './sequence'

/** En la Partida Rápida los bots contestan más rápido que en el Modo Destino. */
const FACTOR_TIEMPO = 0.6
/** Los bots aciertan menos las preguntas hard. */
const FACTOR_HARD = 0.7

export interface QuickBotRun {
  uid: string
  /** Respuestas en ms desde el inicio de la partida. */
  eventos: { atMs: number; correcta: boolean }[]
  /** Momento en que su reloj llega a 0 (o el límite global). */
  finMs: number
}

export const QUICK_BOTS: readonly BotProfile[] = BOT_PROFILES

/**
 * Simula la partida completa de un bot con el mismo reloj y la misma secuencia que los jugadores.
 * Determinista: misma semilla y bot ⇒ misma partida (web y Android).
 */
export function simulateQuickBot(
  bot: BotProfile,
  seed: number,
  questions: readonly Question[],
  config: QuickMatchConfig,
  evitar: readonly string[] = [],
): QuickBotRun {
  const rng = seededRng((seed ^ hashString(bot.uid)) >>> 0)
  const minMs = Math.round(bot.minMs * FACTOR_TIEMPO)
  const maxMs = Math.round(bot.maxMs * FACTOR_TIEMPO)
  const seq = buildQuickSequence(seed, questions, config, Math.ceil(config.hardTimeoutMs / minMs) + 1, evitar)
  let reloj = startClock(config, 0)
  const eventos: QuickBotRun['eventos'] = []
  let t = 0
  for (const q of seq) {
    t += randInt(rng, minMs, maxMs)
    if (t >= reloj.deadlineMs || t >= config.hardTimeoutMs) break
    const correcta = chance(rng, q.nivel === 'hard' ? bot.habilidad * FACTOR_HARD : bot.habilidad)
    reloj = applyAnswer(reloj, correcta, t, config)
    eventos.push({ atMs: t, correcta })
    if (reloj.finished) return { uid: bot.uid, eventos, finMs: t }
  }
  return { uid: bot.uid, eventos, finMs: Math.min(reloj.deadlineMs, config.hardTimeoutMs) }
}

/** Progreso del bot a los `elapsedMs` del inicio. */
export function botProgress(run: QuickBotRun, elapsedMs: number) {
  let correctas = 0
  let falladas = 0
  for (const e of run.eventos) {
    if (e.atMs > elapsedMs) break
    if (e.correcta) correctas++
    else falladas++
  }
  return { correctas, falladas, finished: elapsedMs >= run.finMs }
}
