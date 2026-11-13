import { cardByName, type CardId } from './cards'
import type { Question } from './types'

/** Valida el formato del banco de preguntas; lanza un error descriptivo si algo no cuadra. */
export function parseQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) throw new Error('questions.json debe ser un arreglo')
  const ids = new Set<string>()
  return raw.map((q, i) => {
    const where = `pregunta #${i}`
    if (typeof q !== 'object' || q === null) throw new Error(`${where}: no es un objeto`)
    const r = q as Record<string, unknown>
    for (const campo of ['id', 'categoria', 'carta', 'pregunta', 'explicacion'] as const) {
      if (typeof r[campo] !== 'string' || !(r[campo] as string).trim()) throw new Error(`${where}: falta "${campo}"`)
    }
    const id = r.id as string
    if (ids.has(id)) throw new Error(`${where}: id repetido "${id}"`)
    ids.add(id)
    if (r.nivel !== 'normal' && r.nivel !== 'hard') throw new Error(`${id}: nivel inválido`)
    if (!cardByName(r.carta as string)) throw new Error(`${id}: carta desconocida "${String(r.carta)}"`)
    const opciones = r.opciones
    if (!Array.isArray(opciones) || opciones.length !== 4 || !opciones.every((o) => typeof o === 'string')) {
      throw new Error(`${id}: debe tener 4 opciones de texto`)
    }
    const rc = r.respuestaCorrecta
    if (typeof rc !== 'number' || !Number.isInteger(rc) || rc < 0 || rc > 3) {
      throw new Error(`${id}: respuestaCorrecta debe ser un índice entre 0 y 3`)
    }
    return r as unknown as Question
  })
}

export function cardIdOf(q: Question): CardId {
  const card = cardByName(q.carta)
  if (!card) throw new Error(`Carta desconocida: ${q.carta}`)
  return card.id
}

export function indexQuestions(questions: readonly Question[]): Map<string, Question> {
  return new Map(questions.map((q) => [q.id, q]))
}
