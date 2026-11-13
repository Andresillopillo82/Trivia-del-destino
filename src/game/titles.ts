import type { StandingRow, Titles } from './types'

/**
 * Títulos de fin de temporada a partir de una clasificación ya ordenada.
 * En los secundarios, el empate lo gana quien va mejor en la clasificación.
 */
export function awardTitles(standings: readonly StandingRow[]): Titles {
  const primero = standings[0]
  return {
    duenoDelDestino: primero && primero.puntos > 0 ? primero : null,
    vidente: bestBy(standings, (r) => r.mejorRacha),
    retador: bestBy(standings, (r) => r.retosGanados),
  }
}

function bestBy(standings: readonly StandingRow[], valor: (r: StandingRow) => number): StandingRow | null {
  let mejor: StandingRow | null = null
  for (const r of standings) {
    if (valor(r) > 0 && (!mejor || valor(r) > valor(mejor))) mejor = r
  }
  return mejor
}
