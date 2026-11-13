import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../../config/gameConfig'
import { dailyPoints, elapsedMs, evaluateAnswer, isExpired, remainingMs } from '../scoring'
import { makeQuestions } from './fixtures'

const q = makeQuestions(1, 0)[0]! // respuestaCorrecta = 1

describe('evaluateAnswer', () => {
  it('marca correcta la opción buena', () => {
    expect(evaluateAnswer(q, 1, 5_000)).toEqual({ opcion: 1, correcta: true, tiempoMs: 5_000 })
  })

  it('marca incorrecta otra opción', () => {
    expect(evaluateAnswer(q, 2, 5_000).correcta).toBe(false)
  })

  it('tiempo agotado: sin opción, incorrecta y con el tiempo máximo', () => {
    expect(evaluateAnswer(q, null, 3_000)).toEqual({ opcion: null, correcta: false, tiempoMs: 20_000 })
    expect(evaluateAnswer(q, 1, 25_000)).toEqual({ opcion: null, correcta: false, tiempoMs: 20_000 })
  })

  it('normaliza tiempos negativos', () => {
    expect(evaluateAnswer(q, 1, -50).tiempoMs).toBe(0)
  })
})

describe('dailyPoints', () => {
  it('+5 por acertar', () => {
    expect(dailyPoints({ correcta: true, tiempoMs: 12_000 })).toBe(5)
  })

  it('+2 extra si responde en menos de 8 s', () => {
    expect(dailyPoints({ correcta: true, tiempoMs: 7_999 })).toBe(7)
  })

  it('justo 8 s ya no tiene bonus', () => {
    expect(dailyPoints({ correcta: true, tiempoMs: 8_000 })).toBe(5)
  })

  it('0 por fallar, aunque sea rápido', () => {
    expect(dailyPoints({ correcta: false, tiempoMs: 1_000 })).toBe(0)
  })

  it('usa los valores de la configuración', () => {
    const cfg = { ...GAME_CONFIG, puntosCorrecta: 3, bonoRapidez: 2, umbralRapidezMs: 1_000 }
    expect(dailyPoints({ correcta: true, tiempoMs: 500 }, cfg)).toBe(5)
  })
})

describe('tiempo de la pregunta', () => {
  it('el temporizador arranca tras la pausa de revelación (3 s)', () => {
    expect(elapsedMs(1_000, 2_000)).toBe(0)
    expect(remainingMs(1_000, 4_000)).toBe(20_000)
    expect(elapsedMs(1_000, 9_000)).toBe(5_000)
    expect(remainingMs(1_000, 9_000)).toBe(15_000)
  })

  it('expira a los 20 s de empezar', () => {
    expect(isExpired(1_000, 23_999)).toBe(false)
    expect(isExpired(1_000, 24_000)).toBe(true)
    expect(remainingMs(1_000, 60_000)).toBe(0)
  })
})
