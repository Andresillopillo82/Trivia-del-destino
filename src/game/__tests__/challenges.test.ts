import { describe, expect, it } from 'vitest'
import {
  canReturnChallenge,
  canSendChallenge,
  challengeId,
  createChallenge,
  createExtraChallenge,
  devolucionExitosa,
  eligibleTargets,
  esDobleReto,
  extraChallengeId,
  isRequired,
  pendingChallengesFor,
  pickChallengeQuestion,
  resolveChallenge,
  responsable,
  scoreChallenge,
  tipoReto,
  unlockingAnswer,
} from '../challenges'
import { cardIdOf } from '../questions'
import { seededRng } from '../rng'
import { DEVUELTO_BIEN_MS, DEVUELTO_MAL_MS, answer, challenge, extraChallenge, makeQuestions, player } from './fixtures'

const qs = makeQuestions(3, 2)
const hards = qs.filter((q) => q.nivel === 'hard')
const hard = hards[0]!

describe('desbloquear el reto (2 aciertos, uno por día)', () => {
  const dia = (...correctas: boolean[]) => correctas.map((correcta, n) => answer('ana', 0, { n, correcta }))

  it('con un solo acierto no se desbloquea', () => {
    expect(canSendChallenge('ana', 0, dia(true, false, false))).toBe(false)
    expect(canSendChallenge('ana', 0, dia(true))).toBe(false)
  })

  it('el 2.º acierto lo desbloquea, sea cual sea su número de pregunta', () => {
    expect(unlockingAnswer('ana', 0, dia(true, true))?.n).toBe(1)
    expect(unlockingAnswer('ana', 0, dia(true, false, true))?.n).toBe(2)
    expect(unlockingAnswer('ana', 0, dia(false, true, true))?.n).toBe(2)
    expect(canSendChallenge('ana', 0, dia(false, true, true))).toBe(true)
  })

  it('el 3.er acierto no da otro reto: solo se marca la respuesta del 2.º', () => {
    const respuestas = dia(true, true, true)
    respuestas[1]!.retoPara = 'beto'
    expect(unlockingAnswer('ana', 0, respuestas)?.n).toBe(1)
    expect(canSendChallenge('ana', 0, respuestas)).toBe(false)
  })

  it('una pregunta aún abierta no cuenta, y el orden por número no depende del orden de llegada', () => {
    const respuestas = [answer('ana', 0, { n: 1, estado: 'abierta', correcta: false }), answer('ana', 0, { n: 0 })]
    expect(canSendChallenge('ana', 0, respuestas)).toBe(false)
    expect(unlockingAnswer('ana', 0, [answer('ana', 0, { n: 2 }), answer('ana', 0, { n: 0 })])?.n).toBe(2)
  })

  it('cada día cuenta aparte', () => {
    expect(canSendChallenge('ana', 1, [answer('ana', 0, { n: 0 }), answer('ana', 1, { n: 0 })])).toBe(false)
  })
})

describe('eligibleTargets', () => {
  const players = [player('ana'), player('beto'), player('caro')]

  it('excluye al propio retador', () => {
    expect(eligibleTargets('ana', players, [], 0).map((p) => p.uid)).toEqual(['beto', 'caro'])
  })

  it('excluye a quien ya recibió su reto del día (máximo 1); la pregunta extra no cuenta como otro', () => {
    const retos = [challenge('caro', 'beto', 2), extraChallenge('ana', 'caro', 2)]
    expect(eligibleTargets('ana', players, retos, 2).map((p) => p.uid)).toEqual(['caro'])
    expect(eligibleTargets('ana', players, retos, 3).map((p) => p.uid)).toEqual(['beto', 'caro'])
  })
})

describe('pickChallengeQuestion', () => {
  it('elige una pregunta hard que el retado no vio, de la carta preferida', () => {
    const q = pickChallengeQuestion(qs, new Set(['loco-h4']), 'loco', seededRng(1))!
    expect(q).toMatchObject({ id: 'loco-h5', nivel: 'hard' })
  })

  it('si ya vio las de esa carta, usa otra', () => {
    const q = pickChallengeQuestion(qs, new Set(['loco-h4', 'loco-h5']), 'loco', seededRng(1))!
    expect(q.nivel).toBe('hard')
    expect(cardIdOf(q)).not.toBe('loco')
  })

  it('null si ya vio todas las hard', () => {
    const todas = new Set(hards.map((q) => q.id))
    expect(pickChallengeQuestion(qs, todas, null, seededRng(1))).toBeNull()
  })
})

describe('crear y resolver retos', () => {
  it('id determinista por retado y día', () => {
    expect(createChallenge('ana', 'beto', 3, hard)).toMatchObject({
      id: challengeId('beto', 3),
      estado: 'pendiente',
      extra: false,
      devueltoEnMs: null,
      carta: cardIdOf(hard),
    })
  })

  it('no permite retarse a sí mismo ni usar preguntas normales', () => {
    expect(() => createChallenge('ana', 'ana', 0, hard)).toThrow()
    expect(() => createChallenge('ana', 'beto', 0, qs[0]!)).toThrow()
  })

  it('la pregunta extra: otro id, otra pregunta hard, mismo retador y retado', () => {
    const base = createChallenge('ana', 'beto', 3, hard)
    expect(createExtraChallenge(base, hards[1]!)).toMatchObject({
      id: extraChallengeId('beto', 3),
      de: 'ana',
      para: 'beto',
      extra: true,
      preguntaId: hards[1]!.id,
    })
    expect(() => createExtraChallenge(base, hard)).toThrow()
    expect(() => createExtraChallenge(base, qs[0]!)).toThrow()
  })

  it('resolver guarda el resultado y no se puede resolver dos veces', () => {
    const r = resolveChallenge(createChallenge('ana', 'beto', 0, hard), { opcion: 1, correcta: true, tiempoMs: 4_000 })
    expect(r).toMatchObject({ estado: 'resuelto', correcta: true, tiempoMs: 4_000 })
    expect(() => resolveChallenge(r, { opcion: 0, correcta: false, tiempoMs: 1 })).toThrow()
  })
})

describe('devolver un reto', () => {
  it('sale bien cuando los milisegundos del servidor (mod 100) son menores que 30', () => {
    expect(devolucionExitosa(1_000)).toBe(true)
    expect(devolucionExitosa(1_029)).toBe(true)
    expect(devolucionExitosa(1_030)).toBe(false)
    expect(devolucionExitosa(1_099)).toBe(false)
    expect(devolucionExitosa(1_029.9)).toBe(true) // se usan milisegundos enteros, como en las reglas
    const bien = Array.from({ length: 1000 }, (_, i) => devolucionExitosa(1_760_000_000_000 + i)).filter(Boolean)
    expect(bien).toHaveLength(300)
  })

  it('solo el retado, antes de abrirlo y una vez; la extra no se devuelve', () => {
    expect(canReturnChallenge(challenge('ana', 'beto', 0), 'beto')).toBe(true)
    expect(canReturnChallenge(challenge('ana', 'beto', 0), 'ana')).toBe(false)
    expect(canReturnChallenge(challenge('ana', 'beto', 0, { estado: 'abierto' }), 'beto')).toBe(false)
    expect(canReturnChallenge(challenge('ana', 'beto', 0, { estado: 'devuelto', devueltoEnMs: DEVUELTO_MAL_MS }), 'beto')).toBe(false)
    expect(canReturnChallenge(extraChallenge('ana', 'beto', 0), 'beto')).toBe(false)
  })

  it('si sale bien responde el retador; si sale mal, el retado y además la extra', () => {
    const bien = challenge('ana', 'beto', 0, { estado: 'devuelto', devueltoEnMs: DEVUELTO_BIEN_MS })
    const mal = challenge('ana', 'beto', 0, { estado: 'devuelto', devueltoEnMs: DEVUELTO_MAL_MS })
    const extra = extraChallenge('ana', 'beto', 0)
    expect(responsable(bien)).toBe('ana')
    expect(responsable(mal)).toBe('beto')
    expect(responsable(challenge('ana', 'beto', 0))).toBe('beto')
    expect(esDobleReto(mal)).toBe(true)
    expect(esDobleReto(bien)).toBe(false)
    expect(isRequired(extra, [bien, extra])).toBe(false)
    expect(isRequired(extra, [mal, extra])).toBe(true)
  })
})

describe('pendingChallengesFor (retos obligatorios)', () => {
  it('los no resueltos que le toca responder, del más antiguo al más nuevo', () => {
    const retos = [
      challenge('caro', 'ana', 3),
      challenge('beto', 'ana', 1),
      challenge('beto', 'ana', 0, { estado: 'resuelto', correcta: true }),
      challenge('ana', 'beto', 2),
      challenge('caro', 'ana', 2, { estado: 'abierto' }),
    ]
    expect(pendingChallengesFor('ana', retos).map((c) => c.dia)).toEqual([1, 2, 3])
  })

  it('un reto devuelto con éxito pasa al retador; con la devolución fallida, el retado tiene las dos', () => {
    const bien = challenge('ana', 'beto', 0, { estado: 'devuelto', devueltoEnMs: DEVUELTO_BIEN_MS })
    const extraBien = extraChallenge('ana', 'beto', 0)
    expect(pendingChallengesFor('ana', [bien, extraBien]).map((c) => c.id)).toEqual(['beto_0'])
    expect(pendingChallengesFor('beto', [bien, extraBien])).toEqual([])

    const mal = challenge('ana', 'beto', 0, { estado: 'devuelto', devueltoEnMs: DEVUELTO_MAL_MS })
    const extraMal = extraChallenge('ana', 'beto', 0)
    expect(pendingChallengesFor('beto', [extraMal, mal]).map((c) => c.id)).toEqual(['beto_0', 'beto_0_2'])
    expect(pendingChallengesFor('ana', [mal, extraMal])).toEqual([])
  })

  it('devuelto pero aún sin confirmar la hora del servidor: sigue siendo del retado', () => {
    const enCamino = challenge('ana', 'beto', 0, { estado: 'devuelto', devueltoEnMs: null })
    expect(pendingChallengesFor('beto', [enCamino]).map((c) => c.id)).toEqual(['beto_0'])
  })
})

describe('scoreChallenge (puntos de un reto)', () => {
  const r = (extra: Parameters<typeof challenge>[3]) => challenge('ana', 'beto', 0, extra)
  const resuelto = (correcta: boolean) => ({ estado: 'resuelto' as const, correcta, tiempoMs: 5_000 })
  const puntos = (base: ReturnType<typeof r>, extra?: ReturnType<typeof r>, cerrada = false) => {
    const total: Record<string, number> = {}
    const ganados: string[] = []
    for (const s of scoreChallenge(base, extra, cerrada)) {
      total[s.uid] = (total[s.uid] ?? 0) + s.puntos
      if (s.gano) ganados.push(s.uid)
    }
    return { total, ganados }
  }

  it('lanzar no da puntos; el retado que acierta gana +10', () => {
    expect(puntos(r({}))).toEqual({ total: {}, ganados: [] })
    expect(puntos(r(resuelto(true)))).toEqual({ total: { beto: 10 }, ganados: ['beto'] })
  })

  it('si el retado falla pierde 5 y el retador gana +10', () => {
    expect(puntos(r(resuelto(false)))).toEqual({ total: { beto: -5, ana: 10 }, ganados: ['ana'] })
  })

  it('sin responder al cerrar la temporada cuenta como fallo', () => {
    expect(puntos(r({}), undefined, true)).toEqual({ total: { beto: -5, ana: 10 }, ganados: ['ana'] })
    expect(puntos(r({ estado: 'abierto' }), undefined, true).total).toEqual({ beto: -5, ana: 10 })
  })

  it('devuelto con éxito: el retador responde sin premio; si falla pierde 5', () => {
    const bien = { estado: 'devuelto' as const, devueltoEnMs: DEVUELTO_BIEN_MS }
    expect(puntos(r(bien))).toEqual({ total: {}, ganados: [] })
    expect(puntos(r({ ...bien, ...resuelto(true) }))).toEqual({ total: {}, ganados: [] })
    expect(puntos(r({ ...bien, ...resuelto(false) }))).toEqual({ total: { ana: -5 }, ganados: [] })
    expect(puntos(r(bien), undefined, true)).toEqual({ total: { ana: -5 }, ganados: [] })
    // La pregunta extra no cuenta si la devolución salió bien.
    expect(puntos(r(bien), extraChallenge('ana', 'beto', 0, resuelto(false)), true).total).toEqual({ ana: -5 })
  })

  describe('devolución fallida: doble reto', () => {
    const mal = { devueltoEnMs: DEVUELTO_MAL_MS }
    const extra = (e: Parameters<typeof challenge>[3] = {}) => extraChallenge('ana', 'beto', 0, e)

    it('acierta las dos: el premio una sola vez', () => {
      expect(puntos(r({ ...mal, ...resuelto(true) }), extra(resuelto(true)))).toEqual({ total: { beto: 10 }, ganados: ['beto'] })
    })

    it('acierta una y falla otra: +10 y −5', () => {
      expect(puntos(r({ ...mal, ...resuelto(true) }), extra(resuelto(false))).total).toEqual({ beto: 5 })
      expect(puntos(r({ ...mal, ...resuelto(false) }), extra(resuelto(true))).total).toEqual({ beto: 5 })
    })

    it('falla las dos: −10 y el retador gana +10', () => {
      expect(puntos(r({ ...mal, ...resuelto(false) }), extra(resuelto(false)))).toEqual({
        total: { beto: -10, ana: 10 },
        ganados: ['ana'],
      })
    })

    it('a mitad: cada fallo resta en cuanto ocurre; el retador espera a la segunda', () => {
      expect(puntos(r({ ...mal, ...resuelto(false) }), extra()).total).toEqual({ beto: -5 })
      expect(puntos(r({ ...mal, ...resuelto(true) }), extra()).total).toEqual({ beto: 10 })
    })

    it('al cerrar la temporada, las que quedaron sin responder (o sin crear) son fallos', () => {
      expect(puntos(r({ ...mal, estado: 'devuelto' }), extra(), true).total).toEqual({ beto: -10, ana: 10 })
      expect(puntos(r({ ...mal, ...resuelto(true) }), undefined, true).total).toEqual({ beto: 5 })
    })
  })
})

describe('tipoReto', () => {
  it('distingue reto, devuelto, doble y extra', () => {
    expect(tipoReto(challenge('ana', 'beto', 0))).toBe('reto')
    expect(tipoReto(challenge('ana', 'beto', 0, { estado: 'devuelto', devueltoEnMs: null }))).toBe('reto')
    expect(tipoReto(challenge('ana', 'beto', 0, { estado: 'devuelto', devueltoEnMs: DEVUELTO_BIEN_MS }))).toBe('devuelto')
    expect(tipoReto(challenge('ana', 'beto', 0, { estado: 'devuelto', devueltoEnMs: DEVUELTO_MAL_MS }))).toBe('doble')
    expect(tipoReto(extraChallenge('ana', 'beto', 0))).toBe('extra')
  })
})
