import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GAME_CONFIG } from '../config/gameConfig'
import { QuestionView } from '../components/game/QuestionView'
import { ChallengeCard } from '../components/tarot/ChallengeCard'
import { FlipCard } from '../components/tarot/FlipCard'
import { TarotCard } from '../components/tarot/TarotCard'
import { Button } from '../components/ui/Button'
import { ErrorText } from '../components/ui/Field'
import { OrnateFrame } from '../components/ui/OrnateFrame'
import { getCard } from '../game/cards'
import {
  canReturnChallenge,
  challengeId,
  devolucionExitosa,
  extraChallengeId,
  pickChallengeQuestion,
  responsable,
  scoreChallenge,
  tipoReto,
  type TipoReto,
} from '../game/challenges'
import { seenQuestionIds } from '../game/draw'
import { QUESTIONS, QUESTIONS_BY_ID } from '../game/questionBank'
import { elapsedMs, evaluateAnswer, remainingMs, timeoutResult } from '../game/scoring'
import { useServerNow } from '../hooks/useServerNow'
import { openChallenge, resolveChallenge, returnChallenge } from '../services/challenges'
import { serverNow } from '../services/clock'
import { friendlyError } from '../services/errors'
import type { LiveChallenge } from '../services/types'
import { useGame } from '../state/GameContext'

const VOLTEO_MS = 1_600
/** Vueltas mínimas de la Rueda de la Fortuna antes de mostrar el resultado de la devolución. */
const RUEDA_MIN_MS = 2_600

const c = GAME_CONFIG

const enlace =
  'inline-flex min-h-11 items-center rounded-xl border border-oro/40 px-5 font-display text-sm tracking-wider text-oro-claro uppercase hover:bg-oro/10'

/**
 * Responder una pregunta de reto (obligatoria): la que te lanzaron, la que te devolvieron o las dos
 * del doble reto. Un reto recibido también se puede devolver: la Rueda de la Fortuna decide.
 */
export function ChallengePlay() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { group, uid, challenges, players, answers, online } = useGame()
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elegida, setElegida] = useState<number | null>(null)
  /** Devolución en curso: la rueda gira hasta que el servidor confirma la hora y pasa el tiempo mínimo. */
  const [rueda, setRueda] = useState<{ desde: number; vista: boolean } | null>(null)
  const enviado = useRef<string | null>(null)

  const reto = challenges.find((ch) => ch.id === id)
  const abierto = reto?.estado === 'abierto'
  const now = useServerNow(100, abriendo || abierto || (rueda !== null && !rueda.vista))
  const question = reto ? QUESTIONS_BY_ID.get(reto.preguntaId) : undefined
  const inicio = reto?.abiertoEnMs ?? now
  const restante = remainingMs(inicio, now)
  const nombre = (u: string) => players.find((p) => p.uid === u)?.apodo ?? 'Alguien'

  // Cambiar de pregunta (doble reto) reinicia el estado local.
  useEffect(() => {
    setElegida(null)
    setError(null)
  }, [id])

  const responder = useCallback(
    (opcion: number | null) => {
      if (!group || !reto || reto.estado !== 'abierto' || !question || enviado.current === reto.id) return
      enviado.current = reto.id
      setElegida(opcion)
      const result =
        opcion === null ? timeoutResult() : evaluateAnswer(question, opcion, elapsedMs(reto.abiertoEnMs ?? serverNow(), serverNow()))
      resolveChallenge(group.code, reto.id, result).catch((e: unknown) => {
        enviado.current = null
        setError(friendlyError(e, 'No se pudo guardar tu respuesta.'))
      })
    },
    [group, reto, question],
  )

  const t = now - inicio
  const fase = abierto ? (t < VOLTEO_MS ? 'tension' : t < c.pausaRevelacionMs ? 'volteo' : 'pregunta') : null

  useEffect(() => {
    if (fase === 'pregunta' && restante <= 0) responder(null)
  }, [fase, restante, responder])

  if (!reto || !question || !uid) {
    return (
      <Aviso>
        <p className="mb-4">Este reto no existe o ya no está disponible.</p>
      </Aviso>
    )
  }

  const tipo = tipoReto(reto)
  const yoRespondo = responsable(reto) === uid
  const base = reto.extra ? challenges.find((ch) => ch.id === challengeId(reto.para, reto.dia)) : reto
  const extra = base ? challenges.find((ch) => ch.id === extraChallengeId(base.para, base.dia)) : undefined
  const retador = nombre(reto.de)
  const retado = nombre(reto.para)

  // ---------- la Rueda de la Fortuna (devolución) ----------
  const resultadoRueda = reto.devueltoEnMs === null ? null : devolucionExitosa(reto.devueltoEnMs)
  if (rueda && !rueda.vista) {
    const listo = resultadoRueda !== null && now - rueda.desde >= RUEDA_MIN_MS
    return (
      <RuedaDeLaFortuna
        exito={listo ? resultadoRueda : null}
        retador={retador}
        error={error}
        onSeguir={() => (resultadoRueda ? navigate('/') : setRueda({ ...rueda, vista: true }))}
      />
    )
  }

  if (!yoRespondo) {
    // El reto devuelto con éxito: ahora es del retador. Quien lo devolvió solo ve cómo va.
    if (reto.para === uid && tipo === 'devuelto') {
      return (
        <Aviso>
          <h1 className="texto-oro mb-2 text-2xl font-bold">Le devolviste el reto a {retador}</h1>
          <p className="mb-4 text-niebla">
            {reto.estado !== 'resuelto'
              ? `Todavía no responde. Si falla, pierde ${c.penalizacionReto} puntos.`
              : reto.correcta
                ? 'Lo respondió bien: nadie gana ni pierde puntos.'
                : `¡Falló! Pierde ${c.penalizacionReto} puntos.`}
          </p>
        </Aviso>
      )
    }
    if (reto.para === uid && reto.estado === 'devuelto') {
      return (
        <Aviso>
          <p className="mb-4">La Rueda de la Fortuna sigue girando… Espera un momento.</p>
        </Aviso>
      )
    }
    return (
      <Aviso>
        <p className="mb-4">Este reto es para otra persona.</p>
      </Aviso>
    )
  }

  const aceptar = async () => {
    if (!group) return
    setAbriendo(true)
    setError(null)
    try {
      await openChallenge(group.code, reto.id)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setAbriendo(false)
    }
  }

  const devolver = async () => {
    if (!group || !canReturnChallenge(reto, uid)) return
    const vistas = seenQuestionIds(uid, answers, challenges)
    vistas.add(reto.preguntaId)
    const q = pickChallengeQuestion(QUESTIONS, vistas, null, Math.random)
    if (!q) {
      setError('No quedan preguntas difíciles para el doble reto: responde este reto.')
      return
    }
    setError(null)
    setRueda({ desde: serverNow(), vista: false })
    try {
      await returnChallenge(group.code, reto, q)
    } catch (e) {
      setRueda(null)
      setError(friendlyError(e))
    }
  }

  const carta = getCard(reto.carta)
  const resuelto = reto.estado === 'resuelto'

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite" className="sr-only">
        {(fase === 'volteo' || fase === 'pregunta') && `Reto de ${carta.nombre}, categoría ${carta.categoria}.`}
      </div>

      {(reto.estado === 'pendiente' || reto.estado === 'devuelto' || fase === 'tension' || fase === 'volteo') && (
        <OrnateFrame className="flex flex-col items-center gap-6 py-8 text-center">
          <div className="relative h-80 w-48 sm:h-96 sm:w-56">
            <AnimatePresence initial={false}>
              {fase === 'volteo' ? (
                <motion.div key="carta" className="absolute inset-0" initial={{ scale: 0.94 }} animate={{ scale: 1 }}>
                  <FlipCard
                    revealed
                    className="h-full w-full"
                    back={<ChallengeCard de={retador} className="h-full w-full" />}
                    front={<TarotCard card={reto.carta} className="h-full w-full" />}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="reto"
                  className="absolute inset-0"
                  exit={{ opacity: 0 }}
                  animate={fase === 'tension' ? { rotate: [0, -3, 3, -2, 2, 0], scale: [1, 1.04, 1] } : { y: [0, -6, 0] }}
                  transition={fase === 'tension' ? { duration: 0.5, repeat: Infinity } : { duration: 3, repeat: Infinity }}
                >
                  <ChallengeCard de={tipo === 'devuelto' ? retado : retador} className="h-full w-full drop-shadow-[0_0_30px_rgba(122,24,56,0.7)]" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {!fase && (
            <>
              <Intro tipo={tipo} retador={retador} retado={retado} />
              <div className="flex flex-wrap justify-center gap-3">
                <Button size="lg" onClick={aceptar} loading={abriendo} disabled={!online}>
                  {online ? (tipo === 'reto' ? 'Aceptar el reto' : 'Ver la pregunta') : 'Sin conexión'}
                </Button>
                {canReturnChallenge(reto, uid) && (
                  <Button variant="violeta" size="lg" onClick={devolver} disabled={!online || abriendo}>
                    Devolver el reto
                  </Button>
                )}
              </div>
              {canReturnChallenge(reto, uid) && (
                <p className="max-w-md text-sm text-niebla">
                  Devolverlo tiene un {c.porcentajeDevolucion} % de éxito: si sale bien, le toca a {retador} responderla (sin premio, y
                  pierde {c.penalizacionReto} si falla). Si sale mal, responderás dos preguntas: +{c.puntosReto} si aciertas alguna y −
                  {c.penalizacionReto} por cada fallo.
                </p>
              )}
            </>
          )}
          {fase === 'volteo' && (
            <p>
              <span className="block font-display text-2xl text-oro-claro">{carta.nombre}</span>
              <span className="text-niebla">{carta.categoria}</span>
            </p>
          )}
          <ErrorText>{error}</ErrorText>
        </OrnateFrame>
      )}

      {(fase === 'pregunta' || resuelto) && (
        <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
          <div className="flex items-center gap-4 md:flex-col md:items-stretch">
            <TarotCard card={reto.carta} className="w-20 shrink-0 md:w-full" />
            <div className="md:text-center">
              <p className="font-display text-lg text-oro-claro">{titulo(tipo, retador, retado)}</p>
              <p className="text-sm text-niebla">
                {carta.nombre} · {carta.categoria}
              </p>
            </div>
          </div>
          <OrnateFrame as="section" className="border-[#7A1838]/60">
            <QuestionView
              question={question}
              remainingMs={restante}
              selected={elegida}
              reveal={resuelto}
              disabled={resuelto || enviado.current === reto.id}
              onSelect={responder}
            />
            <div className="mt-4">
              <ErrorText>{error}</ErrorText>
            </div>
          </OrnateFrame>
        </div>
      )}

      {resuelto && base && (
        <Resultado reto={reto} base={base} extra={extra} tipo={tipo} uid={uid} retador={retador} explicacion={question.explicacion} />
      )}
    </div>
  )
}

function titulo(tipo: TipoReto, retador: string, retado: string): string {
  switch (tipo) {
    case 'reto':
      return `Reto de ${retador}`
    case 'devuelto':
      return `Reto devuelto por ${retado}`
    case 'doble':
      return 'Doble reto · 1 de 2'
    case 'extra':
      return 'Doble reto · 2 de 2'
  }
}

function Intro({ tipo, retador, retado }: { tipo: TipoReto; retador: string; retado: string }) {
  const [h, p] = {
    reto: [
      `${retador} te desafía`,
      `Una pregunta difícil, ${c.tiempoPreguntaMs / 1000} segundos. Si aciertas ganas +${c.puntosReto}; si fallas pierdes ${c.penalizacionReto} y ${retador} gana +${c.puntosReto}.`,
    ],
    devuelto: [
      `${retado} te devolvió tu reto`,
      `La Rueda de la Fortuna le sonrió: ahora debes responderlo tú. Si aciertas no ganas nada; si fallas pierdes ${c.penalizacionReto}.`,
    ],
    doble: [
      'Doble reto: pregunta 1 de 2',
      `La devolución falló. Responde dos preguntas: si aciertas alguna ganas +${c.puntosReto} (una sola vez) y cada fallo resta ${c.penalizacionReto}.`,
    ],
    extra: [
      'Doble reto: pregunta 2 de 2',
      `La última del doble reto. Recuerda: +${c.puntosReto} si aciertas alguna de las dos y −${c.penalizacionReto} por cada fallo.`,
    ],
  }[tipo]
  return (
    <div>
      <h1 className="texto-oro text-2xl font-bold">{h}</h1>
      <p className="mt-2 max-w-md text-niebla">{p}</p>
    </div>
  )
}

function Resultado({
  reto,
  base,
  extra,
  tipo,
  uid,
  retador,
  explicacion,
}: {
  reto: LiveChallenge
  base: LiveChallenge
  extra: LiveChallenge | undefined
  tipo: TipoReto
  uid: string
  retador: string
  explicacion: string
}) {
  const otra = tipo === 'doble' ? extra : tipo === 'extra' ? base : undefined
  const falta = otra && otra.estado !== 'resuelto'
  const misPuntos = scoreChallenge(base, extra, false)
    .filter((s) => s.uid === uid)
    .reduce((t, s) => t + s.puntos, 0)

  let resumen: string
  if (tipo === 'reto') {
    resumen = reto.correcta ? `+${c.puntosReto} puntos para ti.` : `Pierdes ${c.penalizacionReto} puntos y ${retador} se lleva +${c.puntosReto}.`
  } else if (tipo === 'devuelto') {
    resumen = reto.correcta ? 'Te salvaste: no pierdes nada.' : `Pierdes ${c.penalizacionReto} puntos.`
  } else if (falta) {
    resumen = reto.correcta
      ? `¡Acertaste! Ya tienes los +${c.puntosReto} del reto. Falta la otra pregunta (si la fallas, −${c.penalizacionReto}).`
      : `Fallaste esta (−${c.penalizacionReto}). Si aciertas la otra, ganas +${c.puntosReto}.`
  } else {
    const ganoRetador = base.correcta === false && extra?.correcta === false
    resumen = `Doble reto terminado: ${misPuntos > 0 ? '+' : ''}${misPuntos} puntos para ti${ganoRetador ? ` y +${c.puntosReto} para ${retador}` : ''}.`
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`panel p-6 ${reto.correcta ? 'border-acierto/50' : 'border-error/40'}`}
    >
      <h2 className={`mb-2 text-3xl font-bold ${reto.correcta ? 'text-acierto' : 'text-error'}`}>
        {reto.correcta ? '¡Venciste el reto!' : 'El reto te venció'}
      </h2>
      <p className="mb-4 text-lg">{resumen}</p>
      <div className="mb-6 rounded-xl border border-oro/20 bg-noche/60 p-4">
        <p className="mb-1 text-xs tracking-widest text-oro uppercase">Explicación</p>
        <p>{explicacion}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {falta && otra && (
          <Link
            to={`/reto/${otra.id}`}
            className="inline-flex min-h-11 items-center rounded-xl bg-gradient-to-b from-oro-claro via-oro to-oro-oscuro px-5 font-display text-sm font-semibold tracking-wider text-noche uppercase"
          >
            Siguiente pregunta
          </Link>
        )}
        <Link to="/" className={enlace}>
          Volver al inicio
        </Link>
      </div>
    </motion.section>
  )
}

/** La Rueda de la Fortuna gira mientras el servidor decide la devolución. */
function RuedaDeLaFortuna({
  exito,
  retador,
  error,
  onSeguir,
}: {
  exito: boolean | null
  retador: string
  error: string | null
  onSeguir: () => void
}) {
  return (
    <OrnateFrame className="flex flex-col items-center gap-6 py-8 text-center">
      <div aria-live="polite" className="sr-only">
        {exito === null ? 'La Rueda de la Fortuna gira…' : exito ? 'La devolución salió bien.' : 'La devolución salió mal.'}
      </div>
      {/* Al conocerse el resultado se monta una carta nueva que se asienta derecha (el giro infinito no se "detiene" bien). */}
      <motion.div
        key={exito === null ? 'gira' : 'quieta'}
        className="w-48 sm:w-56"
        initial={exito === null ? { rotate: 0 } : { rotate: -30, scale: 1.15 }}
        animate={exito === null ? { rotate: 360 } : { rotate: 0, scale: 1 }}
        transition={exito === null ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { type: 'spring', stiffness: 200, damping: 14 }}
      >
        <TarotCard card="rueda" className="w-full drop-shadow-[0_0_30px_rgba(212,175,55,0.45)]" />
      </motion.div>
      {exito === null ? (
        <p className="text-niebla">La Rueda de la Fortuna decide…</p>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4">
          <h1 className={`text-3xl font-bold ${exito ? 'text-acierto' : 'text-error'}`}>{exito ? '¡La fortuna te sonríe!' : 'La fortuna te da la espalda'}</h1>
          <p className="max-w-md text-niebla">
            {exito
              ? `El reto vuelve a ${retador}: tendrá que responderlo sin premio, y si falla pierde ${c.penalizacionReto}. Tú quedas libre.`
              : `Ahora te toca un doble reto: dos preguntas difíciles. +${c.puntosReto} si aciertas alguna; −${c.penalizacionReto} por cada fallo.`}
          </p>
          <Button size="lg" onClick={onSeguir}>
            {exito ? 'Volver al inicio' : 'Empezar el doble reto'}
          </Button>
        </motion.div>
      )}
      <ErrorText>{error}</ErrorText>
    </OrnateFrame>
  )
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <OrnateFrame className="text-center">
      {children}
      <Link to="/" className="text-oro-claro underline underline-offset-4">
        Volver al inicio
      </Link>
    </OrnateFrame>
  )
}
