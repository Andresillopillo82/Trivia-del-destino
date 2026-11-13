import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { GAME_CONFIG } from '../config/gameConfig'
import { CartasDelDia } from '../components/game/CartasDelDia'
import { QuestionView } from '../components/game/QuestionView'
import { CardBack } from '../components/tarot/CardBack'
import { Deck } from '../components/tarot/Deck'
import { FlipCard } from '../components/tarot/FlipCard'
import { TarotCard } from '../components/tarot/TarotCard'
import { Button } from '../components/ui/Button'
import { ErrorText } from '../components/ui/Field'
import { OrnateFrame } from '../components/ui/OrnateFrame'
import { canSendChallenge } from '../game/challenges'
import { getCard } from '../game/cards'
import { msUntilNextDay } from '../game/day'
import { drawCard, drawQuestionForCard, seenQuestionIds } from '../game/draw'
import { QUESTIONS, QUESTIONS_BY_ID } from '../game/questionBank'
import { dailyPoints, elapsedMs, evaluateAnswer, remainingMs, timeoutResult } from '../game/scoring'
import { formatDuration, formatSeconds, plural } from '../lib/format'
import { useServerNow } from '../hooks/useServerNow'
import { closeDaily, drawDailyCard, openDailyQuestion, swapCardWithComodin } from '../services/answers'
import { serverNow } from '../services/clock'
import { friendlyError } from '../services/errors'
import type { LiveAnswer } from '../services/types'
import { useGame } from '../state/GameContext'

/** Tiempo mínimo de barajado, para que se vea la animación aunque el servidor responda rápido. */
const BARAJADO_MIN_MS = 1_200

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Fase = 'mazo' | 'barajando' | 'carta' | 'cuenta' | 'pregunta' | 'resultado' | 'nada'

/**
 * Las 3 cartas del día. Para cada una: barajar → carta volteada (se puede usar el comodín) →
 * "Ver la pregunta" → cuenta atrás → pregunta con temporizador → resultado.
 * Con `?n=0` muestra el resultado de una carta ya respondida hoy.
 */
export function Play() {
  const g = useGame()
  const { group, uid, day, seasonOver, isPlayer, myTodayAnswers, canDrawCard, comodinDisponible, myPending, online, answers, challenges } = g
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [ocupado, setOcupado] = useState<'sacar' | 'comodin' | 'ver' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elegida, setElegida] = useState<number | null>(null)
  const enviado = useRef<string | null>(null)
  const autoInicio = useRef(false)

  const enJuego = myTodayAnswers.find((a) => a.estado !== 'cerrada')
  const nVista = params.get('n')
  const vista = nVista !== null ? myTodayAnswers.find((a) => a.n === Number(nVista) && a.estado === 'cerrada') : undefined
  const actual: LiveAnswer | undefined = ocupado === 'sacar' ? undefined : (enJuego ?? vista ?? myTodayAnswers.at(-1))

  const abierta = actual?.estado === 'abierta'
  const now = useServerNow(100, ocupado !== null || abierta)
  const question = actual?.preguntaId ? QUESTIONS_BY_ID.get(actual.preguntaId) : undefined
  const reveladoEn = actual?.reveladoEnMs ?? now
  const restante = remainingMs(reveladoEn, now)

  let fase: Fase
  // El barajado dura hasta su tiempo mínimo: así "Ver la pregunta" nunca aparece deshabilitado.
  if (ocupado === 'sacar') fase = 'barajando'
  else if (actual?.estado === 'carta') fase = 'carta'
  else if (actual?.estado === 'abierta') fase = now - reveladoEn < GAME_CONFIG.pausaRevelacionMs ? 'cuenta' : 'pregunta'
  else if (actual?.estado === 'cerrada') fase = 'resultado'
  else fase = canDrawCard ? 'mazo' : 'nada'

  const vistas = () => seenQuestionIds(uid ?? '', answers, challenges)

  const sacar = useCallback(async () => {
    if (!group || !uid || !canDrawCard || ocupado) return
    setError(null)
    setParams({}, { replace: true })
    const carta = drawCard(QUESTIONS, seenQuestionIds(uid, answers, challenges), Math.random)
    if (!carta) {
      setError('Ya respondiste todas las preguntas disponibles.')
      return
    }
    setOcupado('sacar')
    try {
      await Promise.all([drawDailyCard(group.code, uid, day, myTodayAnswers.length, carta), esperar(BARAJADO_MIN_MS)])
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setOcupado(null)
    }
  }, [group, uid, canDrawCard, ocupado, answers, challenges, day, myTodayAnswers.length, setParams])

  const comodin = async () => {
    if (!group || !uid || !actual || actual.estado !== 'carta' || ocupado) return
    const nueva = drawCard(QUESTIONS, vistas(), Math.random, [actual.carta])
    if (!nueva) {
      setError('No quedan otras cartas para cambiar.')
      return
    }
    setError(null)
    setOcupado('comodin')
    try {
      await swapCardWithComodin(group.code, uid, actual.dia, actual.n, nueva)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setOcupado(null)
    }
  }

  const verPregunta = async () => {
    if (!group || !uid || !actual || actual.estado !== 'carta' || ocupado) return
    const q = drawQuestionForCard(QUESTIONS, vistas(), actual.carta, Math.random)
    if (!q) {
      setError('No quedan preguntas de esta carta.')
      return
    }
    setError(null)
    setElegida(null)
    setOcupado('ver')
    try {
      await openDailyQuestion(group.code, uid, actual.dia, actual.n, q.id)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setOcupado(null)
    }
  }

  // Desde el botón del inicio: sacar la carta al llegar.
  useEffect(() => {
    const st = location.state as { revelar?: boolean } | null
    if (!st?.revelar || autoInicio.current) return
    autoInicio.current = true
    navigate('.', { replace: true, state: null })
    if (online && canDrawCard && !enJuego) void sacar()
  }, [location.state, navigate, online, canDrawCard, enJuego, sacar])

  const responder = useCallback(
    (opcion: number | null) => {
      if (!group || !uid || !actual || actual.estado !== 'abierta' || !question) return
      const clave = `${actual.dia}-${actual.n}`
      if (enviado.current === clave) return
      enviado.current = clave
      setElegida(opcion)
      const result =
        opcion === null
          ? timeoutResult()
          : evaluateAnswer(question, opcion, elapsedMs(actual.reveladoEnMs ?? serverNow(), serverNow()))
      closeDaily(group.code, uid, actual.dia, actual.n, result).catch((e: unknown) => {
        enviado.current = null
        setError(friendlyError(e, 'No se pudo guardar tu respuesta.'))
      })
    },
    [group, uid, actual, question],
  )

  // Tiempo agotado.
  useEffect(() => {
    if (fase === 'pregunta' && restante <= 0) responder(null)
  }, [fase, restante, responder])

  if (fase === 'nada') {
    const motivo = !isPlayer
      ? 'Organizas este grupo sin jugar, así que no tienes cartas.'
      : seasonOver
        ? 'La temporada terminó. ¡Mira quién es el Dueño del Destino!'
        : myPending.length > 0
          ? 'Tienes un reto pendiente. Respóndelo antes de sacar tu carta.'
          : 'Ya jugaste tus cartas de hoy.'
    return (
      <OrnateFrame className="text-center">
        <p className="mb-4 text-lg">{motivo}</p>
        <Link to={seasonOver ? '/clasificacion' : '/'} className="text-oro-claro underline underline-offset-4">
          {seasonOver ? 'Ver la clasificación' : 'Volver al inicio'}
        </Link>
      </OrnateFrame>
    )
  }

  const carta = actual ? getCard(actual.carta) : null
  const respondida = fase === 'resultado'

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite" className="sr-only">
        {fase === 'barajando' && 'Barajando el mazo…'}
        {fase === 'carta' && carta && `Tu carta: ${carta.nombre}, categoría ${carta.categoria}.`}
        {fase === 'cuenta' && 'La pregunta aparece en unos segundos.'}
      </div>

      <CartasDelDia answers={myTodayAnswers} />

      {(fase === 'mazo' || fase === 'barajando' || fase === 'carta' || fase === 'cuenta') && (
        <OrnateFrame className="flex flex-col items-center gap-6 py-8">
          <div className="relative h-80 w-48 sm:h-96 sm:w-56">
            <AnimatePresence initial={false} mode="popLayout">
              {(fase === 'carta' || fase === 'cuenta') && actual ? (
                // La clave cambia con el comodín: la carta nueva se voltea otra vez.
                <motion.div
                  key={`carta-${actual.n}-${actual.carta}`}
                  className="absolute inset-0"
                  initial={{ y: -16, scale: 0.94, opacity: 0 }}
                  animate={{ y: 0, scale: 1, opacity: fase === 'cuenta' ? 0.35 : 1 }}
                  exit={{ x: 120, rotate: 12, opacity: 0 }}
                >
                  <FlipCard
                    revealed
                    className="h-full w-full"
                    back={<CardBack className="h-full w-full" />}
                    front={<TarotCard card={actual.carta} className="h-full w-full" />}
                  />
                </motion.div>
              ) : (
                <motion.div key="mazo" className="absolute inset-0" exit={{ opacity: 0, scale: 0.95 }}>
                  <Deck shuffling={fase === 'barajando'} className="h-full" />
                </motion.div>
              )}
            </AnimatePresence>
            {fase === 'cuenta' && (
              <motion.p
                key={Math.ceil((GAME_CONFIG.pausaRevelacionMs - (now - reveladoEn)) / 1000)}
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="texto-oro absolute inset-0 flex items-center justify-center font-display text-8xl font-bold"
                aria-hidden
              >
                {Math.max(1, Math.ceil((GAME_CONFIG.pausaRevelacionMs - (now - reveladoEn)) / 1000))}
              </motion.p>
            )}
          </div>

          {fase === 'mazo' && (
            <>
              <Button size="lg" onClick={sacar} disabled={!online}>
                {online ? `Sacar carta ${myTodayAnswers.length + 1} de ${GAME_CONFIG.preguntasPorDia}` : 'Sin conexión'}
              </Button>
              <p className="max-w-sm text-center text-sm text-niebla">
                Verás la carta antes que la pregunta: si no te gusta su categoría, puedes cambiarla con tu comodín del día.
              </p>
            </>
          )}
          {fase === 'barajando' && <p className="text-niebla">El destino baraja las cartas…</p>}
          {fase === 'carta' && carta && (
            <>
              <p className="text-center">
                <span className="block font-display text-2xl text-oro-claro">{carta.nombre}</span>
                <span className="text-niebla">{carta.categoria}</span>
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button size="lg" onClick={verPregunta} loading={ocupado === 'ver'} disabled={!online || ocupado !== null}>
                  Ver la pregunta
                </Button>
                {comodinDisponible && (
                  <Button variant="violeta" size="lg" onClick={comodin} loading={ocupado === 'comodin'} disabled={!online || ocupado !== null}>
                    Usar comodín
                  </Button>
                )}
              </div>
              <p className="max-w-sm text-center text-sm text-niebla">
                {comodinDisponible
                  ? `Tendrás ${GAME_CONFIG.tiempoPreguntaMs / 1000} s. El comodín cambia esta carta por otra de otra categoría (uno al día).`
                  : `Tendrás ${GAME_CONFIG.tiempoPreguntaMs / 1000} s. Ya usaste tu comodín de hoy.`}
              </p>
            </>
          )}
          {fase === 'cuenta' && <p className="text-niebla">Concéntrate…</p>}
          <ErrorText>{error}</ErrorText>
        </OrnateFrame>
      )}

      {(fase === 'pregunta' || respondida) && actual && question && carta && (
        <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
          <div className="flex items-center gap-4 md:flex-col md:items-stretch">
            <TarotCard card={actual.carta} className="w-20 shrink-0 drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)] md:w-full" />
            <div className="md:text-center">
              <p className="font-display text-lg text-oro-claro">{carta.nombre}</p>
              <p className="text-sm text-niebla">
                {carta.categoria} · carta {actual.n + 1} de {GAME_CONFIG.preguntasPorDia}
              </p>
            </div>
          </div>
          <OrnateFrame as="section">
            <QuestionView
              question={question}
              remainingMs={restante}
              selected={respondida ? actual.opcion : elegida}
              reveal={respondida}
              disabled={respondida || enviado.current === `${actual.dia}-${actual.n}`}
              onSelect={responder}
            />
            <div className="mt-4">
              <ErrorText>{error}</ErrorText>
            </div>
          </OrnateFrame>
        </div>
      )}

      {respondida && actual && question && <ResultPanel answer={actual} explicacion={question.explicacion} onSiguiente={sacar} />}
    </div>
  )
}

function ResultPanel({ answer, explicacion, onSiguiente }: { answer: LiveAnswer; explicacion: string; onSiguiente: () => void }) {
  const { group, myRow, answers, myTodayAnswers, canDrawCard, myPending, online } = useGame()
  const now = useServerNow(30_000)
  const puntos = dailyPoints(answer)
  const bonus = puntos > GAME_CONFIG.puntosCorrecta
  const agotado = answer.opcion === null
  const quedan = GAME_CONFIG.preguntasPorDia - myTodayAnswers.length
  const faltan = group ? formatDuration(msUntilNextDay(group.fechaInicioMs, now)) : ''

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`panel p-6 ${answer.correcta ? 'border-acierto/50' : 'border-error/40'}`}
      aria-labelledby="resultado-titulo"
    >
      <h2 id="resultado-titulo" className={`mb-2 text-3xl font-bold ${answer.correcta ? 'text-acierto' : 'text-error'}`}>
        {answer.correcta ? '¡El destino te sonríe!' : agotado ? 'Se acabó el tiempo' : 'Las cartas no estaban de tu lado'}
      </h2>
      <p className="mb-4 text-lg">
        {answer.correcta ? (
          <>
            <strong className="text-oro-claro">+{puntos} puntos</strong>
            {bonus && <span className="text-niebla"> (incluye +{GAME_CONFIG.bonoRapidez} por responder en menos de {GAME_CONFIG.umbralRapidezMs / 1000} s)</span>}
          </>
        ) : (
          <span className="text-niebla">0 puntos esta vez.</span>
        )}
      </p>
      <dl className="mb-5 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-noche-3/70 p-3">
          <dt className="text-niebla">Tiempo</dt>
          <dd className="text-xl font-semibold text-pergamino tabular-nums">{formatSeconds(answer.tiempoMs)}</dd>
        </div>
        <div className="rounded-xl bg-noche-3/70 p-3">
          <dt className="text-niebla">Racha</dt>
          <dd className="text-xl font-semibold text-pergamino">{plural(myRow?.rachaActual ?? 0, 'acierto')}</dd>
        </div>
        <div className="rounded-xl bg-noche-3/70 p-3">
          <dt className="text-niebla">Total</dt>
          <dd className="text-xl font-semibold text-oro-claro tabular-nums">{myRow?.puntos ?? 0} pts</dd>
        </div>
      </dl>
      <div className="mb-6 rounded-xl border border-oro/20 bg-noche/60 p-4">
        <p className="mb-1 text-xs tracking-widest text-oro uppercase">Explicación</p>
        <p>{explicacion}</p>
      </div>
      {canSendChallenge(answer.uid, answer.dia, answers) && (
        <div className="mb-6 flex flex-col items-start gap-3 rounded-xl border border-[#7A1838] bg-[#7A1838]/25 p-4">
          <p>
            <strong className="font-display text-oro-claro">¡Reto desbloqueado!</strong> Llevas {GAME_CONFIG.aciertosParaRetar} aciertos hoy.
            Envía una pregunta difícil a alguien del grupo: si falla, +{GAME_CONFIG.puntosReto} para ti; si acierta, se los lleva.
          </p>
          <Link
            to="/retar"
            className="inline-flex min-h-11 items-center rounded-xl bg-violeta px-5 font-display text-sm font-semibold tracking-wider text-pergamino uppercase ring-1 ring-violeta-claro/70 hover:bg-[#6a33a0]"
          >
            Lanzar un reto
          </Link>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {canDrawCard && (
          <Button onClick={onSiguiente} disabled={!online}>
            Siguiente carta ({myTodayAnswers.length + 1} de {GAME_CONFIG.preguntasPorDia})
          </Button>
        )}
        <Link to="/" className="inline-flex min-h-11 items-center rounded-xl border border-oro/40 px-5 font-display text-sm tracking-wider text-oro-claro uppercase hover:bg-oro/10">
          Volver al inicio
        </Link>
      </div>
      <p className="mt-4 text-sm text-niebla">
        {quedan === 0
          ? `Jugaste tus ${GAME_CONFIG.preguntasPorDia} cartas de hoy. Las próximas llegan en ${faltan}.`
          : myPending.length > 0
            ? 'Tienes un reto pendiente: respóndelo para sacar tu siguiente carta.'
            : `Te ${quedan === 1 ? 'queda 1 carta' : `quedan ${quedan} cartas`} hoy.`}
      </p>
    </motion.section>
  )
}
