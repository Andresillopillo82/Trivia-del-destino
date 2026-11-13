import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { GAME_CONFIG } from '../config/gameConfig'
import { ActivityFeed, buildFeed } from '../components/game/ActivityFeed'
import { CeremonyView } from '../components/game/CeremonyView'
import { GroupCodeCard } from '../components/game/GroupCodeCard'
import { Leaderboard } from '../components/game/Leaderboard'
import { OrnateFrame } from '../components/ui/OrnateFrame'
import { msUntilNextDay } from '../game/day'
import { awardTitles } from '../game/titles'
import { useHotkey } from '../hooks/useHotkey'
import { useServerNow } from '../hooks/useServerNow'
import { formatDuration } from '../lib/format'
import { useGame } from '../state/GameContext'
import { useAdminActions } from '../state/useAdminActions'

/** Modo presentación: clasificación en vivo a pantalla completa para la PC de la exposición. */
export function Presentation() {
  const { group, day, seasonOver, standings, players, answers, challenges, isAdmin, online } = useGame()
  const { avanzarDia, aviso, error } = useAdminActions()
  const now = useServerNow(30_000)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)

  useHotkey('n', avanzarDia, isAdmin && !seasonOver && online)
  useHotkey('f', () => alternarPantallaCompleta())

  useEffect(() => {
    const onChange = () => setPantallaCompleta(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  if (!group) return null

  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const humanos = players.filter((p) => !p.esBot).length

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-6 py-6 xl:px-12">
      <header className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl text-oro-claro">Trivia del Destino</p>
          <h1 className="texto-oro truncate text-4xl font-bold xl:text-5xl">{group.nombre}</h1>
        </div>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={seasonOver ? 'fin' : day}
            initial={{ y: -30, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="rounded-2xl border border-oro/40 bg-noche-2/80 px-6 py-3 text-center"
          >
            <p className="font-display text-3xl font-bold text-oro-claro">
              {seasonOver ? 'Temporada terminada' : `Día ${day + 1} de ${GAME_CONFIG.diasTemporada}`}
            </p>
            {!seasonOver && <p className="text-sm text-niebla">siguiente en {formatDuration(msUntilNextDay(group.fechaInicioMs, now))}</p>}
          </motion.div>
        </AnimatePresence>
        <nav className="flex gap-2 text-sm" aria-label="Opciones de presentación">
          <button
            type="button"
            onClick={alternarPantallaCompleta}
            className="rounded-lg border border-oro/30 px-3 py-2 text-niebla hover:text-pergamino"
          >
            {pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa (F)'}
          </button>
          <Link to={isAdmin ? '/admin' : '/'} className="rounded-lg border border-oro/30 px-3 py-2 text-niebla hover:text-pergamino">
            Salir
          </Link>
        </nav>
      </header>

      {seasonOver ? (
        <div className="grid flex-1 items-center gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
          <CeremonyView titles={awardTitles(standings)} standings={standings} nombreGrupo={group.nombre} large />
          <OrnateFrame title="Clasificación final">
            <Leaderboard rows={standings} limit={8} />
          </OrnateFrame>
        </div>
      ) : (
        <div className="grid flex-1 gap-8 xl:grid-cols-[minmax(0,1fr)_440px]">
          <OrnateFrame as="section" title="Clasificación en vivo">
            <Leaderboard rows={standings} limit={8} large emptyText="Escanea el QR y sé el primero en jugar." />
          </OrnateFrame>
          <div className="flex flex-col gap-6">
            <OrnateFrame as="section">
              <GroupCodeCard code={group.code} nombre={group.nombre} large />
              <p className="mt-4 text-center text-lg text-niebla">
                Escanea el QR o entra en <span className="text-oro-claro">{window.location.host}</span> y escribe el código.
              </p>
            </OrnateFrame>
            <OrnateFrame as="section" title="Lo último">
              <ActivityFeed eventos={buildFeed(players, answers, challenges, 5)} large />
            </OrnateFrame>
          </div>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 text-sm text-niebla">
        <span>
          {humanos} {humanos === 1 ? 'persona juega' : 'personas juegan'}
          {players.length > humanos && ` · ${players.length - humanos} bots`}
        </span>
        <span aria-live="polite">
          {error ?? aviso ?? (isAdmin && !seasonOver ? 'Administrador: pulsa N para avanzar el día' : '')}
        </span>
      </footer>
    </main>
  )
}
