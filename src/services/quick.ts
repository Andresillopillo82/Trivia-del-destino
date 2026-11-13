import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { GAME_CONFIG } from '../config/gameConfig'
import type { AvatarId } from '../game/avatars'
import type { BotProfile } from '../game/bots'
import { generateGroupCode, isValidGroupCode, normalizeGroupCode } from '../game/codes'
import { defaultRng } from '../game/rng'
import { canJoin, newSeed, type QuickPlayer, type QuickRoom } from '../game/quick/room'
import { serverNow } from './clock'
import { GameError } from './errors'
import { quickPaths, quickPlayerDoc, quickProgressPatch, quickRoomDoc, readQuickPlayer, readQuickRoom } from './quickDocs'

export { quickPaths }

/**
 * Partida Rápida: salas temporales `quickRooms/{code}` con sus jugadores. No lee ni escribe nada
 * de `groups/` ni del perfil del Modo Destino. Mantener en sincronía con firestore.rules.
 */

const MAX_INTENTOS_CODIGO = 6

// ---------- escuchas ----------

export function watchQuickRoom(code: string, cb: (room: QuickRoom | null) => void, onError: (e: unknown) => void): Unsubscribe {
  return onSnapshot(
    doc(db, quickPaths.room(code)),
    (snap) => cb(snap.exists() ? readQuickRoom(code, snap.data({ serverTimestamps: 'estimate' })) : null),
    onError,
  )
}

/** Solo en el lobby, al terminar y en la pantalla de sala (durante la partida, solo el anfitrión). */
export function watchQuickPlayers(code: string, cb: (players: QuickPlayer[]) => void, onError: (e: unknown) => void): Unsubscribe {
  return onSnapshot(
    collection(db, quickPaths.players(code)),
    (snap) => cb(snap.docs.map((d) => readQuickPlayer(d.id, d.data()))),
    onError,
  )
}

// ---------- acciones ----------

export function parseQuickCode(raw: string): string {
  const code = normalizeGroupCode(raw)
  if (!isValidGroupCode(code)) throw new GameError('El código debe tener 5 caracteres (letras y números).')
  return code
}

/** Crea una sala con código único (transacción: no pisa una sala existente). */
export async function createQuickRoom(host: { uid: string; apodo: string; avatar: AvatarId }, hostPlays: boolean): Promise<string> {
  const config = GAME_CONFIG.quickMatch
  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento++) {
    const code = generateGroupCode()
    const creada = await runTransaction(db, async (tx) => {
      const ref = doc(db, quickPaths.room(code))
      if ((await tx.get(ref)).exists()) return false
      tx.set(ref, quickRoomDoc(host.uid, hostPlays, newSeed(defaultRng), config, serverNow()))
      if (hostPlays) tx.set(doc(db, quickPaths.player(code, host.uid)), quickPlayerDoc({ ...host, esBot: false }, 1))
      return true
    })
    if (creada) return code
  }
  throw new GameError('No se pudo generar un código de sala libre. Inténtalo de nuevo.')
}

/** Entra a una sala en el lobby (si ya estaba dentro, no hace nada). */
export async function joinQuickRoom(rawCode: string, me: { uid: string; apodo: string; avatar: AvatarId }): Promise<QuickRoom> {
  const code = parseQuickCode(rawCode)
  const snap = await getDocFromServer(doc(db, quickPaths.room(code)))
  if (!snap.exists()) throw new GameError('No existe ninguna sala con ese código.')
  const room = readQuickRoom(code, snap.data())
  const players = (await getDocsFromServer(collection(db, quickPaths.players(code)))).docs.map((d) => readQuickPlayer(d.id, d.data()))
  switch (canJoin(room, players, me.uid, serverNow())) {
    case 'dentro':
      return room
    case 'expirada':
      throw new GameError('Esta sala ya caducó.')
    case 'empezada':
      throw new GameError('La partida ya empezó. Espera a la revancha.')
    case 'llena':
      throw new GameError(`La sala está llena (máximo ${room.config.maxPlayers} jugadores).`)
  }
  await setDoc(doc(db, quickPaths.player(code, me.uid)), quickPlayerDoc({ ...me, esBot: false }, room.round))
  return room
}

/** Al empezar una ronda nueva (revancha), el jugador pone sus contadores a cero. */
export function resetQuickPlayer(code: string, uid: string, round: number) {
  return updateDoc(doc(db, quickPaths.player(code, uid)), { round, correctas: 0, falladas: 0, finished: false, updatedAt: serverTimestamp() })
}

export function syncQuickProgress(code: string, uid: string, round: number, p: { correctas: number; falladas: number; finished: boolean }) {
  return updateDoc(doc(db, quickPaths.player(code, uid)), quickProgressPatch(p, round))
}

/** Lee una vez la ficha propia (al volver a abrir la sala en mitad de una partida). */
export async function getQuickPlayer(code: string, uid: string): Promise<QuickPlayer | null> {
  const snap = await getDocFromServer(doc(db, quickPaths.player(code, uid)))
  return snap.exists() ? readQuickPlayer(uid, snap.data()) : null
}

/** Quien recarga en mitad de la partida no puede volver a empezar: queda terminado. */
export function markQuickFinished(code: string, uid: string) {
  return updateDoc(doc(db, quickPaths.player(code, uid)), { finished: true, updatedAt: serverTimestamp() })
}

export function leaveQuickRoom(code: string, uid: string) {
  return deleteDoc(doc(db, quickPaths.player(code, uid)))
}

// ---------- anfitrión ----------

export function startQuickRoom(code: string) {
  return updateDoc(doc(db, quickPaths.room(code)), { status: 'playing', startedAt: serverTimestamp() })
}

export function finishQuickRoom(code: string) {
  return updateDoc(doc(db, quickPaths.room(code)), { status: 'finished' })
}

/** Revancha: ronda siguiente, semilla nueva y las preguntas de esta ronda para evitarlas. */
export function rematchQuickRoom(room: QuickRoom, evitar: string[]) {
  return updateDoc(doc(db, quickPaths.room(room.code)), {
    status: 'lobby',
    round: room.round + 1,
    seed: newSeed(defaultRng),
    evitar,
    startedAt: null,
  })
}

export function addQuickBot(code: string, bot: BotProfile, round: number) {
  return setDoc(doc(db, quickPaths.player(code, bot.uid)), quickPlayerDoc({ apodo: bot.apodo, avatar: bot.avatar, esBot: true }, round))
}

export function removeQuickPlayer(code: string, uid: string) {
  return deleteDoc(doc(db, quickPaths.player(code, uid)))
}

/** Cierra la sala: borra a todos los jugadores y la sala en un lote. */
export async function closeQuickRoom(code: string) {
  const jugadores = await getDocsFromServer(collection(db, quickPaths.players(code)))
  const batch = writeBatch(db)
  for (const d of jugadores.docs) batch.delete(doc(db, quickPaths.player(code, d.id)))
  batch.delete(doc(db, quickPaths.room(code)))
  await batch.commit()
}
