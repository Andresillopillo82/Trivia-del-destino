import { onAuthStateChanged, signInAnonymously, type Unsubscribe } from 'firebase/auth'
import { auth } from '../config/firebase'

/** Observa la sesión; `uid` es null mientras no hay sesión. */
export function watchAuth(cb: (uid: string | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, (user) => cb(user?.uid ?? null))
}

let enCurso: Promise<string> | null = null

/**
 * Devuelve el uid de la sesión anónima, creándola si no existe.
 * La sesión persiste en el dispositivo, así que el jugador conserva su identidad al volver.
 *
 * Las llamadas simultáneas comparten un único inicio de sesión: si no, se crearían dos usuarios
 * anónimos y el uid devuelto podría no ser el del token que usa Firestore (pasa, por ejemplo,
 * con el doble montaje de efectos de React en desarrollo).
 */
export function ensureAnonymousUser(): Promise<string> {
  enCurso ??= (async () => {
    await auth.authStateReady()
    if (!auth.currentUser) await signInAnonymously(auth)
    const user = auth.currentUser
    if (!user) throw new Error('No se pudo iniciar la sesión anónima')
    return user.uid
  })().finally(() => {
    enCurso = null
  })
  return enCurso
}
