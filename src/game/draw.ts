import { CARDS, type CardId } from './cards'
import { cardIdOf } from './questions'
import { pick, type Rng } from './rng'
import { responsable } from './challenges'
import type { ChallengeEvent, Nivel, Question } from './types'

export interface Draw {
  card: CardId
  question: Question
}

/** Preguntas aún no vistas por el jugador, agrupadas por carta. */
function disponiblesPorCarta(
  questions: readonly Question[],
  seenIds: ReadonlySet<string>,
  nivel: Nivel,
): Map<CardId, Question[]> {
  const disponibles = new Map<CardId, Question[]>()
  for (const q of questions) {
    if (q.nivel !== nivel || seenIds.has(q.id)) continue
    const card = cardIdOf(q)
    const lista = disponibles.get(card)
    if (lista) lista.push(q)
    else disponibles.set(card, [q])
  }
  return disponibles
}

/**
 * Elige al azar una carta entre las que aún tienen preguntas sin ver para el jugador.
 * `excluir` deja fuera cartas (el comodín cambia a una carta de otra categoría).
 * Devuelve null si no queda ninguna.
 */
export function drawCard(
  questions: readonly Question[],
  seenIds: ReadonlySet<string>,
  rng: Rng,
  excluir: readonly CardId[] = [],
  nivel: Nivel = 'normal',
): CardId | null {
  const disponibles = disponiblesPorCarta(questions, seenIds, nivel)
  // Recorrer en el orden de CARDS para que el resultado solo dependa del rng.
  const cartas = CARDS.map((c) => c.id).filter((id) => disponibles.has(id) && !excluir.includes(id))
  return cartas.length === 0 ? null : pick(rng, cartas)
}

/** Pregunta no vista de la carta indicada (se elige al pulsar "Ver la pregunta"). */
export function drawQuestionForCard(
  questions: readonly Question[],
  seenIds: ReadonlySet<string>,
  card: CardId,
  rng: Rng,
  nivel: Nivel = 'normal',
): Question | null {
  const lista = disponiblesPorCarta(questions, seenIds, nivel).get(card)
  return lista ? pick(rng, lista) : null
}

/** Carta y pregunta de una vez (lo usan los bots, que no usan comodín). */
export function drawQuestion(
  questions: readonly Question[],
  seenIds: ReadonlySet<string>,
  rng: Rng,
  nivel: Nivel = 'normal',
): Draw | null {
  const card = drawCard(questions, seenIds, rng, [], nivel)
  if (!card) return null
  return { card, question: drawQuestionForCard(questions, seenIds, card, rng, nivel)! }
}

/**
 * Ids de preguntas que un jugador ya vio: sus respuestas diarias, los retos que recibió y los
 * que le devolvieron y tuvo que responder.
 */
export function seenQuestionIds(
  uid: string,
  answers: readonly { uid: string; preguntaId: string | null }[],
  challenges: readonly ChallengeEvent[],
): Set<string> {
  const seen = new Set<string>()
  for (const a of answers) if (a.uid === uid && a.preguntaId) seen.add(a.preguntaId)
  for (const c of challenges) if (c.para === uid || responsable(c) === uid) seen.add(c.preguntaId)
  return seen
}
