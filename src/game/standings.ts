import { GAME_CONFIG, type GameConfig } from '../config/gameConfig'
import { extraChallengeId, scoreChallenge } from './challenges'
import { dailyPoints } from './scoring'
import type { AnswerEvent, ChallengeEvent, PlayerInfo, StandingRow } from './types'

export interface StandingsInput {
  players: readonly PlayerInfo[]
  answers: readonly AnswerEvent[]
  challenges: readonly ChallengeEvent[]
  /** Con la temporada cerrada, las preguntas de reto sin responder cuentan como fallo. */
  seasonClosed: boolean
  config?: GameConfig
}

/**
 * Rachas de aciertos seguidos en las preguntas del día, en orden (día y número de pregunta).
 * Solo cuentan las respondidas: una pregunta que no se jugó no corta la racha, un fallo sí.
 */
export function streaks(
  dailyAnswers: readonly Pick<AnswerEvent, 'dia' | 'n' | 'estado' | 'correcta'>[],
): { mejor: number; actual: number } {
  const cerradas = dailyAnswers.filter((a) => a.estado === 'cerrada').sort((a, b) => a.dia - b.dia || a.n - b.n)
  let mejor = 0
  let actual = 0
  for (const a of cerradas) {
    actual = a.correcta ? actual + 1 : 0
    mejor = Math.max(mejor, actual)
  }
  return { mejor, actual }
}

/**
 * Orden: más puntos, más aciertos, menor tiempo promedio; el apodo y el uid solo para que el orden
 * sea estable. Se comparan carácter a carácter (no con localeCompare) para que la app Android
 * ordene a los empatados exactamente igual, sin depender del idioma del dispositivo.
 */
export function compareRows(a: StandingRow, b: StandingRow): number {
  return tieCompare(a, b) || porCodigo(a.apodo, b.apodo) || porCodigo(a.uid, b.uid)
}

function porCodigo(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function tieCompare(a: StandingRow, b: StandingRow): number {
  if (a.puntos !== b.puntos) return b.puntos - a.puntos
  if (a.aciertos !== b.aciertos) return b.aciertos - a.aciertos
  const ta = a.tiempoPromedioMs ?? Number.POSITIVE_INFINITY
  const tb = b.tiempoPromedioMs ?? Number.POSITIVE_INFINITY
  if (ta !== tb) return ta < tb ? -1 : 1
  return 0
}

/** Clasificación del grupo calculada a partir de los eventos (respuestas y retos). */
export function computeStandings({
  players,
  answers,
  challenges,
  seasonClosed,
  config = GAME_CONFIG,
}: StandingsInput): StandingRow[] {
  const filas = new Map<string, StandingRow>()
  for (const p of players) {
    filas.set(p.uid, {
      uid: p.uid,
      apodo: p.apodo,
      avatar: p.avatar,
      esBot: p.esBot,
      puntos: 0,
      aciertos: 0,
      respondidas: 0,
      tiempoPromedioMs: null,
      rachaActual: 0,
      mejorRacha: 0,
      retosLanzados: 0,
      retosGanados: 0,
      posicion: 0,
    })
  }

  const porJugador = new Map<string, AnswerEvent[]>()
  for (const a of answers) {
    if (!filas.has(a.uid)) continue
    const lista = porJugador.get(a.uid)
    if (lista) lista.push(a)
    else porJugador.set(a.uid, [a])
  }

  for (const [uid, lista] of porJugador) {
    const fila = filas.get(uid)!
    let tiempoTotal = 0
    for (const a of lista) {
      if (a.estado !== 'cerrada') continue
      fila.respondidas++
      tiempoTotal += a.tiempoMs
      if (a.correcta) fila.aciertos++
      fila.puntos += dailyPoints(a, config)
    }
    fila.tiempoPromedioMs = fila.respondidas > 0 ? tiempoTotal / fila.respondidas : null
    const { mejor, actual } = streaks(lista)
    fila.mejorRacha = mejor
    fila.rachaActual = actual
  }

  const porId = new Map(challenges.map((c) => [c.id, c]))
  for (const c of challenges) {
    if (c.extra) continue
    const retador = filas.get(c.de)
    if (retador) retador.retosLanzados++
    for (const { uid, puntos, gano } of scoreChallenge(c, porId.get(extraChallengeId(c.para, c.dia)), seasonClosed, config)) {
      const fila = filas.get(uid)
      if (!fila) continue
      fila.puntos += puntos
      if (gano) fila.retosGanados++
    }
  }

  const ordenadas = [...filas.values()].sort(compareRows)
  ordenadas.forEach((fila, i) => {
    const anterior = ordenadas[i - 1]
    fila.posicion = anterior && tieCompare(anterior, fila) === 0 ? anterior.posicion : i + 1
  })
  return ordenadas
}
