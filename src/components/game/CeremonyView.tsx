import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import confetti from 'canvas-confetti'
import type { StandingRow, Titles } from '../../game/types'
import { plural } from '../../lib/format'
import { AvatarIcon } from '../tarot/AvatarIcon'
import { DestinyCard } from '../tarot/DestinyCard'

interface Props {
  titles: Titles
  standings: StandingRow[]
  nombreGrupo: string
  /** Tipografía grande para la pantalla de la exposición. */
  large?: boolean
}

const DORADOS = ['#D4AF37', '#F1D77A', '#FFF6D6', '#8B5CF6', '#C4B5FD']

/** Ceremonia de fin de temporada: carta dorada, confeti y títulos. */
export function CeremonyView({ titles, standings, nombreGrupo, large = false }: Props) {
  const reduce = useReducedMotion()
  const campeon = titles.duenoDelDestino

  useEffect(() => {
    if (reduce || !campeon) return
    const fin = Date.now() + 3_500
    let raf = 0
    const lluvia = () => {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: DORADOS, disableForReducedMotion: true })
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: DORADOS, disableForReducedMotion: true })
      if (Date.now() < fin) raf = requestAnimationFrame(lluvia)
    }
    const t = window.setTimeout(() => {
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.45 }, colors: DORADOS, disableForReducedMotion: true })
      lluvia()
    }, 900)
    return () => {
      window.clearTimeout(t)
      cancelAnimationFrame(raf)
    }
  }, [reduce, campeon?.uid])

  const podio = standings.slice(0, 3)

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <motion.p
        initial={{ opacity: 0, letterSpacing: '0.1em' }}
        animate={{ opacity: 1, letterSpacing: '0.4em' }}
        transition={{ duration: 1.2 }}
        className="text-xs text-niebla uppercase sm:text-sm"
      >
        {nombreGrupo} · fin de la temporada
      </motion.p>

      {campeon ? (
        <>
          <div className="relative">
            <motion.div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-oro/30 blur-3xl"
              animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div
              initial={{ rotateY: 180, scale: 0.4, y: 60, opacity: 0 }}
              animate={{ rotateY: 0, scale: 1, y: 0, opacity: 1 }}
              transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ transformPerspective: 1200 }}
            >
              <DestinyCard nombre={campeon.apodo} className={`drop-shadow-[0_0_40px_rgba(212,175,55,0.55)] ${large ? 'w-72' : 'w-52 sm:w-60'}`} />
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
            <h1 className={`texto-oro font-bold ${large ? 'text-6xl' : 'text-4xl sm:text-5xl'}`}>{campeon.apodo}</h1>
            <p className={`mt-2 text-pergamino ${large ? 'text-2xl' : 'text-lg'}`}>
              es el <span className="font-display text-oro-claro">Dueño del Destino</span> con {campeon.puntos} puntos
            </p>
          </motion.div>
        </>
      ) : (
        <h1 className="texto-oro text-3xl font-bold">La temporada terminó sin puntos</h1>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="grid w-full max-w-2xl gap-4 sm:grid-cols-2"
      >
        <Titulo nombre="El Vidente" detalle="más aciertos seguidos" fila={titles.vidente} valor={(r) => plural(r.mejorRacha, 'acierto')} large={large} />
        <Titulo
          nombre="El Retador"
          detalle="más retos ganados"
          fila={titles.retador}
          valor={(r) => plural(r.retosGanados, 'reto', 'retos')}
          large={large}
        />
      </motion.div>

      {podio.length > 1 && (
        <motion.ol
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.3 }}
          className="flex flex-wrap justify-center gap-3"
          aria-label="Podio"
        >
          {podio.map((r) => (
            <li key={r.uid} className="panel flex items-center gap-2 px-4 py-2">
              <span className="font-display text-oro-claro">{r.posicion}.º</span>
              <AvatarIcon avatar={r.avatar} size={28} decorative />
              <span>{r.apodo}</span>
              <span className="text-sm text-niebla">{r.puntos} pts</span>
            </li>
          ))}
        </motion.ol>
      )}
    </div>
  )
}

function Titulo({
  nombre,
  detalle,
  fila,
  valor,
  large,
}: {
  nombre: string
  detalle: string
  fila: StandingRow | null
  valor: (r: StandingRow) => string
  large: boolean
}) {
  return (
    <div className="panel flex items-center gap-4 p-4 text-left">
      {fila ? <AvatarIcon avatar={fila.avatar} size={large ? 64 : 48} decorative /> : <span className="size-12" />}
      <div>
        <p className={`font-display text-oro-claro ${large ? 'text-2xl' : 'text-lg'}`}>{nombre}</p>
        <p className={large ? 'text-xl' : ''}>{fila ? fila.apodo : 'Sin ganador'}</p>
        <p className="text-sm text-niebla">{fila ? `${valor(fila)} · ${detalle}` : detalle}</p>
      </div>
    </div>
  )
}
