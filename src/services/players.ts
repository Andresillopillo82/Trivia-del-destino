import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { PlayerInfo } from '../game/types'
import { paths, readPlayer } from './docs'

/** Jugadores del grupo en tiempo real. */
export function watchPlayers(
  code: string,
  cb: (players: PlayerInfo[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, paths.players(code)),
    (snap) => cb(snap.docs.map((d) => readPlayer(d.id, d.data()))),
    onError,
  )
}
