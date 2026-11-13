import { useEffect, useState } from 'react'
import { serverNow } from '../services/clock'

/** Hora del servidor (estimada) que se actualiza cada `intervalMs`. */
export function useServerNow(intervalMs = 1000, activo = true): number {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    if (!activo) return
    setNow(serverNow())
    const t = window.setInterval(() => setNow(serverNow()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs, activo])
  return now
}
