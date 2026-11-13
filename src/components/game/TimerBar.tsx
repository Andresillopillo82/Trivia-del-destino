import { GAME_CONFIG } from '../../config/gameConfig'

interface Props {
  remainingMs: number
  totalMs?: number
}

/** Barra de tiempo que se vacía; cambia a rojo en los últimos 5 segundos. */
export function TimerBar({ remainingMs, totalMs = GAME_CONFIG.tiempoPreguntaMs }: Props) {
  const segundos = Math.ceil(remainingMs / 1000)
  const pct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))
  const urgente = remainingMs <= 5_000
  const rapido = totalMs - remainingMs < GAME_CONFIG.umbralRapidezMs

  return (
    <div className="w-full" role="timer" aria-label={`Quedan ${segundos} segundos`}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className={rapido ? 'text-oro-claro' : 'text-niebla'}>
          {rapido ? `Bonus de rapidez: ${Math.ceil((GAME_CONFIG.umbralRapidezMs - (totalMs - remainingMs)) / 1000)} s` : 'Sin bonus'}
        </span>
        <span
          aria-hidden
          className={`font-display text-2xl font-bold tabular-nums ${urgente ? 'text-error' : 'text-oro-claro'}`}
        >
          {segundos}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-noche-3 ring-1 ring-oro/20">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
            urgente ? 'bg-error' : 'bg-gradient-to-r from-oro-oscuro via-oro to-oro-claro'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
