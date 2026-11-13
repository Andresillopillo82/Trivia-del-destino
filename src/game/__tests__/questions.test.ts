import { describe, expect, it } from 'vitest'
import { CARDS } from '../cards'
import { QUESTIONS, QUESTIONS_BY_ID } from '../questionBank'
import { cardIdOf, parseQuestions } from '../questions'
import { makeQuestions } from './fixtures'

describe('banco de preguntas real (src/data/questions.json)', () => {
  it('tiene 280 preguntas con ids únicos', () => {
    expect(QUESTIONS).toHaveLength(280)
    expect(QUESTIONS_BY_ID.size).toBe(280)
  })

  it('cada carta tiene 20 preguntas normales y 8 hard de su categoría', () => {
    for (const card of CARDS) {
      const deLaCarta = QUESTIONS.filter((q) => cardIdOf(q) === card.id)
      expect(deLaCarta.filter((q) => q.nivel === 'normal'), card.nombre).toHaveLength(20)
      expect(deLaCarta.filter((q) => q.nivel === 'hard'), card.nombre).toHaveLength(8)
      expect(new Set(deLaCarta.map((q) => q.categoria))).toEqual(new Set([card.categoria]))
    }
  })
})

describe('parseQuestions', () => {
  it('acepta un banco válido', () => {
    expect(parseQuestions(makeQuestions())).toHaveLength(50)
  })

  it.each([
    ['no es arreglo', {}],
    ['id repetido', [...makeQuestions(1, 0).slice(0, 1), ...makeQuestions(1, 0).slice(0, 1)]],
    ['tres opciones', [{ ...makeQuestions(1, 0)[0], opciones: ['a', 'b', 'c'] }]],
    ['índice fuera de rango', [{ ...makeQuestions(1, 0)[0], respuestaCorrecta: 4 }]],
    ['carta desconocida', [{ ...makeQuestions(1, 0)[0], carta: 'La Torre' }]],
    ['nivel inválido', [{ ...makeQuestions(1, 0)[0], nivel: 'facil' }]],
  ])('rechaza: %s', (_, raw) => {
    expect(() => parseQuestions(raw)).toThrow()
  })
})
