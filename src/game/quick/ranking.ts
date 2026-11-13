import type { QuickPlayer } from './room'

export interface QuickRankRow {
  player: QuickPlayer
  /** Puesto (1 = ganador). Los empatados comparten puesto: 1, 1, 3. */
  posicion: number
}

function compara(a: QuickPlayer, b: QuickPlayer): number {
  return b.correctas - a.correctas || a.falladas - b.falladas
}

/** Ranking: más aciertos; desempate, menos fallos; si persiste, empate (mismo puesto). */
export function rankQuick(players: readonly QuickPlayer[]): QuickRankRow[] {
  const orden = [...players].sort((a, b) => compara(a, b) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0))
  return orden.map((p) => ({ player: p, posicion: 1 + orden.filter((o) => compara(o, p) < 0).length }))
}

export function quickWinners(players: readonly QuickPlayer[]): QuickPlayer[] {
  return rankQuick(players)
    .filter((r) => r.posicion === 1)
    .map((r) => r.player)
}
