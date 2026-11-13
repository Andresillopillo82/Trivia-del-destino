import { GAME_CONFIG, type GameConfig } from '../config/gameConfig'
import type { AvatarId } from './avatars'
import {
  answersOfDay,
  createChallenge,
  eligibleTargets,
  pendingChallengesFor,
  pickChallengeQuestion,
  resolveChallenge,
  unlockingAnswer,
} from './challenges'
import { drawQuestion, seenQuestionIds } from './draw'
import { chance, pick, randInt, type Rng } from './rng'
import { evaluateAnswer } from './scoring'
import type { AnswerEvent, AnswerResult, ChallengeEvent, PlayerInfo, Question } from './types'

export interface BotProfile {
  uid: string
  apodo: string
  avatar: AvatarId
  /** Probabilidad de acertar una pregunta normal. */
  habilidad: number
  /** Rango de tiempo de respuesta en ms. */
  minMs: number
  maxMs: number
}

export const BOT_PROFILES: readonly BotProfile[] = [
  { uid: 'bot-onix', apodo: 'Oráculo Ónix', avatar: 'ojo', habilidad: 0.85, minMs: 3_000, maxMs: 9_000 },
  { uid: 'bot-luna', apodo: 'Luna Errante', avatar: 'luna', habilidad: 0.72, minMs: 5_000, maxMs: 14_000 },
  { uid: 'bot-sibila', apodo: 'Sibila de Neón', avatar: 'estrella', habilidad: 0.62, minMs: 2_500, maxMs: 7_000 },
  { uid: 'bot-merlin', apodo: 'Merlín de Bolsillo', avatar: 'llave', habilidad: 0.5, minMs: 6_000, maxMs: 16_000 },
  { uid: 'bot-tito', apodo: 'Tito Tarot', avatar: 'copa', habilidad: 0.4, minMs: 4_000, maxMs: 18_000 },
  { uid: 'bot-casandra', apodo: 'Casandra', avatar: 'rosa', habilidad: 0.3, minMs: 7_000, maxMs: 19_000 },
]

/** Las preguntas hard son más difíciles también para los bots. */
export const FACTOR_HARD = 0.75

export function isBotUid(uid: string): boolean {
  return uid.startsWith('bot-')
}

export function botProfile(uid: string): BotProfile | undefined {
  return BOT_PROFILES.find((b) => b.uid === uid)
}

/** Simula la respuesta de un bot según su habilidad y velocidad. */
export function simulateBotAnswer(
  bot: Pick<BotProfile, 'habilidad' | 'minMs' | 'maxMs'>,
  question: Question,
  rng: Rng,
  config: GameConfig = GAME_CONFIG,
): AnswerResult {
  const p = question.nivel === 'hard' ? bot.habilidad * FACTOR_HARD : bot.habilidad
  const acierta = chance(rng, p)
  const tiempo = randInt(rng, bot.minMs, Math.min(bot.maxMs, config.tiempoPreguntaMs - 1))
  const opcion = acierta
    ? question.respuestaCorrecta
    : pick(
        rng,
        [0, 1, 2, 3].filter((i) => i !== question.respuestaCorrecta),
      )
  return evaluateAnswer(question, opcion, tiempo, config)
}

function profileFor(player: PlayerInfo): Pick<BotProfile, 'habilidad' | 'minMs' | 'maxMs'> {
  return botProfile(player.uid) ?? { habilidad: player.habilidad ?? 0.5, minMs: 4_000, maxMs: 15_000 }
}

/** Resuelve un reto que le toca responder a un bot (recibido o devuelto). */
export function resolveBotChallenge(
  challenge: ChallengeEvent,
  bot: PlayerInfo,
  questionsById: ReadonlyMap<string, Question>,
  rng: Rng,
  config: GameConfig = GAME_CONFIG,
): ChallengeEvent {
  const q = questionsById.get(challenge.preguntaId)
  if (!q) throw new Error(`Pregunta desconocida en el reto: ${challenge.preguntaId}`)
  return resolveChallenge(challenge, simulateBotAnswer(profileFor(bot), q, rng, config))
}

export interface BotDayInput {
  dia: number
  players: readonly PlayerInfo[]
  answers: readonly AnswerEvent[]
  challenges: readonly ChallengeEvent[]
  questions: readonly Question[]
  rng: Rng
  /** Probabilidad de que un bot que acierta lance su reto. */
  probabilidadRetar?: number
  config?: GameConfig
}

export interface BotDayPlan {
  /** Respuestas nuevas de bots para el día (ya cerradas). */
  answers: AnswerEvent[]
  /** Retos nuevos lanzados por bots (ya resueltos si el retado también es bot). */
  newChallenges: ChallengeEvent[]
  /** Retos existentes que los bots debían responder, ya resueltos. */
  resolved: ChallengeEvent[]
}

/**
 * Lo que hacen los bots al empezar un día (lo ejecuta el cliente del administrador):
 * 1) resuelven los retos que les toca responder (son obligatorios; incluye los que les devolvieron),
 * 2) responden las preguntas del día que les falten (sin comodín),
 * 3) los que llegan a 2 aciertos pueden retar a un compañero. Los bots nunca devuelven retos.
 * Es idempotente: un bot que ya respondió sus preguntas de ese día no vuelve a responder.
 */
export function planBotDay({
  dia,
  players,
  answers,
  challenges,
  questions,
  rng,
  probabilidadRetar = 0.85,
  config = GAME_CONFIG,
}: BotDayInput): BotDayPlan {
  const bots = players.filter((p) => p.esBot)
  const byId = new Map(questions.map((q) => [q.id, q]))
  const plan: BotDayPlan = { answers: [], newChallenges: [], resolved: [] }

  const todosLosRetos = [...challenges]
  for (const bot of bots) {
    for (const c of pendingChallengesFor(bot.uid, challenges, config)) {
      const r = resolveBotChallenge(c, bot, byId, rng, config)
      plan.resolved.push(r)
      todosLosRetos[todosLosRetos.indexOf(c)] = r
    }
  }

  const todasLasRespuestas = [...answers]
  for (const bot of bots) {
    const hechas = answersOfDay(bot.uid, dia, answers)
    for (let n = hechas.length; n < config.preguntasPorDia; n++) {
      const draw = drawQuestion(questions, seenQuestionIds(bot.uid, todasLasRespuestas, todosLosRetos), rng)
      if (!draw) break
      const res = simulateBotAnswer(profileFor(bot), draw.question, rng, config)
      const answer: AnswerEvent = {
        uid: bot.uid,
        dia,
        n,
        preguntaId: draw.question.id,
        carta: draw.card,
        comodin: false,
        estado: 'cerrada',
        opcion: res.opcion,
        correcta: res.correcta,
        tiempoMs: res.tiempoMs,
        retoPara: null,
      }
      plan.answers.push(answer)
      todasLasRespuestas.push(answer)
    }
  }

  for (const bot of bots) {
    // Solo si la respuesta que desbloquea el reto es nueva (se escribe ya con el retado marcado).
    const llave = unlockingAnswer(bot.uid, dia, todasLasRespuestas, config)
    if (!llave || !plan.answers.includes(llave) || !chance(rng, probabilidadRetar)) continue
    const objetivos = eligibleTargets(bot.uid, players, todosLosRetos, dia, config)
    if (objetivos.length === 0) continue
    const objetivo = pick(rng, objetivos)
    const q = pickChallengeQuestion(
      questions,
      seenQuestionIds(objetivo.uid, todasLasRespuestas, todosLosRetos),
      llave.carta,
      rng,
    )
    if (!q) continue
    let reto = createChallenge(bot.uid, objetivo.uid, dia, q)
    if (objetivo.esBot) reto = resolveBotChallenge(reto, objetivo, byId, rng, config)
    llave.retoPara = objetivo.uid
    plan.newChallenges.push(reto)
    todosLosRetos.push(reto)
  }

  return plan
}
