import { useEffect, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import QRCode from 'qrcode'
import { cardByName } from '../../game/cards'
import type { QuickPlayer } from '../../game/quick/room'
import { rankQuick } from '../../game/quick/ranking'
import { plural } from '../../lib/format'
import { AvatarIcon } from '../tarot/AvatarIcon'
import { CARD_SYMBOLS } from '../tarot/symbols'
import { Button } from '../ui/Button'

/** Enlace para entrar a una sala de Partida Rápida (lo lleva el QR). */
export function quickJoinUrl(code: string, origin: string = window.location.origin): string {
  return `${origin}/rapida/${code}`
}

/** Código de la sala con QR y enlace para compartir. */
export function QuickRoomCode({ code, large = false }: { code: string; large?: boolean }) {
  const url = quickJoinUrl(code)
  const [qr, setQr] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: large ? 560 : 260, color: { dark: '#0B0A10', light: '#F1D77A' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [url, large])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className={`tracking-[0.3em] text-niebla uppercase ${large ? 'text-xl' : 'text-xs'}`}>Código de la sala</p>
      <p
        className={`texto-oro font-display font-bold tracking-[0.25em] ${large ? 'text-8xl xl:text-9xl' : 'text-5xl'}`}
        aria-label={`Código: ${code.split('').join(' ')}`}
      >
        {code}
      </p>
      {qr && (
        <img
          src={qr}
          alt={`Código QR para entrar a la sala ${code}`}
          className={`rounded-xl ring-2 ring-oro/60 ${large ? 'size-72 xl:size-96' : 'size-40'}`}
        />
      )}
      {large ? (
        <p className="text-2xl text-niebla">{url.replace(/^https?:\/\//, '')}</p>
      ) : (
        <Button variant="fantasma" onClick={copiar}>
          {copiado ? '¡Enlace copiado!' : 'Copiar enlace'}
        </Button>
      )}
    </div>
  )
}

/** Jugadores de la sala, entrando en tiempo real. */
export function QuickPlayerList({
  players,
  meUid,
  large = false,
  onRemove,
}: {
  players: QuickPlayer[]
  meUid?: string | null
  large?: boolean
  onRemove?: (p: QuickPlayer) => void
}) {
  const reducir = useReducedMotion()
  if (players.length === 0) return <p className={`text-center text-niebla ${large ? 'text-2xl' : 'text-sm'}`}>Esperando jugadores…</p>
  return (
    <ul className={`grid gap-2 ${large ? 'grid-cols-3 gap-4 xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`} aria-label="Jugadores en la sala">
      <AnimatePresence initial={false}>
        {players.map((p) => (
          <motion.li
            key={p.uid}
            layout={!reducir}
            initial={reducir ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            className={`panel flex items-center gap-2 ${large ? 'p-4' : 'p-2'} ${p.uid === meUid ? 'ring-1 ring-oro' : ''}`}
          >
            <AvatarIcon avatar={p.avatar} size={large ? 56 : 32} decorative />
            <span className={`min-w-0 flex-1 truncate ${large ? 'text-2xl' : 'text-sm'}`}>
              {p.apodo}
              {p.esBot && <span className="text-niebla"> · bot</span>}
              {p.uid === meUid && <span className="text-oro-claro"> (tú)</span>}
            </span>
            {onRemove && p.uid !== meUid && (
              <button
                type="button"
                onClick={() => onRemove(p)}
                className="grid size-8 place-items-center rounded-full text-niebla hover:bg-error/15 hover:text-error"
                aria-label={`Sacar a ${p.apodo}`}
              >
                ✕
              </button>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

/** Anillo de tiempo con los segundos restantes; pulsa en rojo por debajo de 10 s. */
export function TimeRing({ remainingMs, totalMs, size = 128 }: { remainingMs: number; totalMs: number; size?: number }) {
  const segundos = Math.ceil(remainingMs / 1000)
  const urgente = remainingMs < 10_000
  const r = 44
  const c = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(1, remainingMs / totalMs))
  return (
    <div
      role="timer"
      aria-label={`Quedan ${segundos} segundos`}
      className={`relative grid place-items-center ${urgente && remainingMs > 0 ? 'motion-safe:animate-pulse' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={50} cy={50} r={r} fill="none" stroke="currentColor" strokeWidth={8} className="text-noche-3" />
        <circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className={`transition-[stroke-dashoffset] duration-100 ease-linear ${urgente ? 'stroke-error' : 'stroke-oro'}`}
        />
      </svg>
      <span aria-hidden className={`font-display font-bold tabular-nums ${urgente ? 'text-error' : 'text-oro-claro'}`} style={{ fontSize: size * 0.34 }}>
        {segundos}
      </span>
    </div>
  )
}

/** Nombre y símbolo de la carta de una pregunta (su categoría). */
export function CardBadge({ carta, large = false }: { carta: string; large?: boolean }) {
  const def = cardByName(carta)
  if (!def) return null
  const Symbol = CARD_SYMBOLS[def.id]
  return (
    <p className={`flex items-center justify-center gap-2 text-oro-claro ${large ? 'text-lg' : 'text-sm'}`}>
      <svg viewBox="0 0 100 104" className={large ? 'size-10' : 'size-7'} aria-hidden>
        <Symbol />
      </svg>
      <span className="font-display tracking-wider">{def.nombre}</span>
      <span className="text-niebla">· {def.categoria}</span>
    </p>
  )
}

const MEDALLAS = ['text-oro-claro', 'text-[#d9d9e3]', 'text-[#d79a6a]']
const ALTURAS = ['h-36', 'h-24', 'h-16']

/** Podio animado (los empatados comparten puesto) y tabla con aciertos y fallos. */
export function QuickPodium({ players, meUid, large = false }: { players: QuickPlayer[]; meUid?: string | null; large?: boolean }) {
  const reducir = useReducedMotion()
  const filas = rankQuick(players)
  const podio = filas.slice(0, 3)
  // Orden visual: 2.º, 1.º, 3.º.
  const visual = [podio[1], podio[0], podio[2]].filter((x) => x !== undefined)
  if (filas.length === 0) return <p className="text-center text-niebla">Nadie jugó esta ronda.</p>
  return (
    <div className="flex flex-col gap-6">
      <ol className="flex items-end justify-center gap-3" aria-label="Podio">
        {visual.map((f, i) => {
          const puesto = f.posicion
          return (
            <motion.li
              key={f.player.uid}
              initial={reducir ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducir ? 0 : [0.4, 0.8, 0.1][i] ?? 0, type: 'spring', stiffness: 160, damping: 18 }}
              className="flex w-28 flex-col items-center gap-1 text-center sm:w-36"
            >
              <AvatarIcon avatar={f.player.avatar} size={large ? 88 : puesto === 1 ? 64 : 48} decorative />
              <span className={`w-full truncate font-semibold ${large ? 'text-2xl' : 'text-sm'}`}>{f.player.apodo}</span>
              <span className={`text-niebla ${large ? 'text-xl' : 'text-xs'}`}>{plural(f.player.correctas, 'acierto', 'aciertos')}</span>
              <div
                className={`panel flex w-full items-start justify-center pt-2 font-display font-bold ${MEDALLAS[puesto - 1] ?? 'text-niebla'} ${
                  ALTURAS[Math.min(puesto, 3) - 1]
                } ${large ? 'text-5xl' : 'text-3xl'}`}
              >
                {puesto}
              </div>
            </motion.li>
          )
        })}
      </ol>
      <table className={`w-full text-left ${large ? 'text-2xl' : 'text-sm'}`}>
        <caption className="sr-only">Resultados de la partida</caption>
        <thead className="text-niebla">
          <tr>
            <th scope="col" className="py-1 pr-2 font-normal">#</th>
            <th scope="col" className="py-1 pr-2 font-normal">Jugador</th>
            <th scope="col" className="py-1 pr-2 text-right font-normal">Aciertos</th>
            <th scope="col" className="py-1 text-right font-normal">Fallos</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.player.uid} className={`border-t border-oro/10 ${f.player.uid === meUid ? 'text-oro-claro' : ''}`}>
              <td className="py-1.5 pr-2 tabular-nums">{f.posicion}</td>
              <td className="max-w-0 truncate py-1.5 pr-2">
                {f.player.apodo}
                {f.player.esBot && <span className="text-niebla"> · bot</span>}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-acierto">{f.player.correctas}</td>
              <td className="py-1.5 text-right tabular-nums text-error">{f.player.falladas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Barras en vivo de aciertos por jugador (se actualizan con las escrituras limitadas de cada uno). */
export function LiveBars({ players, large = false }: { players: QuickPlayer[]; large?: boolean }) {
  const reducir = useReducedMotion()
  const filas = rankQuick(players)
  const max = Math.max(1, ...players.map((p) => p.correctas))
  return (
    <LayoutGroup>
      <ol className={`flex flex-col ${large ? 'gap-4' : 'gap-2'}`} aria-label="Aciertos en vivo">
        {filas.map((f) => (
          <motion.li key={f.player.uid} layout={!reducir} className="flex items-center gap-3">
            <AvatarIcon avatar={f.player.avatar} size={large ? 52 : 28} decorative />
            <span className={`w-32 shrink-0 truncate sm:w-48 ${large ? 'text-2xl xl:w-64' : 'text-sm'}`}>{f.player.apodo}</span>
            <div className={`relative flex-1 overflow-hidden rounded-full bg-noche-3 ring-1 ring-oro/20 ${large ? 'h-10' : 'h-5'}`}>
              <motion.div
                className={`h-full rounded-full ${f.player.finished ? 'bg-violeta-claro/70' : 'bg-gradient-to-r from-oro-oscuro via-oro to-oro-claro'}`}
                initial={false}
                animate={{ width: `${(f.player.correctas / max) * 100}%` }}
                transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
            <span className={`w-20 shrink-0 text-right tabular-nums ${large ? 'text-3xl' : 'text-sm'}`}>
              {f.player.correctas}
              <span className="sr-only"> aciertos</span>
              {f.player.finished && <span className={`text-niebla ${large ? 'text-lg' : 'text-xs'}`}> ✓</span>}
            </span>
          </motion.li>
        ))}
      </ol>
    </LayoutGroup>
  )
}
