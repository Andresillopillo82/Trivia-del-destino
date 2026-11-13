import { Timestamp, serverTimestamp, type DocumentData } from 'firebase/firestore'
import { GAME_CONFIG, type QuickMatchConfig } from '../config/gameConfig'
import { isAvatarId, type AvatarId } from '../game/avatars'
import type { QuickPlayer, QuickRoom, QuickStatus } from '../game/quick/room'

/** Documentos de la Partida Rápida (`quickRooms/**`). Mantener en sincronía con firestore.rules. */

export const quickPaths = {
  room: (code: string) => `quickRooms/${code}`,
  players: (code: string) => `quickRooms/${code}/players`,
  player: (code: string, uid: string) => `quickRooms/${code}/players/${uid}`,
}

export function quickRoomDoc(hostUid: string, hostPlays: boolean, seed: number, config: QuickMatchConfig, nowMs: number) {
  return {
    hostUid,
    hostPlays,
    status: 'lobby',
    round: 1,
    seed,
    config: { ...config, difficulty: config.difficulty.map((d) => ({ ...d })) },
    evitar: [],
    createdAt: serverTimestamp(),
    startedAt: null,
    // Las reglas exigen exactamente creación + roomTtlMs (6 h); el servidor no conoce el TTL.
    expiresAt: Timestamp.fromMillis(nowMs + config.roomTtlMs),
  }
}

export function quickPlayerDoc(p: { apodo: string; avatar: AvatarId; esBot: boolean }, round: number) {
  return { apodo: p.apodo, avatar: p.avatar, esBot: p.esBot, round, correctas: 0, falladas: 0, finished: false, updatedAt: serverTimestamp() }
}

/** Incluye la ronda: una escritura atrasada de la ronda anterior la rechazan las reglas. */
export function quickProgressPatch(p: { correctas: number; falladas: number; finished: boolean }, round: number) {
  return { round, correctas: p.correctas, falladas: p.falladas, finished: p.finished, updatedAt: serverTimestamp() }
}

function millis(v: unknown): number | null {
  return v instanceof Timestamp ? v.toMillis() : null
}

function readConfig(v: unknown): QuickMatchConfig {
  const base = GAME_CONFIG.quickMatch
  if (typeof v !== 'object' || v === null) return base
  const c = v as Record<string, unknown>
  const num = (k: keyof QuickMatchConfig) => (typeof c[k] === 'number' ? (c[k] as number) : (base[k] as number))
  const difficulty = Array.isArray(c.difficulty)
    ? c.difficulty.filter((d): d is { desde: number; hard: number } => typeof d?.desde === 'number' && typeof d?.hard === 'number')
    : base.difficulty
  return {
    startSeconds: num('startSeconds'),
    correctBonus: num('correctBonus'),
    wrongPenalty: num('wrongPenalty'),
    maxSeconds: c.maxSeconds === null ? null : num('maxSeconds'),
    hardTimeoutMs: num('hardTimeoutMs'),
    maxPlayers: num('maxPlayers'),
    maxBots: num('maxBots'),
    feedbackMs: num('feedbackMs'),
    syncEveryMs: num('syncEveryMs'),
    roomTtlMs: num('roomTtlMs'),
    difficulty,
  }
}

export function readQuickRoom(code: string, d: DocumentData): QuickRoom {
  const status: QuickStatus = d.status === 'playing' || d.status === 'finished' ? d.status : 'lobby'
  return {
    code,
    hostUid: String(d.hostUid ?? ''),
    hostPlays: d.hostPlays === true,
    status,
    round: typeof d.round === 'number' ? d.round : 1,
    seed: typeof d.seed === 'number' ? d.seed : 0,
    config: readConfig(d.config),
    evitar: Array.isArray(d.evitar) ? d.evitar.filter((x: unknown): x is string => typeof x === 'string') : [],
    createdAtMs: millis(d.createdAt) ?? 0,
    startedAtMs: millis(d.startedAt),
    expiresAtMs: millis(d.expiresAt) ?? 0,
  }
}

export function readQuickPlayer(uid: string, d: DocumentData): QuickPlayer {
  return {
    uid,
    apodo: String(d.apodo ?? '¿?'),
    avatar: isAvatarId(d.avatar) ? d.avatar : 'estrella',
    esBot: d.esBot === true,
    round: typeof d.round === 'number' ? d.round : 0,
    correctas: typeof d.correctas === 'number' ? d.correctas : 0,
    falladas: typeof d.falladas === 'number' ? d.falladas : 0,
    finished: d.finished === true,
  }
}
