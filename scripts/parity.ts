/**
 * Escenarios de paridad web ↔ Android: grupos aleatorios (semilla fija) cuya clasificación y
 * títulos calcula la lógica de la web. La app Android debe obtener exactamente lo mismo
 * (android/app/src/test/.../ParityTest.kt). Lo usa scripts/export-parity-fixture.mjs.
 */
import { AVATARS } from '../src/game/avatars'
import { CARDS } from '../src/game/cards'
import { seasonDay, msUntilNextDay } from '../src/game/day'
import { chance, pick, randInt, seededRng } from '../src/game/rng'
import { canSendChallenge, devolucionExitosa, pendingChallengesFor } from '../src/game/challenges'
import { computeStandings } from '../src/game/standings'
import { awardTitles } from '../src/game/titles'
import type { AnswerEvent, ChallengeEvent, PlayerInfo } from '../src/game/types'
import { GAME_CONFIG } from '../src/config/gameConfig'
import { BOT_PROFILES } from '../src/game/bots'
import { QUESTIONS } from '../src/game/questionBank'
import { simulateQuickBot } from '../src/game/quick/bots'
import { applyAnswer, startClock } from '../src/game/quick/clock'
import { rankQuick } from '../src/game/quick/ranking'
import type { QuickPlayer } from '../src/game/quick/room'
import { buildQuickSequence } from '../src/game/quick/sequence'

// Apodos con repetidos, tildes y mayúsculas para ejercitar el orden entre empatados.
const APODOS = ['Ana', 'ana', 'Ñandú', 'Álvaro', 'Beto', 'beto', 'Zoe', 'Ana', 'Luna Errante', 'Oráculo Ónix', 'Casandra']
const TIEMPOS = [500, 3000, 7999, 8000, 8001, 10000, 12000, 15000, 19999, 20000]

export function crearEscenarios(n = 60) {
  const rng = seededRng('paridad-web-android')
  const escenarios = []
  for (let s = 0; s < n; s++) {
    const nJugadores = randInt(rng, 1, 9)
    const players: PlayerInfo[] = Array.from({ length: nJugadores }, (_, i) => ({
      uid: `u${randInt(rng, 0, 99)}-${i}`,
      apodo: pick(rng, APODOS),
      avatar: pick(rng, AVATARS).id,
      esBot: chance(rng, 0.3),
    }))
    const currentDay = randInt(rng, 0, 7)
    const answers: AnswerEvent[] = []
    for (const p of players) {
      for (let d = 0; d <= Math.min(currentDay, 6); d++) {
        // De 0 a 3 preguntas jugadas ese día; la última puede quedar a medias.
        const jugadas = randInt(rng, 0, 3)
        for (let n = 0; n < jugadas; n++) {
          const estado = n < jugadas - 1 ? 'cerrada' : pick(rng, ['cerrada', 'cerrada', 'cerrada', 'abierta', 'carta'] as const)
          const cerrada = estado === 'cerrada'
          answers.push({
            uid: p.uid,
            dia: d,
            n,
            preguntaId: estado === 'carta' ? null : `q${s}-${p.uid}-${d}-${n}`,
            carta: pick(rng, CARDS).id,
            comodin: chance(rng, 0.1),
            estado,
            opcion: cerrada ? randInt(rng, 0, 3) : null,
            correcta: cerrada ? chance(rng, 0.6) : false,
            tiempoMs: cerrada ? pick(rng, TIEMPOS) : 0,
            retoPara: null,
          })
        }
      }
    }
    // También eventos de alguien que ya no está en el grupo.
    if (chance(rng, 0.3)) {
      answers.push({ uid: 'fantasma', dia: 0, n: 0, preguntaId: 'x', carta: 'loco', comodin: false, estado: 'cerrada', opcion: 1, correcta: true, tiempoMs: 1000, retoPara: null })
    }
    const challenges: ChallengeEvent[] = []
    const uids = [...players.map((p) => p.uid), 'fantasma']
    for (let d = 0; d <= Math.min(currentDay, 6); d++) {
      const recibidos = new Set<string>()
      for (let k = 0; k < randInt(rng, 0, 3); k++) {
        const de = pick(rng, uids)
        const para = pick(rng, uids)
        if (de === para || recibidos.has(para)) continue
        recibidos.add(para)
        // Devolución: sin devolver, devuelta y aún sin hora del servidor, o con hora (bien o mal).
        const devueltoEnMs = pick(rng, [null, null, 'sin-hora', 'hora'] as const)
        const ms = devueltoEnMs === 'hora' ? 1_760_000_000_000 + randInt(rng, 0, 99_999) : null
        const estado = pick(rng, [devueltoEnMs ? 'devuelto' : 'pendiente', 'abierto', 'resuelto', 'resuelto'] as const)
        const reto: ChallengeEvent = {
          id: `${para}_${d}`,
          de,
          para,
          dia: d,
          preguntaId: `h${s}-${d}-${k}`,
          carta: pick(rng, CARDS).id,
          estado: devueltoEnMs === 'sin-hora' ? 'devuelto' : estado,
          extra: false,
          devueltoEnMs: ms,
          correcta: estado === 'resuelto' && devueltoEnMs !== 'sin-hora' ? chance(rng, 0.5) : null,
          tiempoMs: estado === 'resuelto' && devueltoEnMs !== 'sin-hora' ? pick(rng, TIEMPOS) : null,
        }
        challenges.push(reto)
        // La pregunta extra se crea con la devolución (a veces falta, como datos incompletos).
        if (devueltoEnMs && chance(rng, 0.85)) {
          const estadoExtra = pick(rng, ['pendiente', 'abierto', 'resuelto', 'resuelto'] as const)
          challenges.push({
            ...reto,
            id: `${para}_${d}_2`,
            preguntaId: `h${s}-${d}-${k}-2`,
            estado: estadoExtra,
            extra: true,
            devueltoEnMs: null,
            correcta: estadoExtra === 'resuelto' ? chance(rng, 0.5) : null,
            tiempoMs: estadoExtra === 'resuelto' ? pick(rng, TIEMPOS) : null,
          })
        }
      }
    }
    const seasonClosed = currentDay >= 7 || chance(rng, 0.2)
    const standings = computeStandings({ players, answers, challenges, seasonClosed })
    const titles = awardTitles(standings)
    escenarios.push({
      players,
      answers,
      challenges,
      currentDay: Math.min(currentDay, 6),
      seasonClosed,
      esperado: {
        standings: standings.map((r) => ({
          uid: r.uid,
          puntos: r.puntos,
          aciertos: r.aciertos,
          respondidas: r.respondidas,
          tiempoPromedioMs: r.tiempoPromedioMs,
          rachaActual: r.rachaActual,
          mejorRacha: r.mejorRacha,
          retosLanzados: r.retosLanzados,
          retosGanados: r.retosGanados,
          posicion: r.posicion,
        })),
        titulos: {
          duenoDelDestino: titles.duenoDelDestino?.uid ?? null,
          vidente: titles.vidente?.uid ?? null,
          retador: titles.retador?.uid ?? null,
        },
        // Retos que cada uno debe responder (bloquean su siguiente carta) y si puede retar hoy.
        pendientes: Object.fromEntries(uids.map((u) => [u, pendingChallengesFor(u, challenges).map((c) => c.id)])),
        puedeRetar: Object.fromEntries(
          players.map((p) => [p.uid, canSendChallenge(p.uid, Math.min(currentDay, 6), answers)]),
        ),
      },
    })
  }

  // Día de temporada: misma fórmula en web, Android y reglas.
  const dias = Array.from({ length: 40 }, () => {
    const inicio = 1_760_000_000_000 + randInt(rng, 0, 1_000_000_000)
    const ahora = inicio + randInt(rng, -100_000_000, 900_000_000)
    const offset = randInt(rng, -3, 10)
    return { inicio, ahora, offset, dia: seasonDay(inicio, offset, ahora), faltaMs: msUntilNextDay(inicio, ahora) }
  })

  // Devolución de retos: la hora del servidor decide (misma cuenta en web, Android y reglas).
  const devoluciones = Array.from({ length: 200 }, () => {
    const ms = 1_760_000_000_000 + randInt(rng, 0, 9_999_999)
    return { ms, exito: devolucionExitosa(ms) }
  })

  return { escenarios, dias, devoluciones, rapida: crearRapida(rng) }
}

/** Partida Rápida: secuencias, relojes, rankings y bots con la misma semilla en web y Android. */
function crearRapida(rng: ReturnType<typeof seededRng>) {
  const cfg = GAME_CONFIG.quickMatch
  const banco = QUESTIONS.map((q) => ({ id: q.id, carta: q.carta, nivel: q.nivel }))
  const secuencias = Array.from({ length: 30 }, (_, i) => {
    const seed = randInt(rng, 0, 2 ** 31 - 1) * 2 + randInt(rng, 0, 1)
    const evitar = i % 3 === 0 ? buildQuickSequence(seed + 1, QUESTIONS, cfg, randInt(rng, 5, 40)).map((q) => q.id) : []
    const length = pick(rng, [1, 7, 25, 60, 250])
    return { seed, evitar, length, ids: buildQuickSequence(seed, QUESTIONS, cfg, length, evitar).map((q) => q.id) }
  })
  const relojes = Array.from({ length: 40 }, () => {
    const maxSeconds = pick(rng, [60, null, 50])
    const c = { ...cfg, maxSeconds }
    let reloj = startClock(c, 1000)
    let t = 1000
    const ops: { atMs: number; correcta: boolean }[] = []
    const estados = []
    for (let k = 0; k < randInt(rng, 1, 40); k++) {
      t += randInt(rng, 0, 6000)
      const correcta = chance(rng, 0.55)
      ops.push({ atMs: t, correcta })
      reloj = applyAnswer(reloj, correcta, t, c)
      estados.push({ ...reloj })
    }
    return { maxSeconds, ops, estados }
  })
  const rankings = Array.from({ length: 30 }, () => {
    const players: QuickPlayer[] = Array.from({ length: randInt(rng, 0, 8) }, (_, i) => ({
      uid: `${pick(rng, ['a', 'B', 'ñ', 'z', 'bot-x'])}${i}`,
      apodo: 'x',
      avatar: 'luna',
      esBot: false,
      round: 1,
      correctas: randInt(rng, 0, 4),
      falladas: randInt(rng, 0, 3),
      finished: true,
    }))
    return { players, esperado: rankQuick(players).map((r) => ({ uid: r.player.uid, posicion: r.posicion })) }
  })
  const bots = BOT_PROFILES.flatMap((b) =>
    [0, 1, 4_294_967_295, randInt(rng, 0, 2 ** 31 - 1)].map((seed) => ({ uid: b.uid, seed, run: simulateQuickBot(b, seed, QUESTIONS, cfg) })),
  )
  return { banco, secuencias, relojes, rankings, bots }
}
