import { useEffect, useRef } from 'react'

/**
 * Atajo de teclado de una tecla (sin modificadores). Se ignora mientras se escribe en un campo
 * o hay un diálogo abierto.
 */
export function useHotkey(key: string, handler: () => void, enabled = true): void {
  const ref = useRef(handler)
  ref.current = handler

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.key.toLowerCase() !== key.toLowerCase()) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      if (document.querySelector('dialog[open]')) return
      e.preventDefault()
      ref.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, enabled])
}
