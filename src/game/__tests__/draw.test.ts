import { describe, expect, it } from 'vitest'
import { CARDS } from '../cards'
import { drawCard, drawQuestion, drawQuestionForCard, seenQuestionIds } from '../draw'
import { cardIdOf } from '../questions'
import { seededRng } from '../rng'
import { DEVUELTO_BIEN_MS, answer, challenge, makeQuestions } from './fixtures'

const qs = makeQuestions(3, 2) // 30 normales, 20 hard

describe('drawQuestion', () => {
  it('la carta revelada corresponde a la pregunta', () => {
    const d = drawQuestion(qs, new Set(), seededRng(1))!
    expect(cardIdOf(d.question)).toBe(d.card)
    expect(d.question.nivel).toBe('normal')
  })

  it('no repite preguntas hasta agotar todas las normales', () => {
    const rng = seededRng('sin-repetir')
    const vistas = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const d = drawQuestion(qs, vistas, rng)!
      expect(vistas.has(d.question.id)).toBe(false)
      vistas.add(d.question.id)
    }
    expect(drawQuestion(qs, vistas, rng)).toBeNull()
  })

  it('solo elige cartas que todavía tienen preguntas disponibles', () => {
    // Todas vistas salvo una pregunta de El Mundo.
    const vistas = new Set(qs.filter((q) => q.id !== 'mundo-n2').map((q) => q.id))
    for (let s = 0; s < 20; s++) {
      expect(drawQuestion(qs, vistas, seededRng(s))).toMatchObject({ card: 'mundo', question: { id: 'mundo-n2' } })
    }
  })

  it('puede sacar las 10 cartas', () => {
    const rng = seededRng(42)
    const cartas = new Set(Array.from({ length: 300 }, () => drawQuestion(qs, new Set(), rng)!.card))
    expect(cartas.size).toBe(CARDS.length)
  })

  it('es determinista con la misma semilla', () => {
    const a = drawQuestion(qs, new Set(), seededRng('x'))
    const b = drawQuestion(qs, new Set(), seededRng('x'))
    expect(a).toEqual(b)
  })

  it('puede sacar preguntas hard', () => {
    expect(drawQuestion(qs, new Set(), seededRng(3), 'hard')!.question.nivel).toBe('hard')
  })
})

describe('carta y pregunta por separado (comodín)', () => {
  it('drawQuestion equivale a sacar la carta y luego su pregunta con el mismo rng', () => {
    for (let s = 0; s < 20; s++) {
      const junto = drawQuestion(qs, new Set(), seededRng(s))!
      const rng = seededRng(s)
      const card = drawCard(qs, new Set(), rng)!
      expect({ card, question: drawQuestionForCard(qs, new Set(), card, rng) }).toEqual(junto)
    }
  })

  it('el comodín nunca repite la carta que descarta', () => {
    for (let s = 0; s < 50; s++) {
      expect(drawCard(qs, new Set(), seededRng(s), ['loco'])).not.toBe('loco')
    }
  })

  it('sin otra carta disponible, el comodín no tiene a dónde cambiar', () => {
    const vistas = new Set(qs.filter((q) => cardIdOf(q) !== 'mundo').map((q) => q.id))
    expect(drawCard(qs, vistas, seededRng(1))).toBe('mundo')
    expect(drawCard(qs, vistas, seededRng(1), ['mundo'])).toBeNull()
  })

  it('la pregunta sale de la carta indicada y no repite las vistas', () => {
    const q = drawQuestionForCard(qs, new Set(['carro-n1', 'carro-n2']), 'carro', seededRng(9))!
    expect(q.id).toBe('carro-n3')
    expect(drawQuestionForCard(qs, new Set(['carro-n1', 'carro-n2', 'carro-n3']), 'carro', seededRng(9))).toBeNull()
  })
})

describe('seenQuestionIds', () => {
  it('incluye respuestas propias y retos recibidos, no los de otros', () => {
    const seen = seenQuestionIds(
      'ana',
      [answer('ana', 0, { preguntaId: 'loco-n1' }), answer('beto', 0, { preguntaId: 'mago-n1' })],
      [challenge('beto', 'ana', 0, { preguntaId: 'loco-h4' }), challenge('ana', 'beto', 0, { preguntaId: 'mago-h4' })],
    )
    expect([...seen].sort()).toEqual(['loco-h4', 'loco-n1'])
  })

  it('una carta sin abrir no tiene pregunta; un reto devuelto con éxito lo vio el retador', () => {
    const seen = seenQuestionIds(
      'ana',
      [answer('ana', 0, { n: 1, estado: 'carta', preguntaId: null })],
      [challenge('ana', 'beto', 0, { preguntaId: 'mago-h4', estado: 'devuelto', devueltoEnMs: DEVUELTO_BIEN_MS })],
    )
    expect([...seen]).toEqual(['mago-h4'])
  })
})
