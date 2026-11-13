import { Link } from 'react-router-dom'
import { GAME_CONFIG } from '../../config/gameConfig'

/** Acceso a la Partida Rápida desde Inicio (con o sin grupo). */
export function QuickMatchBanner({ sinGrupo = false }: { sinGrupo?: boolean }) {
  return (
    <section aria-labelledby="rapida-titulo" className="panel flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <h2 id="rapida-titulo" className="font-display text-lg text-oro-claro">
          Partida Rápida
        </h2>
        <p className="text-sm text-niebla">
          {GAME_CONFIG.quickMatch.startSeconds} s contrarreloj en una sala con código.{' '}
          {sinGrupo ? 'No hace falta grupo.' : 'Aparte del Modo Destino: no cuenta para la clasificación.'}
        </p>
      </div>
      <Link
        to="/rapida"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violeta-claro/70 bg-violeta px-5 font-display text-sm font-semibold tracking-wider text-pergamino uppercase hover:bg-[#6a33a0]"
      >
        Crear sala o unirme
      </Link>
    </section>
  )
}
