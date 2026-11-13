import { GAME_CONFIG, type GameConfig } from '../config/gameConfig'
import type { CardId } from './cards'
import { cardIdOf } from './questions'
import { pick, type Rng } from './rng'
import type { AnswerEvent, AnswerResult, ChallengeEvent, PlayerInfo, Question } from './types'

/** Id determinista: un jugador recibe como máximo un reto por día. */
export function challengeId(para: string, dia: number): string {
  return `${para}_${dia}`
}

/** Id de la segunda pregunta del doble reto (cuando la devolución falla). */
export function extraChallengeId(para: string, dia: number): string {
  return `${para}_${dia}_2`
}

/**
 * ¿La devolución salió bien? Se decide con los milisegundos de la hora del servidor en que se
 * devolvió: nadie puede elegirlos, y firestore.rules aplica exactamente la misma cuenta.
 */
export function devolucionExitosa(devueltoEnMs: number, config: GameConfig = GAME_CONFIG): boolean {
  return Math.floor(devueltoEnMs) % 100 < config.porcentajeDevolucion
}

/** Reto principal devuelto cuya devolución falló: el retado debe responder dos preguntas. */
export function esDobleReto(c: ChallengeEvent, config: GameConfig = GAME_CONFIG): boolean {
  return !c.extra && c.devueltoEnMs !== null && !devolucionExitosa(c.devueltoEnMs, config)
}

/** Quién debe responder la pregunta: el retador si le devolvieron el reto con éxito; si no, el retado. */
export function responsable(c: ChallengeEvent, config: GameConfig = GAME_CONFIG): string {
  if (!c.extra && c.devueltoEnMs !== null && devolucionExitosa(c.devueltoEnMs, config)) return c.de
  return c.para
}

/** Reto principal al que pertenece una pregunta extra. */
export function baseOf(extra: ChallengeEvent, challenges: readonly ChallengeEvent[]): ChallengeEvent | undefined {
  const id = challengeId(extra.para, extra.dia)
  return challenges.find((c) => c.id === id)
}

/** La pregunta cuenta: los retos principales siempre; la extra solo si la devolución falló. */
export function isRequired(c: ChallengeEvent, challenges: readonly ChallengeEvent[], config: GameConfig = GAME_CONFIG): boolean {
  if (!c.extra) return true
  const base = baseOf(c, challenges)
  return !!base && esDobleReto(base, config)
}

/** Se puede devolver un reto recibido que aún no se abrió. Un reto devuelto o extra no se devuelve. */
export function canReturnChallenge(c: ChallengeEvent, uid: string): boolean {
  return c.para === uid && !c.extra && c.estado === 'pendiente' && c.devueltoEnMs === null
}

/** Respuestas del jugador en un día, en orden (0, 1, 2). */
export function answersOfDay(uid: string, dia: number, answers: readonly AnswerEvent[]): AnswerEvent[] {
  return answers.filter((a) => a.uid === uid && a.dia === dia).sort((a, b) => a.n - b.n)
}

/**
 * Respuesta que desbloquea el reto del día: la que completa `aciertosParaRetar` aciertos.
 * Solo una respuesta por día cumple esto, así que solo se puede lanzar un reto al día.
 */
export function unlockingAnswer(
  uid: string,
  dia: number,
  answers: readonly AnswerEvent[],
  config: GameConfig = GAME_CONFIG,
): AnswerEvent | undefined {
  let aciertos = 0
  for (const a of answersOfDay(uid, dia, answers)) {
    if (a.estado !== 'cerrada' || !a.correcta) continue
    aciertos++
    if (aciertos === config.aciertosParaRetar) return a
  }
  return undefined
}

/** Se desbloquea un reto al día al acertar 2 preguntas, y solo se puede lanzar uno. */
export function canSendChallenge(
  uid: string,
  dia: number,
  answers: readonly AnswerEvent[],
  config: GameConfig = GAME_CONFIG,
): boolean {
  const a = unlockingAnswer(uid, dia, answers, config)
  return !!a && a.retoPara === null
}

/** Reto que el jugador lanzó ese día, si lo hizo. */
export function sentChallenge(uid: string, dia: number, challenges: readonly ChallengeEvent[]): ChallengeEvent | undefined {
  return challenges.find((c) => c.de === uid && c.dia === dia && !c.extra)
}

export function receivedOnDay(uid: string, dia: number, challenges: readonly ChallengeEvent[]): number {
  return challenges.filter((c) => c.para === uid && c.dia === dia && !c.extra).length
}

/** Compañeros a los que se puede retar hoy (no uno mismo, ni quien ya recibió su reto del día). */
export function eligibleTargets(
  challengerUid: string,
  players: readonly PlayerInfo[],
  challenges: readonly ChallengeEvent[],
  dia: number,
  config: GameConfig = GAME_CONFIG,
): PlayerInfo[] {
  return players.filter(
    (p) => p.uid !== challengerUid && receivedOnDay(p.uid, dia, challenges) < config.maxRetosRecibidosPorDia,
  )
}

/**
 * Pregunta "hard" que el retado no haya visto. Prefiere la carta indicada
 * (la del retador ese día) y si no quedan, cualquier otra.
 */
export function pickChallengeQuestion(
  questions: readonly Question[],
  seenByTarget: ReadonlySet<string>,
  preferredCard: CardId | null,
  rng: Rng,
): Question | null {
  const libres = questions.filter((q) => q.nivel === 'hard' && !seenByTarget.has(q.id))
  if (libres.length === 0) return null
  const preferidas = preferredCard ? libres.filter((q) => cardIdOf(q) === preferredCard) : []
  return pick(rng, preferidas.length > 0 ? preferidas : libres)
}

export function createChallenge(de: string, para: string, dia: number, question: Question): ChallengeEvent {
  if (de === para) throw new Error('No puedes retarte a ti mismo')
  if (question.nivel !== 'hard') throw new Error('Los retos usan preguntas de nivel hard')
  return {
    id: challengeId(para, dia),
    de,
    para,
    dia,
    preguntaId: question.id,
    carta: cardIdOf(question),
    estado: 'pendiente',
    extra: false,
    devueltoEnMs: null,
    correcta: null,
    tiempoMs: null,
  }
}

/** Segunda pregunta del doble reto (se crea al devolver; solo cuenta si la devolución falla). */
export function createExtraChallenge(base: ChallengeEvent, question: Question): ChallengeEvent {
  if (base.extra) throw new Error('Una pregunta extra no tiene a su vez otra extra')
  if (question.nivel !== 'hard') throw new Error('Los retos usan preguntas de nivel hard')
  if (question.id === base.preguntaId) throw new Error('La pregunta extra debe ser distinta')
  return {
    ...base,
    id: extraChallengeId(base.para, base.dia),
    preguntaId: question.id,
    carta: cardIdOf(question),
    estado: 'pendiente',
    extra: true,
    devueltoEnMs: null,
    correcta: null,
    tiempoMs: null,
  }
}

export function resolveChallenge(challenge: ChallengeEvent, result: AnswerResult): ChallengeEvent {
  if (challenge.estado === 'resuelto') throw new Error('El reto ya fue resuelto')
  return { ...challenge, estado: 'resuelto', correcta: result.correcta, tiempoMs: result.tiempoMs }
}

/**
 * Preguntas de reto que el jugador todavía debe responder (obligatorias), de la más antigua a la
 * más nueva. Incluye los retos que le devolvieron y la pregunta extra de un doble reto.
 * Mientras haya alguna, no puede sacar otra carta.
 */
export function pendingChallengesFor(
  uid: string,
  challenges: readonly ChallengeEvent[],
  config: GameConfig = GAME_CONFIG,
): ChallengeEvent[] {
  return challenges
    .filter((c) => c.estado !== 'resuelto' && responsable(c, config) === uid && isRequired(c, challenges, config))
    .sort((a, b) => a.dia - b.dia || Number(a.extra) - Number(b.extra))
}

type Resultado = 'acierto' | 'fallo' | 'pendiente'

/** Una pregunta sin responder al cerrar la temporada cuenta como fallo. */
function resultado(c: ChallengeEvent | undefined, seasonClosed: boolean): Resultado {
  if (c?.estado === 'resuelto') return c.correcta ? 'acierto' : 'fallo'
  return seasonClosed ? 'fallo' : 'pendiente'
}

export interface ChallengeScore {
  uid: string
  puntos: number
  /** true si este jugador se llevó el premio del reto. */
  gano: boolean
}

/**
 * Puntos de un reto (el principal y, si hubo doble reto, su pregunta extra):
 * - Sin devolver: si el retado acierta gana el premio; si falla pierde 5 y el premio es del retador.
 * - Devuelto con éxito: responde el retador sin premio; si falla pierde 5.
 * - Devolución fallida: el retado responde dos preguntas. Gana el premio una vez si acierta alguna
 *   y pierde 5 por cada una que falla; si falla las dos, el premio es del retador.
 */
export function scoreChallenge(
  base: ChallengeEvent,
  extra: ChallengeEvent | undefined,
  seasonClosed: boolean,
  config: GameConfig = GAME_CONFIG,
): ChallengeScore[] {
  const premio = (uid: string): ChallengeScore => ({ uid, puntos: config.puntosReto, gano: true })
  const castigo = (uid: string, veces = 1): ChallengeScore => ({ uid, puntos: -config.penalizacionReto * veces, gano: false })

  if (base.devueltoEnMs === null) {
    const r = resultado(base, seasonClosed)
    if (r === 'acierto') return [premio(base.para)]
    if (r === 'fallo') return [castigo(base.para), premio(base.de)]
    return []
  }
  if (devolucionExitosa(base.devueltoEnMs, config)) {
    return resultado(base, seasonClosed) === 'fallo' ? [castigo(base.de)] : []
  }

  const rs = [resultado(base, seasonClosed), resultado(extra, seasonClosed)]
  const fallos = rs.filter((r) => r === 'fallo').length
  const puntos: ChallengeScore[] = []
  if (fallos > 0) puntos.push(castigo(base.para, fallos))
  if (rs.includes('acierto')) puntos.push(premio(base.para))
  else if (fallos === rs.length) puntos.push(premio(base.de))
  return puntos
}

/**
 * Qué clase de pregunta de reto es, para los textos de la interfaz:
 * - reto: recibido, sin devolver (o devuelto y aún sin la hora del servidor).
 * - devuelto: el retado lo devolvió con éxito; lo responde el retador, sin premio.
 * - doble: el reto principal tras una devolución fallida (1.ª de 2 preguntas).
 * - extra: la 2.ª pregunta del doble reto.
 */
export type TipoReto = 'reto' | 'devuelto' | 'doble' | 'extra'

export function tipoReto(c: ChallengeEvent, config: GameConfig = GAME_CONFIG): TipoReto {
  if (c.extra) return 'extra'
  if (c.devueltoEnMs === null) return 'reto'
  return devolucionExitosa(c.devueltoEnMs, config) ? 'devuelto' : 'doble'
}
