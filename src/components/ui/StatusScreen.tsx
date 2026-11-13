import type { ReactNode } from 'react'
import { Deck } from '../tarot/Deck'

interface Props {
  title: string
  children?: ReactNode
  /** Muestra el mazo barajándose (carga). */
  loading?: boolean
}

/** Pantalla centrada para carga, errores y avisos. */
export function StatusScreen({ title, children, loading = false }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      {loading && <Deck shuffling className="w-24" />}
      <h1 className="texto-oro text-2xl font-bold" aria-live="polite">
        {title}
      </h1>
      {children}
    </main>
  )
}

export function LoadingScreen({ text = 'Consultando a las estrellas…' }: { text?: string }) {
  return <StatusScreen title={text} loading />
}
