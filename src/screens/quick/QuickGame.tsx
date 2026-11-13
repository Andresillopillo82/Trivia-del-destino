import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CardBadge, TimeRing } from '../../components/quick/QuickParts'
import { QUESTIONS } from '../../game/questionBank'
import { applyAnswer, remainingMs, startClock, tick, type QuickClock } from '../../game/quick/clock'
import type { QuickRoom } from '../../game/quick/room'
import { buildQuickSequence } from '../../game/quick/sequence'
import type { Question } from '../../game/types'
import { serverNow } from '../../services/clock'
import { syncQuickProgress } from '../../services/quick'

/** Lo que el jugador vio y respondió (solo en memoria, para su resumen final). */
export interface QuickAnswered {
  question: Question
  opcion: number
  correcta: boolean
}

export interface QuickResult {
  round: number
  correctas: number
  falladas: number
  historial: QuickAnswered[]
}

const CUENTA_MS = 3000
const LETRAS = ['A', 'B', 'C', 'D'] as const

interface Flotante {
  id: number
  bien: boolean
}

/**
 * Partida de un jugador: cuenta atrás 3-2-1 local y luego preguntas seguidas con su propio reloj
 * (monotónico: performance.now). El reloj nunca se pausa; sube los contadores como mucho cada
 * syncEveryMs y siempre al terminar.
 */
export function QuickGame({ room, uid, onFinish }: { room: QuickRoom; uid: string; onFinish: (r: QuickResult) => void }) {
  const cfg = room.config
  const reducir = useReducedMotion()
  const [inicio] = useState(() => performance.now())
  // Límite global (5 min desde el inicio en el servidor), pasado a reloj local.
  const [limiteLocal] = useState(() =>
    room.startedAtMs === null ? Infinity : performance.now() + room.startedAtMs + cfg.hardTimeoutMs - serverNow(),
  )
  const [now, setNow] = useState(inicio)
  const [clock, setClock] = useState<QuickClock | null>(null)
  const [idx, setIdx] = useState(0)
  const [elegida, setElegida] = useState<number | null>(null)
  const [flotantes, setFlotantes] = useState<Flotante[]>([])
  const [temblor, setTemblor] = useState(0)
  const seq = useRef<Question[]>([])
  const historial = useRef<QuickAnswered[]>([])
  const enviado = useRef({ correctas: 0, falladas: 0 })
  const terminado = useRef(false)
  const clockRef = useRef<QuickClock | null>(null)
  clockRef.current = clock

  const pregunta = (i: number) => {
    if (seq.current.length <= i) seq.current = buildQuickSequence(room.seed, QUESTIONS, cfg, i + 20, room.evitar)
    return seq.current[i]!
  }

  const terminar = useCallback(
    (c: QuickClock) => {
      if (terminado.current) return
      terminado.current = true
      const final = { correctas: c.correctas, falladas: c.falladas, finished: true }
      // La última escritura importa: se reintenta unas veces (si la sala ya terminó, las reglas la rechazan).
      const subir = (intento: number) =>
        void syncQuickProgress(room.code, uid, room.round, final).catch(() => {
          if (intento < 3) window.setTimeout(() => subir(intento + 1), 1000 * (intento + 1))
        })
      subir(0)
      onFinish({ round: room.round, correctas: c.correctas, falladas: c.falladas, historial: historial.current })
    },
    [onFinish, room.code, room.round, uid],
  )

  // Reloj de pantalla (y fin por tiempo o por el límite global).
  useEffect(() => {
    const t = window.setInterval(() => {
      const ahora = performance.now()
      setNow(ahora)
      const c = clockRef.current
      if (!c && ahora - inicio >= CUENTA_MS) setClock(startClock(cfg, inicio + CUENTA_MS))
      if (c && !terminado.current) {
        const tc = ahora >= limiteLocal ? { ...c, finished: true } : tick(c, ahora)
        if (tc.finished) {
          setClock(tc)
          terminar(tc)
        }
      }
    }, 100)
    return () => window.clearInterval(t)
  }, [cfg, inicio, limiteLocal, terminar])

  // Contadores en Firestore: como mucho cada syncEveryMs y solo si cambiaron.
  useEffect(() => {
    const t = window.setInterval(() => {
      const c = clockRef.current
      if (!c || terminado.current) return
      if (c.correctas === enviado.current.correctas && c.falladas === enviado.current.falladas) return
      enviado.current = { correctas: c.correctas, falladas: c.falladas }
      void syncQuickProgress(room.code, uid, room.round, { correctas: c.correctas, falladas: c.falladas, finished: false }).catch(() => {})
    }, cfg.syncEveryMs)
    return () => window.clearInterval(t)
  }, [cfg.syncEveryMs, room.code, room.round, uid])

  const responder = useCallback(
    (opcion: number) => {
      const c = clockRef.current
      if (!c || c.finished || elegida !== null || terminado.current) return
      const t = performance.now()
      const q = pregunta(idx)
      const correcta = opcion === q.respuestaCorrecta
      const nuevo = applyAnswer(c, correcta, t, cfg)
      setClock(nuevo)
      if (nuevo.correctas + nuevo.falladas === c.correctas + c.falladas) {
        terminar(nuevo) // con el reloj en 0, la respuesta no cuenta
        return
      }
      historial.current = [...historial.current, { question: q, opcion, correcta }]
      setFlotantes((f) => [...f.slice(-3), { id: t, bien: correcta }])
      if (!correcta) setTemblor((n) => n + 1)
      navigator.vibrate?.(correcta ? 15 : [30, 40, 30])
      setElegida(opcion)
      window.setTimeout(() => {
        setElegida(null)
        if (nuevo.finished) terminar(nuevo)
        else setIdx((i) => i + 1)
      }, cfg.feedbackMs)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, elegida, idx, terminar],
  )

  // Teclas 1–4 / A–D en la PC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const k = e.key.toUpperCase()
      const i = ['1', '2', '3', '4'].includes(k) ? Number(k) - 1 : LETRAS.indexOf(k as (typeof LETRAS)[number])
      if (i >= 0) {
        e.preventDefault()
        responder(i)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [responder])

  if (!clock) {
    const n = Math.max(1, 3 - Math.floor((now - inicio) / 1000))
    return (
      <div className="grid min-h-[60dvh] place-items-center" role="status" aria-live="assertive">
        <AnimatePresence mode="popLayout">
          <motion.p
            key={n}
            initial={reducir ? false : { scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reducir ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
            className="texto-oro font-display text-9xl font-bold"
          >
            {n}
          </motion.p>
        </AnimatePresence>
        <span className="sr-only">La partida empieza en {n}</span>
      </div>
    )
  }

  const q = pregunta(idx)
  const total = Math.max(cfg.startSeconds, cfg.maxSeconds ?? cfg.startSeconds) * 1000
  const restante = remainingMs(clock, now)

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="relative flex items-center justify-between">
        <div className="text-left">
          <p className="text-xs tracking-widest text-niebla uppercase">Aciertos</p>
          <p className="font-display text-4xl font-bold text-acierto tabular-nums" aria-live="polite">
            {clock.correctas}
          </p>
        </div>
        <motion.div animate={temblor && !reducir ? { x: [0, -8, 8, -5, 5, 0] } : undefined} transition={{ duration: 0.3 }} key={temblor}>
          <TimeRing remainingMs={restante} totalMs={total} />
        </motion.div>
        <div className="text-right">
          <p className="text-xs tracking-widest text-niebla uppercase">Fallos</p>
          <p className="font-display text-4xl font-bold text-error tabular-nums">{clock.falladas}</p>
        </div>
        {/* +2 s / −2 s flotantes */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center" aria-hidden>
          <AnimatePresence>
            {flotantes.map((f) => (
              <motion.span
                key={f.id}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: reducir ? 0 : -48 }}
                transition={{ duration: 0.9 }}
                onAnimationComplete={() => setFlotantes((fs) => fs.filter((x) => x.id !== f.id))}
                className={`absolute font-display text-3xl font-bold ${f.bien ? 'text-acierto' : 'text-error'}`}
              >
                {f.bien ? `+${cfg.correctBonus} s` : `−${cfg.wrongPenalty} s`}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <section aria-label={`Pregunta ${idx + 1}`} className="panel flex flex-col gap-3 p-4">
        <CardBadge carta={q.carta} />
        <h2 className="text-center text-xl leading-snug font-semibold text-pergamino sm:text-2xl">{q.pregunta}</h2>
      </section>

      <ul className="grid gap-3" role="list">
        {q.opciones.map((op, i) => {
          let estilo = 'border-oro/30 bg-noche-2/80 hover:border-oro active:bg-violeta/30'
          if (elegida !== null && i === q.respuestaCorrecta) estilo = 'border-acierto bg-acierto/15 text-acierto'
          else if (elegida === i) estilo = 'border-error bg-error/15 text-error'
          return (
            <li key={`${q.id}-${i}`}>
              <button
                type="button"
                onClick={() => responder(i)}
                disabled={elegida !== null}
                className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-lg transition-colors disabled:cursor-default ${estilo}`}
              >
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border border-oro/50 font-display text-sm text-oro-claro">
                  {LETRAS[i]}
                </span>
                <span className="flex-1">{op}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {elegida !== null ? (elegida === q.respuestaCorrecta ? `¡Correcta! +${cfg.correctBonus} segundos` : `Fallaste. −${cfg.wrongPenalty} segundos`) : ''}
      </p>
    </div>
  )
}
