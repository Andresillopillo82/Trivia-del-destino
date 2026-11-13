import { FirebaseError } from 'firebase/app'

/** Error con un mensaje listo para mostrar al usuario (en español). */
export class GameError extends Error {
  constructor(
    message: string,
    readonly code: string = 'juego',
  ) {
    super(message)
    this.name = 'GameError'
  }
}

const MENSAJES: Record<string, string> = {
  'permission-denied': 'No tienes permiso para hacer eso.',
  unavailable: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
  'deadline-exceeded': 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
  'not-found': 'No se encontró lo que buscabas.',
  'already-exists': 'Eso ya existe.',
  'resource-exhausted': 'Se alcanzó el límite gratuito de Firebase por hoy.',
  'failed-precondition': 'La operación no se pudo completar en este momento.',
  'auth/network-request-failed': 'No hay conexión a internet para iniciar sesión.',
  'auth/admin-restricted-operation': 'El inicio de sesión anónimo no está activado en Firebase.',
  'auth/operation-not-allowed': 'El inicio de sesión anónimo no está activado en Firebase.',
  'auth/invalid-api-key': 'La configuración de Firebase (.env) no es válida.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
}

/** Convierte cualquier error en un mensaje claro para la interfaz. */
export function friendlyError(err: unknown, porDefecto = 'Algo salió mal. Inténtalo de nuevo.'): string {
  if (err instanceof GameError) return err.message
  if (err instanceof FirebaseError) return MENSAJES[err.code] ?? porDefecto
  if (typeof navigator !== 'undefined' && !navigator.onLine) return MENSAJES.unavailable!
  return porDefecto
}

export function isPermissionDenied(err: unknown): boolean {
  return err instanceof FirebaseError && err.code === 'permission-denied'
}

/** Rechaza si la promesa no termina a tiempo (las escrituras offline quedan pendientes indefinidamente). */
export function withTimeout<T>(p: Promise<T>, ms: number, mensaje: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new GameError(mensaje, 'timeout')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e: unknown) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}
