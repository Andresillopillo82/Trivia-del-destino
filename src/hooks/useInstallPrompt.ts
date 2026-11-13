import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// El navegador lanza `beforeinstallprompt` una sola vez, al cargar la página: se guarda aquí
// (este módulo se evalúa al arrancar) para poder ofrecer la instalación más tarde.
let diferido: BeforeInstallPromptEvent | null = null
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    diferido = e as BeforeInstallPromptEvent
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    diferido = null
    avisar()
  })
}

function enModoApp(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
}

/**
 * Instalación de la PWA. En Chrome/Edge/Android ofrece el diálogo nativo; en iPhone/iPad
 * no existe ese evento y hay que hacerlo desde Safari (Compartir → Añadir a pantalla de inicio).
 */
export function useInstallPrompt() {
  const [, setVersion] = useState(0)

  useEffect(() => {
    const f = () => setVersion((n) => n + 1)
    oyentes.add(f)
    return () => {
      oyentes.delete(f)
    }
  }, [])

  const instalar = useCallback(async () => {
    if (!diferido) return
    await diferido.prompt()
    await diferido.userChoice
    diferido = null
    avisar()
  }, [])

  const esIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
  return { puedeInstalar: !!diferido, instalar, instalada: enModoApp(), esIos }
}
