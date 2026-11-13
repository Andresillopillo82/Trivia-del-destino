import { useGame } from '../../state/GameContext'

/** Aviso cuando no hay internet; ocupa su sitio arriba en lugar de tapar la cabecera. */
export function OfflineBanner() {
  const { online } = useGame()
  if (online) return null
  return (
    <div role="status" className="sticky top-0 z-50 bg-error px-4 py-2 text-center text-sm font-medium text-noche">
      Sin conexión a internet. Ves los últimos datos guardados; para sacar tus cartas necesitas conexión.
    </div>
  )
}
