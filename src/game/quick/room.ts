import type { QuickMatchConfig } from '../../config/gameConfig'
import type { AvatarId } from '../avatars'
import type { Rng } from '../rng'
import type { Question } from '../types'
import { buildQuickSequence } from './sequence'

export type QuickStatus = 'lobby' | 'playing' | 'finished'

/** Sala temporal de la Partida Rápida (`quickRooms/{code}`). */
export interface QuickRoom {
  code: string
  hostUid: string
  /** false = el anfitrión solo proyecta la sala, sin jugar. */
  hostPlays: boolean
  status: QuickStatus
  round: number
  seed: number
  config: QuickMatchConfig
  /** Preguntas de la ronda anterior (la revancha las evita si puede). */
  evitar: string[]
  createdAtMs: number
  startedAtMs: number | null
  expiresAtMs: number
}

/** Jugador de una sala (`quickRooms/{code}/players/{uid}`): solo contadores, sin respuestas. */
export interface QuickPlayer {
  uid: string
  apodo: string
  avatar: AvatarId
  esBot: boolean
  round: number
  correctas: number
  falladas: number
  finished: boolean
}

export type JoinCheck = 'ok' | 'expirada' | 'empezada' | 'llena' | 'dentro'

/** Semilla nueva (entero de 32 bits sin signo). */
export function newSeed(rng: Rng): number {
  return Math.floor(rng() * 4294967296) >>> 0
}

export function newRoom(code: string, hostUid: string, hostPlays: boolean, seed: number, nowMs: number, config: QuickMatchConfig): QuickRoom {
  return {
    code,
    hostUid,
    hostPlays,
    status: 'lobby',
    round: 1,
    seed,
    config,
    evitar: [],
    createdAtMs: nowMs,
    startedAtMs: null,
    expiresAtMs: nowMs + config.roomTtlMs,
  }
}

export function isExpired(room: QuickRoom, nowMs: number): boolean {
  return nowMs >= room.expiresAtMs
}

/** Jugadores que participan en la ronda actual. */
export function playersOfRound(room: QuickRoom, players: readonly QuickPlayer[]): QuickPlayer[] {
  return players.filter((p) => p.round === room.round)
}

export function canJoin(room: QuickRoom, players: readonly QuickPlayer[], uid: string, nowMs: number): JoinCheck {
  if (isExpired(room, nowMs)) return 'expirada'
  if (players.some((p) => p.uid === uid)) return 'dentro'
  if (room.status !== 'lobby') return 'empezada'
  if (players.filter((p) => !p.esBot).length >= room.config.maxPlayers) return 'llena'
  return 'ok'
}

/**
 * Se puede iniciar con al menos un jugador en la ronda, cuando el anfitrión (si juega) y los bots
 * ya volvieron a la ronda actual (tras una revancha tardan un instante en reiniciarse).
 */
export function canStart(room: QuickRoom, players: readonly QuickPlayer[]): boolean {
  const listo = (p: QuickPlayer) => p.round === room.round
  return (
    room.status === 'lobby' &&
    playersOfRound(room, players).length > 0 &&
    (!room.hostPlays || players.some((p) => p.uid === room.hostUid && listo(p))) &&
    players.filter((p) => p.esBot).every(listo)
  )
}

export function startRoom(room: QuickRoom, nowMs: number): QuickRoom {
  if (room.status !== 'lobby') throw new Error('Solo se puede iniciar desde el lobby')
  return { ...room, status: 'playing', startedAtMs: nowMs }
}

export function finishRoom(room: QuickRoom): QuickRoom {
  if (room.status !== 'playing') throw new Error('La partida no está en juego')
  return { ...room, status: 'finished' }
}

/** Revancha: misma sala, ronda siguiente, semilla nueva y vuelta al lobby. */
export function rematchRoom(room: QuickRoom, seed: number, evitar: string[]): QuickRoom {
  if (room.status !== 'finished') throw new Error('La revancha se pide al terminar')
  return { ...room, status: 'lobby', round: room.round + 1, seed, evitar, startedAtMs: null }
}

/** Momento en que la partida termina sí o sí (límite global). */
export function hardDeadlineMs(room: QuickRoom): number | null {
  return room.startedAtMs === null ? null : room.startedAtMs + room.config.hardTimeoutMs
}

/** Jugadores de la ronda que aún no han terminado. */
export function stillPlaying(room: QuickRoom, players: readonly QuickPlayer[]): number {
  return playersOfRound(room, players).filter((p) => !p.finished).length
}

/** El anfitrión cierra la partida cuando todos terminaron o se alcanzó el límite global. */
export function shouldFinish(room: QuickRoom, players: readonly QuickPlayer[], nowMs: number): boolean {
  if (room.status !== 'playing') return false
  const limite = hardDeadlineMs(room)
  if (limite !== null && nowMs >= limite) return true
  const ronda = playersOfRound(room, players)
  return ronda.length > 0 && ronda.every((p) => p.finished)
}

/** Preguntas que vio alguien en la ronda (las que evitará la revancha). */
export function usedQuestionIds(room: QuickRoom, players: readonly QuickPlayer[], questions: readonly Question[]): string[] {
  const max = Math.max(0, ...playersOfRound(room, players).map((p) => p.correctas + p.falladas + 1))
  return buildQuickSequence(room.seed, questions, room.config, max, room.evitar).map((q) => q.id)
}
