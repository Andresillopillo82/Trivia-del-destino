import { GAME_CONFIG, type GameConfig } from '../config/gameConfig'

export const MS_DIA = 86_400_000

/**
 * Medianoche local del día que contiene `nowMs`.
 * El grupo guarda este valor como `fechaInicio`, así el día cambia a medianoche
 * del dispositivo del organizador.
 */
export function startOfLocalDay(nowMs: number): number {
  const d = new Date(nowMs)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Día de la temporada (0 = primer día). Las reglas de Firestore usan la misma fórmula
 * con `request.time`, así que no cambiarla sin actualizar firestore.rules.
 */
export function seasonDay(fechaInicioMs: number, dayOffset: number, nowMs: number): number {
  const transcurridos = Math.floor((nowMs - fechaInicioMs) / MS_DIA)
  return Math.max(0, transcurridos + dayOffset)
}

export function isSeasonOver(day: number, config: GameConfig = GAME_CONFIG): boolean {
  return day >= config.diasTemporada
}

/** Milisegundos que faltan para que empiece el siguiente día de temporada. */
export function msUntilNextDay(fechaInicioMs: number, nowMs: number): number {
  const transcurrido = (nowMs - fechaInicioMs) % MS_DIA
  return MS_DIA - (transcurrido < 0 ? transcurrido + MS_DIA : transcurrido)
}

/** dayOffset necesario para saltar al día `objetivo` (p. ej. el final de la semana). */
export function offsetForDay(fechaInicioMs: number, nowMs: number, objetivo: number): number {
  return objetivo - Math.floor((nowMs - fechaInicioMs) / MS_DIA)
}
