/** Estado de conexión del navegador. */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function watchOnline(cb: (online: boolean) => void): () => void {
  const on = () => cb(true)
  const off = () => cb(false)
  window.addEventListener('online', on)
  window.addEventListener('offline', off)
  cb(isOnline())
  return () => {
    window.removeEventListener('online', on)
    window.removeEventListener('offline', off)
  }
}
