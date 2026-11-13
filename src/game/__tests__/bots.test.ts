import { describe, expect, it } from 'vitest'
import { BOT_PROFILES, FACTOR_HARD, isBotUid, planBotDay, simulateBotAnswer } from '../bots'
import { seenQuestionIds } from '../draw'
import { QUESTIONS } from '../questionBank'
import { seededRng } from '../rng'
import { computeStandings } from '../standings'
import type { AnswerEvent, ChallengeEvent, PlayerInfo } from '../types'
import { DEVUELTO_BIEN_MS, answer, challenge, makeQuestions, player } from './fixtures'

const qs = makeQuestions(8, 3)
const bots: PlayerInfo[] = BOT_PROFILES.map((b) => ({ uid: b.uid, apodo: b.apodo, avatar: b.avatar, esBot: true }))

describe('perfiles de bots', () => {
  it('hay 6 bots con nombre, avatar y habilidad distinta', () => {
    expect(BOT_PROFILES).toHaveLength(6)
    expect(new Set(BOT_PROFILES.map((b) => b.apodo)).size).toBe(6)
    expect(new Set(BOT_PROFILES.map((b) => b.habilidad)).size).toBe(6)
    expect(BOT_PROFILES.every((b) => isBotUid(b.uid))).toBe(true)
  })
})

describe('simulateBotAnswer', () => {
  const normal = qs.find((q) => q.nivel === 'normal')!
  const hard = qs.find((q) => q.nivel === 'hard')!

  it('acierta con una frecuencia cercana a su habilidad', () => {
    const rng = seededRng('habilidad')
    for (const bot of BOT_PROFILES) {
      const n = 3_000
      let ok = 0
      for (let i = 0; i < n; i++) if (simulateBotAnswer(bot, normal, rng).correcta) ok++
      expect(Math.abs(ok / n - bot.habilidad), bot.apodo).toBeLessThan(0.04)
    }
  })

  it('las preguntas hard le cuestan más', () => {
    const bot = BOT_PROFILES[0]!
    const rng = seededRng('hard')
    let ok = 0
    for (let i = 0; i < 3_000; i++) if (simulateBotAnswer(bot, hard, rng).correcta) ok++
    expect(Math.abs(ok / 3_000 - bot.habilidad * FACTOR_HARD)).toBeLessThan(0.04)
  })

  it('responde dentro de su rango de tiempo y elige una opción coherente', () => {
    const rng = seededRng('tiempo')
    for (const bot of BOT_PROFILES) {
      for (let i = 0; i < 200; i++) {
        const r = simulateBotAnswer(bot, normal, rng)
        expect(r.tiempoMs).toBeGreaterThanOrEqual(bot.minMs)
        expect(r.tiempoMs).toBeLessThanOrEqual(bot.maxMs)
        expect(r.correcta).toBe(r.opcion === normal.respuestaCorrecta)
      }
    }
  })
})

describe('planBotDay', () => {
  it('cada bot responde sus 3 preguntas del día, numeradas y sin comodín', () => {
    const plan = planBotDay({ dia: 0, players: bots, answers: [], challenges: [], questions: qs, rng: seededRng(1) })
    for (const b of bots) {
      expect(plan.answers.filter((a) => a.uid === b.uid).map((a) => a.n)).toEqual([0, 1, 2])
    }
    expect(plan.answers.every((a) => a.dia === 0 && a.estado === 'cerrada' && !a.comodin && a.preguntaId)).toBe(true)
  })

  it('si un bot ya respondió parte del día, solo completa las que faltan', () => {
    const previa = answer('bot-onix', 0, { n: 0, preguntaId: 'loco-n1' })
    const plan = planBotDay({ dia: 0, players: bots, answers: [previa], challenges: [], questions: qs, rng: seededRng(3) })
    expect(plan.answers.filter((a) => a.uid === 'bot-onix').map((a) => a.n)).toEqual([1, 2])
    expect(plan.answers.some((a) => a.uid === 'bot-onix' && a.preguntaId === 'loco-n1')).toBe(false)
  })

  it('es idempotente: un bot que ya respondió ese día no repite', () => {
    const p1 = planBotDay({ dia: 0, players: bots, answers: [], challenges: [], questions: qs, rng: seededRng(1) })
    const p2 = planBotDay({
      dia: 0,
      players: bots,
      answers: p1.answers,
      challenges: p1.newChallenges,
      questions: qs,
      rng: seededRng(2),
    })
    expect(p2.answers).toHaveLength(0)
    expect(p2.newChallenges).toHaveLength(0)
  })

  it('solo retan los bots con 2 aciertos, uno cada uno, y nadie recibe más de un reto por día', () => {
    const humanos = [player('ana'), player('beto')]
    for (let s = 0; s < 30; s++) {
      const plan = planBotDay({
        dia: 2,
        players: [...humanos, ...bots],
        answers: [],
        challenges: [],
        questions: qs,
        rng: seededRng(s),
        probabilidadRetar: 1,
      })
      const conDosAciertos = bots.filter((b) => plan.answers.filter((a) => a.uid === b.uid && a.correcta).length >= 2)
      expect(plan.newChallenges.map((c) => c.de).sort()).toEqual(conDosAciertos.map((b) => b.uid).sort())
      // El retado queda marcado en la respuesta del 2.º acierto.
      for (const b of conDosAciertos) {
        const segunda = plan.answers.filter((a) => a.uid === b.uid && a.correcta)[1]!
        expect(plan.answers.filter((a) => a.uid === b.uid && a.retoPara)).toEqual([segunda])
      }
      const retados = plan.newChallenges.map((c) => c.para)
      expect(new Set(retados).size).toBe(retados.length)
      for (const c of plan.newChallenges) {
        expect(c.de).not.toBe(c.para)
        expect(qs.find((q) => q.id === c.preguntaId)?.nivel).toBe('hard')
        expect(plan.answers.find((a) => a.uid === c.de && a.retoPara)?.retoPara).toBe(c.para)
      }
    }
  })

  it('los retos a bots se resuelven al instante; a humanos quedan pendientes', () => {
    const plan = planBotDay({
      dia: 0,
      players: [player('ana'), ...bots],
      answers: [],
      challenges: [],
      questions: qs,
      rng: seededRng(7),
      probabilidadRetar: 1,
    })
    expect(plan.newChallenges.length).toBeGreaterThan(0)
    for (const c of plan.newChallenges) {
      expect(c.estado).toBe(isBotUid(c.para) ? 'resuelto' : 'pendiente')
    }
  })

  it('respeta los retos que un humano ya envió hoy (no se duplica el retado)', () => {
    const retoHumano = challenge('ana', 'bot-onix', 0, { preguntaId: 'loco-h9' })
    const plan = planBotDay({
      dia: 0,
      players: [player('ana'), ...bots],
      answers: [],
      challenges: [retoHumano],
      questions: qs,
      rng: seededRng(11),
      probabilidadRetar: 1,
    })
    expect(plan.newChallenges.some((c) => c.para === 'bot-onix')).toBe(false)
    // El reto que tenía pendiente el bot se resuelve (son obligatorios).
    expect(plan.resolved.map((c) => c.id)).toEqual(['bot-onix_0'])
    expect(plan.resolved[0]!.estado).toBe('resuelto')
  })

  it('resuelve los retos que le devolvieron con éxito; nunca devuelve uno', () => {
    const devuelto = challenge('bot-onix', 'ana', 0, { estado: 'devuelto', devueltoEnMs: DEVUELTO_BIEN_MS, preguntaId: 'loco-h9' })
    const recibido = challenge('ana', 'bot-luna', 0, { preguntaId: 'mago-h9' })
    const plan = planBotDay({
      dia: 0,
      players: [player('ana'), ...bots],
      answers: [],
      challenges: [devuelto, recibido],
      questions: qs,
      rng: seededRng(5),
    })
    expect(plan.resolved.map((c) => c.id).sort()).toEqual(['ana_0', 'bot-luna_0'])
    expect(plan.resolved.every((c) => c.estado === 'resuelto' && c.devueltoEnMs === (c.id === 'ana_0' ? DEVUELTO_BIEN_MS : null))).toBe(
      true,
    )
  })

  it('simulación de una semana completa con el banco real: sin preguntas repetidas', () => {
    const players = [player('ana'), player('beto'), ...bots]
    let answers: AnswerEvent[] = []
    let challenges: ChallengeEvent[] = []
    for (let dia = 0; dia < 7; dia++) {
      const plan = planBotDay({ dia, players, answers, challenges, questions: QUESTIONS, rng: seededRng(`semana-${dia}`) })
      answers = [...answers, ...plan.answers]
      const resueltos = new Map(plan.resolved.map((c) => [c.id, c]))
      challenges = [...challenges.map((c) => resueltos.get(c.id) ?? c), ...plan.newChallenges]
    }
    for (const b of bots) {
      const propias = answers.filter((a) => a.uid === b.uid)
      expect(propias).toHaveLength(21)
      const recibidas = challenges.filter((c) => c.para === b.uid)
      const ids = [...propias.map((a) => a.preguntaId), ...recibidas.map((c) => c.preguntaId)]
      expect(new Set(ids).size, b.apodo).toBe(ids.length)
      expect(seenQuestionIds(b.uid, answers, challenges).size).toBe(ids.length)
    }
    // Los retos de bots a bots quedan resueltos; la clasificación se puede calcular.
    expect(challenges.filter((c) => isBotUid(c.para)).every((c) => c.estado === 'resuelto')).toBe(true)
    const rows = computeStandings({ players, answers, challenges, seasonClosed: true })
    expect(rows[0]!.puntos).toBeGreaterThan(0)
  })

  it('es determinista con la misma semilla', () => {
    const run = () =>
      planBotDay({ dia: 1, players: bots, answers: [], challenges: [], questions: qs, rng: seededRng('fijo') })
    expect(run()).toEqual(run())
  })
})
