import { LayoutGroup, motion } from 'framer-motion'
import type { StandingRow } from '../../game/types'
import { formatSeconds, plural } from '../../lib/format'
import { AvatarIcon } from '../tarot/AvatarIcon'

interface Props {
  rows: StandingRow[]
  meUid?: string | null
  /** Muestra solo los primeros N (y siempre la fila propia). */
  limit?: number
  /** Columnas de estadísticas completas. */
  detailed?: boolean
  /** Tipografía grande para el modo presentación. */
  large?: boolean
  emptyText?: string
}

const MEDALLAS = ['text-oro-claro', 'text-[#d9d9e3]', 'text-[#d79a6a]']

/** Clasificación con animación cuando cambian las posiciones. */
export function Leaderboard({ rows, meUid, limit, detailed = false, large = false, emptyText }: Props) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-niebla">{emptyText ?? 'Aún no hay jugadores.'}</p>
  }

  let visibles = rows
  if (limit && rows.length > limit) {
    visibles = rows.slice(0, limit)
    const mia = rows.find((r) => r.uid === meUid)
    if (mia && !visibles.includes(mia)) visibles = [...visibles, mia]
  }

  return (
    <LayoutGroup>
      <ol className={`flex flex-col ${large ? 'gap-3' : 'gap-2'}`} aria-label="Clasificación">
        {visibles.map((r, i) => {
          const yo = r.uid === meUid
          const separado = limit && i === limit && visibles.length > limit
          return (
            <motion.li
              key={r.uid}
              layout
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className={`${separado ? 'mt-2 border-t border-dashed border-oro/20 pt-2' : ''}`}
            >
              <div
                className={`flex items-center gap-3 rounded-xl border ${large ? 'px-5 py-4' : 'px-3 py-2'} ${
                  yo ? 'border-oro/70 bg-violeta/35' : 'border-oro/15 bg-noche-2/70'
                }`}
              >
                <span
                  className={`shrink-0 text-center font-display font-bold tabular-nums ${large ? 'w-12 text-3xl' : 'w-7 text-lg'} ${
                    MEDALLAS[r.posicion - 1] ?? 'text-niebla'
                  }`}
                >
                  {r.posicion}
                </span>
                <AvatarIcon avatar={r.avatar} size={large ? 56 : 34} decorative />
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-semibold ${large ? 'text-2xl' : 'text-sm sm:text-base'}`}>
                    {r.apodo}
                    {yo && <span className="ml-2 rounded bg-oro/20 px-1.5 py-0.5 text-xs text-oro-claro">Tú</span>}
                    {r.esBot && <span className="ml-2 rounded bg-noche-3 px-1.5 py-0.5 text-xs text-niebla">bot</span>}
                  </p>
                  {(detailed || large) && (
                    <p className={`text-niebla ${large ? 'text-base' : 'text-xs'}`}>
                      {plural(r.aciertos, 'acierto')} · racha {r.rachaActual} (mejor {r.mejorRacha}) · {formatSeconds(r.tiempoPromedioMs)}{' '}
                      prom.
                      {r.retosLanzados + r.retosGanados > 0 && ` · ${plural(r.retosGanados, 'reto ganado', 'retos ganados')}`}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 text-right font-display font-bold tabular-nums text-oro-claro ${large ? 'text-4xl' : 'text-lg'}`}>
                  {r.puntos}
                  <span className={`ml-1 font-sans font-normal text-niebla ${large ? 'text-lg' : 'text-xs'}`}>pts</span>
                </span>
              </div>
            </motion.li>
          )
        })}
      </ol>
    </LayoutGroup>
  )
}
