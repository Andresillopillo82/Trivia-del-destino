/** Código de grupo recibido por enlace o QR, pendiente hasta que el jugador tenga perfil. */
const KEY = 'trivia:unirse'

export function setPendingJoin(code: string): void {
  try {
    sessionStorage.setItem(KEY, code)
  } catch {
    // Navegación privada sin almacenamiento: se pierde el código, pero se puede escribir a mano.
  }
}

export function getPendingJoin(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingJoin(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignorar
  }
}
