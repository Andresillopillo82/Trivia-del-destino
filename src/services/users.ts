import { doc, getDoc, getDocFromServer, onSnapshot, setDoc, writeBatch, type Unsubscribe } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { AvatarId } from '../game/avatars'
import { cleanText, validateApodo } from '../game/validation'
import { syncClock } from './clock'
import { paths, readUser, userDoc } from './docs'
import { GameError, isPermissionDenied } from './errors'
import type { UserProfile } from './types'

/**
 * Perfil en tiempo real. `confirmado` es false mientras hay escrituras locales sin confirmar
 * por el servidor (por ejemplo, justo después de unirse a un grupo).
 */
export function watchProfile(
  uid: string,
  cb: (profile: UserProfile | null, confirmado: boolean) => void,
  onError: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, paths.user(uid)),
    { includeMetadataChanges: true },
    (snap) => cb(snap.exists() ? readUser(uid, snap.data()) : null, !snap.metadata.hasPendingWrites),
    onError,
  )
}

/**
 * Guarda apodo y avatar. Si el jugador está en un grupo, actualiza también su ficha
 * de jugador en el mismo lote para que la clasificación muestre el cambio.
 */
export async function saveProfile(
  uid: string,
  input: { apodo: string; avatar: AvatarId },
  grupoActual: string | null,
): Promise<void> {
  const apodo = cleanText(input.apodo)
  const error = validateApodo(apodo)
  if (error) throw new GameError(error)

  const batch = writeBatch(db)
  batch.set(doc(db, paths.user(uid)), userDoc({ apodo, avatar: input.avatar }, grupoActual), { merge: true })

  if (grupoActual) {
    const playerRef = doc(db, paths.player(grupoActual, uid))
    try {
      if ((await getDoc(playerRef)).exists()) batch.update(playerRef, { apodo, avatar: input.avatar })
    } catch (e) {
      // Si ya no es miembro, la lectura se rechaza; solo se actualiza el perfil.
      if (!isPermissionDenied(e)) throw e
    }
  }

  const inicio = Date.now()
  await batch.commit()
  void syncClockFromProfile(uid, inicio)
}

/** Lee `vistoEn` (hora del servidor) para estimar el desfase del reloj local. */
async function syncClockFromProfile(uid: string, inicio: number): Promise<void> {
  try {
    const snap = await getDocFromServer(doc(db, paths.user(uid)))
    const visto = snap.get('vistoEn') as { toMillis(): number } | undefined
    if (visto) syncClock(visto.toMillis(), inicio, Date.now())
  } catch {
    // Sin conexión: se mantiene el desfase anterior.
  }
}

/** Marca la última visita y sincroniza el reloj (solo si el perfil ya existe). */
export async function touchProfile(profile: UserProfile): Promise<void> {
  const inicio = Date.now()
  await setDoc(doc(db, paths.user(profile.uid)), userDoc(profile, profile.grupoActual), { merge: true })
  await syncClockFromProfile(profile.uid, inicio)
}
