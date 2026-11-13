/**
 * Diferencia entre el reloj del dispositivo y el del servidor. Las reglas calculan el día con
 * la hora del servidor, así que el cliente usa serverNow() para no desfasarse si el reloj del
 * celular está mal.
 */
let offsetMs = 0

export function serverNow(): number {
  return Date.now() + offsetMs
}

/** Ajusta el desfase a partir de una marca de tiempo del servidor y el intervalo local en que se pidió. */
export function syncClock(serverMs: number, localStartMs: number, localEndMs: number): void {
  offsetMs = serverMs - (localStartMs + localEndMs) / 2
}

export function clockOffsetMs(): number {
  return offsetMs
}
