import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LiveBars, QuickPlayerList, QuickPodium, QuickRoomCode } from '../../components/quick/QuickParts'
import { AvatarIcon } from '../../components/tarot/AvatarIcon'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorText } from '../../components/ui/Field'
import { OrnateFrame } from '../../components/ui/OrnateFrame'
import { LoadingScreen, StatusScreen } from '../../components/ui/StatusScreen'
import { BOT_PROFILES } from '../../game/bots'
import { normalizeGroupCode } from '../../game/codes'
import { QUESTIONS } from '../../game/questionBank'
import { quickWinners } from '../../game/quick/ranking'
import {
  canStart,
  hardDeadlineMs,
  isExpired,
  playersOfRound,
  stillPlaying,
  usedQuestionIds,
  type QuickPlayer,
  type QuickRoom,
} from '../../game/quick/room'
import { useServerNow } from '../../hooks/useServerNow'
import { plural } from '../../lib/format'
import { friendlyError } from '../../services/errors'
import {
  addQuickBot,
  closeQuickRoom,
  finishQuickRoom,
  getQuickPlayer,
  joinQuickRoom,
  leaveQuickRoom,
  markQuickFinished,
  rematchQuickRoom,
  removeQuickPlayer,
  resetQuickPlayer,
  startQuickRoom,
  watchQuickPlayers,
  watchQuickRoom,
} from '../../services/quick'
import { useGame } from '../../state/GameContext'
import { useQuickHost } from '../../state/useQuickHost'
import { QuickGame, type QuickResult } from './QuickGame'
import { QuickProjection } from './QuickScreenPC'

/** Sala de Partida Rápida: lobby, juego, espera y resultados. */
export function QuickRoomScreen() {
  const { code: raw = '' } = useParams()
  const code = normalizeGroupCode(raw)
  const { uid, profile } = useGame()
  const navigate = useNavigate()
  const now = useServerNow(1000)
  const [room, setRoom] = useState<QuickRoom | null | undefined>(undefined)
  const [players, setPlayers] = useState<QuickPlayer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<QuickResult | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [confirmarCierre, setConfirmarCierre] = useState(false)
  // Estado de la sala la primera vez que se vio: si ya estaba en juego, este dispositivo recargó.
  const primeraVista = useRef<QuickRoom['status'] | null>(null)
  const [reentradaRonda, setReentradaRonda] = useState<number | null>(null)
  const unido = useRef(false)

  const isHost = !!room && room.hostUid === uid
  const yo = players.find((p) => p.uid === uid)
  const limite = room ? hardDeadlineMs(room) : null
  const vencida = room?.status === 'playing' && limite !== null && now >= limite
  const terminada = room?.status === 'finished' || vencida
  const termineYo = !!resultado && resultado.round === room?.round
  const reentrada = reentradaRonda !== null && reentradaRonda === room?.round

  useEffect(() => {
    return watchQuickRoom(
      code,
      (r) => {
        if (r && primeraVista.current === null) primeraVista.current = r.status
        setRoom(r)
      },
      (e) => setError(friendlyError(e)),
    )
  }, [code])

  // Durante la partida, los jugadores solo escuchan la sala (ahorro de lecturas); el anfitrión
  // también a los jugadores, para saber cuándo terminaron todos.
  const escucharJugadores = !!room && (room.status !== 'playing' || isHost || termineYo || reentrada || vencida)
  useEffect(() => {
    if (!escucharJugadores) return
    return watchQuickPlayers(code, setPlayers, (e) => setError(friendlyError(e)))
  }, [code, escucharJugadores])

  useQuickHost(room, players, isHost)

  // Entrar automáticamente al abrir el enlace o el QR (solo en el lobby).
  useEffect(() => {
    if (!room || !uid || !profile || unido.current || room.status !== 'lobby') return
    if (room.hostUid === uid && !room.hostPlays) return
    unido.current = true
    joinQuickRoom(code, { uid, apodo: profile.apodo, avatar: profile.avatar }).catch((e) => {
      unido.current = false
      setJoinError(friendlyError(e))
    })
  }, [room, uid, profile, code])

  // Revancha: la ficha propia vuelve a cero en la ronda nueva.
  useEffect(() => {
    if (room?.status === 'lobby' && uid && yo && yo.round !== room.round) void resetQuickPlayer(code, uid, room.round).catch(() => {})
  }, [room?.status, room?.round, yo, uid, code])

  // Si este dispositivo abre la sala con la partida ya en juego (recargó), no puede volver a
  // empezar: queda terminado con lo último que subió.
  useEffect(() => {
    if (!room || !uid || primeraVista.current !== 'playing' || reentradaRonda !== null) return
    setReentradaRonda(room.round)
    void getQuickPlayer(code, uid)
      .then((p) => {
        if (p && p.round === room.round && !p.finished) return markQuickFinished(code, uid)
      })
      .catch(() => {})
  }, [room, uid, code, reentradaRonda])

  const alTerminar = useCallback((r: QuickResult) => setResultado(r), [])

  const accion = async (nombre: string, f: () => Promise<unknown>) => {
    setOcupado(nombre)
    setError(null)
    try {
      await f()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setOcupado(null)
    }
  }

  if (room === undefined) return <LoadingScreen text="Buscando la sala…" />
  if (room === null)
    return (
      <StatusScreen title="La sala se cerró">
        <p className="text-niebla">El anfitrión cerró la sala o el código no existe.</p>
        <Link to="/rapida" className="text-oro-claro underline underline-offset-4">
          Volver a Partida Rápida
        </Link>
      </StatusScreen>
    )
  if (isExpired(room, now))
    return (
      <StatusScreen title="Esta sala caducó">
        <p className="text-niebla">Las salas duran 6 horas. Crea una nueva para seguir jugando.</p>
        <Link to="/rapida" className="text-oro-claro underline underline-offset-4">
          Volver a Partida Rápida
        </Link>
      </StatusScreen>
    )

  const ronda = playersOfRound(room, players)
  const participo = !!yo && yo.round === room.round
  const salir = () => navigate('/')

  // ---------- juego ----------
  if (room.status === 'playing' && !vencida && participo && !termineYo && !reentrada && uid) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-6">
        <QuickGame key={room.round} room={room} uid={uid} onFinish={alTerminar} />
      </main>
    )
  }

  const cerrarSala = (
    <>
      <Button variant="peligro" onClick={() => setConfirmarCierre(true)}>
        Cerrar sala
      </Button>
      <ConfirmDialog
        open={confirmarCierre}
        title="¿Cerrar la sala?"
        confirmLabel="Cerrar sala"
        onCancel={() => setConfirmarCierre(false)}
        onConfirm={() => {
          setConfirmarCierre(false)
          void accion('cerrar', async () => {
            await closeQuickRoom(code)
            navigate('/rapida')
          })
        }}
      >
        Se borran la sala y sus jugadores. No queda ningún historial.
      </ConfirmDialog>
    </>
  )

  const botonRevancha = (
    <Button
      size="lg"
      loading={ocupado === 'revancha'}
      onClick={() =>
        void accion('revancha', async () => {
          if (room.status === 'playing') await finishQuickRoom(code)
          await rematchQuickRoom({ ...room, status: 'finished' }, usedQuestionIds(room, players, QUESTIONS))
          setResultado(null)
        })
      }
    >
      Revancha
    </Button>
  )
  const botonTerminar = (
    <Button variant="violeta" loading={ocupado === 'terminar'} onClick={() => void accion('terminar', () => finishQuickRoom(code))}>
      Terminar ahora
    </Button>
  )
  const botsEnSala = players.filter((p) => p.esBot)
  const botLibre = BOT_PROFILES.find((b) => !players.some((p) => p.uid === b.uid))
  const botonesLobby = (
    <>
      <Button size="lg" disabled={!canStart(room, players)} loading={ocupado === 'iniciar'} onClick={() => void accion('iniciar', () => startQuickRoom(code))}>
        Iniciar
      </Button>
      <Button
        variant="violeta"
        disabled={!botLibre || botsEnSala.length >= room.config.maxBots}
        loading={ocupado === 'bot'}
        onClick={() => botLibre && void accion('bot', () => addQuickBot(code, botLibre, room.round))}
      >
        Añadir bot ({botsEnSala.length}/{room.config.maxBots})
      </Button>
    </>
  )

  // ---------- anfitrión en «Solo pantalla»: proyecta la sala y la dirige ----------
  if (isHost && !room.hostPlays) {
    return (
      <QuickProjection room={room} players={players}>
        {terminada ? botonRevancha : room.status === 'playing' ? botonTerminar : botonesLobby}
        {room.status !== 'playing' || terminada ? cerrarSala : null}
        <ErrorText>{error}</ErrorText>
      </QuickProjection>
    )
  }

  // ---------- resultados ----------
  if (terminada) {
    const ganadores = quickWinners(ronda)
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8">
        <header className="text-center">
          <p className="text-xs tracking-[0.3em] text-niebla uppercase">Sala {code} · ronda {room.round}</p>
          <h1 className="texto-oro mt-1 text-3xl font-bold">
            {ganadores.length === 0
              ? 'Partida terminada'
              : ganadores.length === 1
                ? `¡Gana ${ganadores[0]!.apodo}!`
                : `Empate: ${ganadores.map((g) => g.apodo).join(' y ')}`}
          </h1>
        </header>
        <OrnateFrame className="p-5">
          <QuickPodium players={ronda} meUid={uid} />
        </OrnateFrame>
        {resultado && resultado.round === room.round && <ResumenPersonal r={resultado} />}
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-wrap justify-center gap-3">
          {isHost ? (
            <>
              {botonRevancha}
              {cerrarSala}
            </>
          ) : (
            <Button variant="fantasma" onClick={salir}>
              Salir
            </Button>
          )}
        </div>
        {!isHost && <p className="text-center text-sm text-niebla">Si el anfitrión pide la revancha, volverás al lobby.</p>}
      </main>
    )
  }

  // ---------- espera / vista del anfitrión durante la partida ----------
  if (room.status === 'playing') {
    const quedan = stillPlaying(room, players)
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8">
        {resultado && resultado.round === room.round ? (
          <section className="text-center" aria-live="polite">
            <h1 className="texto-oro text-3xl font-bold">¡Se acabó tu tiempo!</h1>
            <p className="mt-2 text-lg">
              {plural(resultado.correctas, 'acierto', 'aciertos')} · {plural(resultado.falladas, 'fallo', 'fallos')}
            </p>
          </section>
        ) : (
          <section className="text-center">
            <h1 className="texto-oro text-3xl font-bold">
              {reentrada && participo ? 'Volviste a la sala' : isHost ? 'Partida en juego' : 'La partida ya empezó'}
            </h1>
            <p className="mt-2 text-niebla">
              {reentrada && participo
                ? 'Tu partida quedó terminada con lo último que se guardó.'
                : !isHost && !participo
                  ? 'Espera a la revancha: entrarás automáticamente cuando el anfitrión la pida.'
                  : ''}
            </p>
          </section>
        )}
        {escucharJugadores && (
          <>
            <p className="text-center text-niebla" aria-live="polite">
              {quedan > 0 ? `${plural(quedan, 'jugador sigue', 'jugadores siguen')} jugando…` : 'Calculando resultados…'}
            </p>
            <OrnateFrame className="p-5">
              <LiveBars players={ronda} />
            </OrnateFrame>
          </>
        )}
        <ErrorText>{error}</ErrorText>
        {isHost && (
          <div className="flex justify-center">
            {botonTerminar}
          </div>
        )}
      </main>
    )
  }

  // ---------- lobby ----------
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <Link to="/" className="text-sm text-niebla underline-offset-4 hover:underline">
          ← Inicio
        </Link>
        <h1 className="texto-oro text-2xl font-bold">Partida Rápida</h1>
        {profile ? <AvatarIcon avatar={profile.avatar} size={36} decorative /> : <span />}
      </header>
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <OrnateFrame className="p-6">
          <QuickRoomCode code={code} />
        </OrnateFrame>
        <OrnateFrame className="flex flex-col gap-4 p-5">
          <h2 className="font-display text-lg text-oro-claro">
            {plural(players.length, 'jugador', 'jugadores')} en la sala
            {room.round > 1 && <span className="text-niebla"> · revancha {room.round - 1}</span>}
          </h2>
          <QuickPlayerList
            players={players}
            meUid={uid}
            onRemove={isHost ? (p) => void accion('sacar', () => removeQuickPlayer(code, p.uid)) : undefined}
          />
          <p className="text-sm text-niebla">
            {room.config.startSeconds} s para cada uno: acierto +{room.config.correctBonus} s, fallo −{room.config.wrongPenalty} s. Gana
            quien más acierte (desempate: menos fallos).
          </p>
        </OrnateFrame>
      </div>
      <ErrorText>{joinError ?? error}</ErrorText>
      {isHost ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {botonesLobby}
          <Link to={`/sala/${code}/pantalla`} target="_blank" className="text-sm text-oro-claro underline underline-offset-4">
            Abrir pantalla para PC
          </Link>
          {cerrarSala}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-niebla" role="status">
            {yo ? 'Estás dentro. Espera a que el anfitrión pulse «Iniciar».' : 'Entrando a la sala…'}
          </p>
          <Button
            variant="fantasma"
            onClick={() =>
              void accion('salir', async () => {
                if (uid && yo) await leaveQuickRoom(code, uid)
                navigate('/rapida')
              })
            }
          >
            Salir
          </Button>
        </div>
      )}
      {isHost && !room.hostPlays && <p className="text-center text-sm text-niebla">Modo «Solo pantalla»: tú no juegas, solo diriges la sala.</p>}
    </main>
  )
}

/** Preguntas que vio el jugador, su respuesta y la correcta con su explicación (solo en memoria). */
function ResumenPersonal({ r }: { r: QuickResult }) {
  if (r.historial.length === 0) return null
  return (
    <details className="panel p-4" open={r.historial.length <= 6}>
      <summary className="cursor-pointer font-display text-oro-claro">
        Tu partida: {plural(r.correctas, 'acierto', 'aciertos')} y {plural(r.falladas, 'fallo', 'fallos')}
      </summary>
      <ol className="mt-3 flex flex-col gap-3">
        {r.historial.map((h, i) => (
          <li key={`${h.question.id}-${i}`} className="border-t border-oro/10 pt-3 text-sm">
            <p className="font-semibold">
              <span aria-hidden>{h.correcta ? '✓ ' : '✗ '}</span>
              <span className="sr-only">{h.correcta ? 'Acertada: ' : 'Fallada: '}</span>
              {h.question.pregunta}
            </p>
            {!h.correcta && <p className="text-error">Tu respuesta: {h.question.opciones[h.opcion]}</p>}
            <p className="text-acierto">Correcta: {h.question.opciones[h.question.respuestaCorrecta]}</p>
            <p className="mt-1 text-niebla">{h.question.explicacion}</p>
          </li>
        ))}
      </ol>
    </details>
  )
}
