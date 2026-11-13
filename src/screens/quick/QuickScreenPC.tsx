import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LiveBars, QuickPlayerList, QuickPodium, QuickRoomCode } from '../../components/quick/QuickParts'
import { LoadingScreen, StatusScreen } from '../../components/ui/StatusScreen'
import { normalizeGroupCode } from '../../game/codes'
import { quickWinners } from '../../game/quick/ranking'
import { hardDeadlineMs, isExpired, playersOfRound, stillPlaying, type QuickPlayer, type QuickRoom } from '../../game/quick/room'
import { useServerNow } from '../../hooks/useServerNow'
import { formatDuration, plural } from '../../lib/format'
import { friendlyError } from '../../services/errors'
import { watchQuickPlayers, watchQuickRoom } from '../../services/quick'

/** Vista para proyectar la sala, legible a distancia: lobby con código y QR, barras en vivo y podio. */
export function QuickProjection({ room, players, children }: { room: QuickRoom; players: QuickPlayer[]; children?: ReactNode }) {
  const now = useServerNow(1000)
  const limite = hardDeadlineMs(room)
  const vencida = room.status === 'playing' && limite !== null && now >= limite
  const ronda = playersOfRound(room, players)

  let cuerpo: ReactNode
  if (room.status === 'lobby') {
    cuerpo = (
      <div className="grid flex-1 items-center gap-10 lg:grid-cols-[auto_1fr]">
        <QuickRoomCode code={room.code} large />
        <div className="flex flex-col gap-6">
          <h2 className="font-display text-4xl text-oro-claro">{plural(players.length, 'jugador', 'jugadores')} en la sala</h2>
          <QuickPlayerList players={players} large />
          <p className="text-2xl text-niebla">
            Escanea el QR o entra en Partida Rápida → «Unirme con código». {room.config.startSeconds} s para cada uno: acierto +
            {room.config.correctBonus} s, fallo −{room.config.wrongPenalty} s.
          </p>
        </div>
      </div>
    )
  } else if (room.status === 'playing' && !vencida) {
    const quedan = stillPlaying(room, players)
    cuerpo = (
      <div className="flex flex-1 flex-col gap-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="texto-oro font-display text-5xl font-bold">¡A jugar!</h2>
          <p className="text-3xl text-niebla" aria-live="polite">
            {quedan > 0 ? `${plural(quedan, 'sigue', 'siguen')} jugando` : 'Calculando resultados…'}
            {limite !== null && ` · límite ${formatDuration(Math.max(0, limite - now))}`}
          </p>
        </div>
        <LiveBars players={ronda} large />
      </div>
    )
  } else {
    const ganadores = quickWinners(ronda)
    cuerpo = (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8">
        <h2 className="texto-oro text-center font-display text-6xl font-bold">
          {ganadores.length === 1 ? `¡Gana ${ganadores[0]!.apodo}!` : ganadores.length > 1 ? '¡Empate en la cima!' : 'Partida terminada'}
        </h2>
        <QuickPodium players={ronda} large />
      </div>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col gap-8 px-8 py-8 xl:px-16">
      <header className="flex items-center justify-between gap-4">
        <p className="font-display text-3xl tracking-widest text-oro-claro">Partida Rápida</p>
        <p className="font-display text-3xl tracking-[0.3em] text-niebla">
          {room.code}
          {room.round > 1 && <span className="text-2xl tracking-normal"> · ronda {room.round}</span>}
        </p>
      </header>
      {cuerpo}
      {children && <footer className="flex flex-wrap items-center justify-center gap-4">{children}</footer>}
    </main>
  )
}

/** /sala/:code/pantalla — solo lectura, para proyectar en una PC. */
export function QuickScreenPC() {
  const { code: raw = '' } = useParams()
  const code = normalizeGroupCode(raw)
  const [room, setRoom] = useState<QuickRoom | null | undefined>(undefined)
  const [players, setPlayers] = useState<QuickPlayer[]>([])
  const [error, setError] = useState<string | null>(null)
  const now = useServerNow(60_000)

  useEffect(() => watchQuickRoom(code, setRoom, (e) => setError(friendlyError(e))), [code])
  useEffect(() => watchQuickPlayers(code, setPlayers, (e) => setError(friendlyError(e))), [code])

  if (error) return <StatusScreen title="No se pudo abrir la sala">{error}</StatusScreen>
  if (room === undefined) return <LoadingScreen text="Buscando la sala…" />
  if (room === null || isExpired(room, now))
    return (
      <StatusScreen title={room === null ? 'La sala se cerró' : 'Esta sala caducó'}>
        <Link to="/" className="text-oro-claro underline underline-offset-4">
          Ir al inicio
        </Link>
      </StatusScreen>
    )
  return <QuickProjection room={room} players={players} />
}
