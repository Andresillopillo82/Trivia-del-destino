import { describe, expect, it } from 'vitest'
import { GAME_CONFIG, type QuickMatchConfig } from '../../config/gameConfig'
import { BOT_PROFILES } from '../bots'
import { QUESTIONS } from '../questionBank'
import { botProgress, simulateQuickBot } from '../quick/bots'
import { applyAnswer, remainingMs, startClock, tick } from '../quick/clock'
import { quickWinners, rankQuick } from '../quick/ranking'
import {
  canJoin,
  canStart,
  finishRoom,
  newRoom,
  newSeed,
  rematchRoom,
  shouldFinish,
  startRoom,
  stillPlaying,
  usedQuestionIds,
  type QuickPlayer,
} from '../quick/room'
import { buildQuickSequence } from '../quick/sequence'
import { seededRng } from '../rng'
import { makeQuestions } from './fixtures'

const CFG: QuickMatchConfig = GAME_CONFIG.quickMatch

describe('buildQuickSequence', () => {
  it('misma semilla ⇒ misma secuencia; otra semilla ⇒ otra', () => {
    const a = buildQuickSequence(42, QUESTIONS, CFG, 40).map((q) => q.id)
    expect(buildQuickSequence(42, QUESTIONS, CFG, 40).map((q) => q.id)).toEqual(a)
    expect(buildQuickSequence(43, QUESTIONS, CFG, 40).map((q) => q.id)).not.toEqual(a)
  })

  it('el prefijo no depende de la longitud (se genera bajo demanda)', () => {
    const corta = buildQuickSequence(7, QUESTIONS, CFG, 13).map((q) => q.id)
    const larga = buildQuickSequence(7, QUESTIONS, CFG, 60).map((q) => q.id)
    expect(larga.slice(0, 13)).toEqual(corta)
  })

  it('no repite preguntas ni dos cartas seguidas', () => {
    for (let seed = 0; seed < 50; seed++) {
      const seq = buildQuickSequence(seed, QUESTIONS, CFG, 300)
      expect(new Set(seq.slice(0, 100).map((q) => q.id)).size).toBe(100)
      for (let i = 1; i < seq.length; i++) expect(seq[i]!.carta).not.toBe(seq[i - 1]!.carta)
    }
  })

  it('la proporción de hard por tramo sigue la configuración', () => {
    for (let seed = 0; seed < 50; seed++) {
      const seq = buildQuickSequence(seed, QUESTIONS, CFG, 40)
      const hards = (desde: number, hasta: number) => seq.slice(desde - 1, hasta).filter((q) => q.nivel === 'hard').length
      expect(hards(1, 5)).toBe(0)
      expect(hards(6, 10)).toBe(1) // 25 % de 5 = 1,25 → 1
      expect(hards(11, 15)).toBe(3) // 50 % de 5 = 2,5 → 3
      expect(hards(16, 20)).toBe(4) // 75 % de 5 = 3,75 → 4
      expect(hards(21, 30)).toBe(10)
    }
  })

  it('cuando se acaban las hard, sigue con normales; nunca se agota', () => {
    const seq = buildQuickSequence(3, QUESTIONS, CFG, 1000)
    expect(seq).toHaveLength(1000)
    // Antes de repetir se gasta casi todo el banco.
    const primeraRepetida = seq.findIndex((q, i) => seq.slice(0, i).some((o) => o.id === q.id))
    expect(primeraRepetida).toBeGreaterThan(QUESTIONS.length - 5)
    for (let i = 1; i < seq.length; i++) expect(seq[i]!.carta).not.toBe(seq[i - 1]!.carta)
  })

  it('la revancha evita las preguntas de la ronda anterior si puede', () => {
    const anterior = buildQuickSequence(1, QUESTIONS, CFG, 20).map((q) => q.id)
    const nueva = buildQuickSequence(2, QUESTIONS, CFG, 20, anterior).map((q) => q.id)
    expect(nueva.filter((id) => anterior.includes(id))).toEqual([])
  })

  it('si evitar lo tapa todo, repite antes que fallar', () => {
    const qs = makeQuestions(1, 1)
    const todo = qs.map((q) => q.id)
    expect(buildQuickSequence(5, qs, CFG, 30, todo)).toHaveLength(30)
  })

  it('una tabla con desde ≠ 1 trata las primeras como normales', () => {
    const seq = buildQuickSequence(9, QUESTIONS, { difficulty: [{ desde: 4, hard: 1 }] }, 8)
    expect(seq.slice(0, 3).every((q) => q.nivel === 'normal')).toBe(true)
    expect(seq.slice(3).every((q) => q.nivel === 'hard')).toBe(true)
  })
})

describe('applyAnswer', () => {
  const t0 = 1000

  it('empieza con 45 s; +2 al acertar y −2 al fallar', () => {
    let c = startClock(CFG, t0)
    expect(remainingMs(c, t0)).toBe(45_000)
    c = applyAnswer(c, true, t0 + 5000, CFG)
    expect(remainingMs(c, t0 + 5000)).toBe(42_000)
    c = applyAnswer(c, false, t0 + 6000, CFG)
    expect(remainingMs(c, t0 + 6000)).toBe(39_000)
    expect([c.correctas, c.falladas, c.finished]).toEqual([1, 1, false])
  })

  it('no pasa del techo maxSeconds; con null no hay techo', () => {
    let c = startClock(CFG, t0)
    for (let i = 0; i < 20; i++) c = applyAnswer(c, true, t0 + 100, CFG)
    expect(remainingMs(c, t0 + 100)).toBe(60_000)
    let s = startClock({ ...CFG, maxSeconds: null }, t0)
    for (let i = 0; i < 20; i++) s = applyAnswer(s, true, t0 + 100, { ...CFG, maxSeconds: null })
    expect(remainingMs(s, t0 + 100)).toBe(84_900)
  })

  it('un fallo que deja el reloj en 0 o menos termina al instante', () => {
    let c = startClock(CFG, t0)
    c = applyAnswer(c, false, t0 + 43_000, CFG) // quedaban 2 s exactos
    expect(c.finished).toBe(true)
    expect(c.falladas).toBe(1)
    expect(remainingMs(c, t0 + 43_000)).toBe(0)
  })

  it('una respuesta con 0 s restantes no cuenta', () => {
    const c = startClock(CFG, t0)
    const tarde = applyAnswer(c, true, t0 + 45_000, CFG)
    expect([tarde.correctas, tarde.falladas, tarde.finished]).toEqual([0, 0, true])
    expect(applyAnswer(tarde, true, t0 + 45_001, CFG)).toBe(tarde)
  })

  it('tick termina el reloj al llegar a 0', () => {
    const c = startClock(CFG, t0)
    expect(tick(c, t0 + 44_999).finished).toBe(false)
    expect(tick(c, t0 + 45_000).finished).toBe(true)
  })
})

const jugador = (uid: string, correctas: number, falladas: number, extra: Partial<QuickPlayer> = {}): QuickPlayer => ({
  uid,
  apodo: uid,
  avatar: 'luna',
  esBot: false,
  round: 1,
  correctas,
  falladas,
  finished: true,
  ...extra,
})

describe('rankQuick', () => {
  it('más aciertos gana; desempate por menos fallos', () => {
    const r = rankQuick([jugador('a', 5, 3), jugador('b', 7, 9), jugador('c', 5, 1)])
    expect(r.map((x) => [x.player.uid, x.posicion])).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ])
  })

  it('empate total comparte el puesto', () => {
    const r = rankQuick([jugador('z', 4, 2), jugador('a', 4, 2), jugador('m', 1, 0)])
    expect(r.map((x) => [x.player.uid, x.posicion])).toEqual([
      ['a', 1],
      ['z', 1],
      ['m', 3],
    ])
    expect(quickWinners([jugador('z', 4, 2), jugador('a', 4, 2)]).map((p) => p.uid)).toEqual(['a', 'z'])
    expect(quickWinners([])).toEqual([])
  })
})

describe('sala', () => {
  const sala = newRoom('ABCDE', 'host', true, 11, 0, CFG)

  it('lobby → playing → finished → revancha con semilla nueva', () => {
    expect(sala.status).toBe('lobby')
    expect(sala.expiresAtMs).toBe(6 * 3600_000)
    expect(canStart(sala, [])).toBe(false)
    // El anfitrión juega: hasta que su ficha no está en la ronda, no se puede iniciar.
    expect(canStart(sala, [jugador('ana', 0, 0)])).toBe(false)
    expect(canStart(sala, [jugador('ana', 0, 0), jugador('host', 0, 0)])).toBe(true)
    expect(canStart(sala, [jugador('host', 0, 0), jugador('bot-luna', 0, 0, { esBot: true, round: 0 })])).toBe(false)
    expect(canStart({ ...sala, hostPlays: false }, [jugador('ana', 0, 0), jugador('viejo', 0, 0, { round: 0 })])).toBe(true)
    const jugando = startRoom(sala, 500)
    expect([jugando.status, jugando.startedAtMs]).toEqual(['playing', 500])
    expect(() => startRoom(jugando, 600)).toThrow()
    expect(() => rematchRoom(jugando, 1, [])).toThrow()
    const fin = finishRoom(jugando)
    expect(fin.status).toBe('finished')
    const seed = newSeed(seededRng('x'))
    const rev = rematchRoom(fin, seed, ['q1'])
    expect([rev.status, rev.round, rev.seed, rev.evitar, rev.startedAtMs]).toEqual(['lobby', 2, seed, ['q1'], null])
    expect(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32).toBe(true)
  })

  it('solo se entra en lobby, sin caducar y con plazas', () => {
    expect(canJoin(sala, [], 'u', 0)).toBe('ok')
    expect(canJoin(sala, [jugador('u', 0, 0)], 'u', 0)).toBe('dentro')
    expect(canJoin(startRoom(sala, 0), [], 'u', 0)).toBe('empezada')
    expect(canJoin(sala, [], 'u', sala.expiresAtMs)).toBe('expirada')
    const llenos = Array.from({ length: 20 }, (_, i) => jugador(`p${i}`, 0, 0))
    expect(canJoin(sala, llenos, 'u', 0)).toBe('llena')
    // Los bots no ocupan plazas de jugador.
    expect(canJoin(sala, [...llenos.slice(1), jugador('bot-luna', 0, 0, { esBot: true })], 'u', 0)).toBe('ok')
  })

  it('termina cuando todos terminan o por el límite global; ignora otras rondas', () => {
    const j = startRoom(sala, 1000)
    const ps = [jugador('a', 1, 0), jugador('b', 2, 0, { finished: false }), jugador('viejo', 0, 0, { round: 0, finished: false })]
    expect(shouldFinish(j, ps, 2000)).toBe(false)
    expect(stillPlaying(j, ps)).toBe(1)
    expect(shouldFinish(j, ps, 1000 + CFG.hardTimeoutMs)).toBe(true)
    expect(shouldFinish(j, [ps[0]!, ps[2]!], 2000)).toBe(true)
    expect(shouldFinish(sala, ps, 10 ** 12)).toBe(false)
  })

  it('las preguntas usadas cubren hasta donde llegó el que más avanzó (+ la abierta)', () => {
    const ids = usedQuestionIds(sala, [jugador('a', 3, 1), jugador('b', 1, 0)], QUESTIONS)
    expect(ids).toEqual(buildQuickSequence(11, QUESTIONS, CFG, 5).map((q) => q.id))
  })
})

describe('bots de Partida Rápida', () => {
  it('son deterministas y respetan el reloj', () => {
    for (const bot of BOT_PROFILES) {
      const run = simulateQuickBot(bot, 99, QUESTIONS, CFG)
      expect(simulateQuickBot(bot, 99, QUESTIONS, CFG)).toEqual(run)
      // Rehacer el reloj con sus eventos lleva al mismo final.
      let c = startClock(CFG, 0)
      for (const e of run.eventos) {
        expect(c.finished).toBe(false)
        expect(e.atMs).toBeLessThan(c.deadlineMs)
        c = applyAnswer(c, e.correcta, e.atMs, CFG)
      }
      expect(run.finMs).toBe(c.finished ? run.eventos.at(-1)!.atMs : c.deadlineMs)
      expect(run.finMs).toBeLessThanOrEqual(CFG.hardTimeoutMs)
      expect(run.eventos.length).toBeGreaterThan(3)
    }
  })

  it('el mejor bot acierta más que el peor (en promedio)', () => {
    const media = (i: number) => {
      let s = 0
      for (let seed = 0; seed < 30; seed++) s += simulateQuickBot(BOT_PROFILES[i]!, seed, QUESTIONS, CFG).eventos.filter((e) => e.correcta).length
      return s / 30
    }
    expect(media(0)).toBeGreaterThan(media(BOT_PROFILES.length - 1))
  })

  it('botProgress cuenta lo respondido hasta ese momento', () => {
    const run = { uid: 'b', eventos: [{ atMs: 100, correcta: true }, { atMs: 200, correcta: false }], finMs: 300 }
    expect(botProgress(run, 150)).toEqual({ correctas: 1, falladas: 0, finished: false })
    expect(botProgress(run, 300)).toEqual({ correctas: 1, falladas: 1, finished: true })
  })
})
