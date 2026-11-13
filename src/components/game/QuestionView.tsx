import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { Question } from '../../game/types'
import { TimerBar } from './TimerBar'

const LETRAS = ['A', 'B', 'C', 'D'] as const

interface Props {
  question: Question
  remainingMs: number
  /** Opción elegida (mientras se envía o tras responder). */
  selected: number | null
  /** Si es true, se muestran correcta e incorrecta. */
  reveal: boolean
  disabled: boolean
  onSelect: (opcion: number) => void
}

/** Pregunta con 4 opciones. Se responde con clic, tocando o con las teclas 1–4 / A–D. */
export function QuestionView({ question, remainingMs, selected, reveal, disabled, onSelect }: Props) {
  const primera = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    primera.current?.focus({ preventScroll: true })
  }, [question.id])

  useEffect(() => {
    if (disabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const k = e.key.toUpperCase()
      const i = ['1', '2', '3', '4'].indexOf(k) >= 0 ? Number(k) - 1 : LETRAS.indexOf(k as (typeof LETRAS)[number])
      if (i >= 0 && i < question.opciones.length) {
        e.preventDefault()
        onSelect(i)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, onSelect, question.opciones.length])

  return (
    <div className="flex flex-col gap-5">
      {!reveal && <TimerBar remainingMs={remainingMs} />}
      <h2 className="font-sans text-xl leading-snug font-semibold text-pergamino sm:text-2xl">{question.pregunta}</h2>
      <ul className="grid gap-3" role="list">
        {question.opciones.map((op, i) => {
          const esCorrecta = i === question.respuestaCorrecta
          const elegida = i === selected
          let estilo = 'border-oro/30 bg-noche-2/80 hover:border-oro hover:bg-violeta/30'
          if (reveal && esCorrecta) estilo = 'border-acierto bg-acierto/15 text-acierto'
          else if (reveal && elegida) estilo = 'border-error bg-error/15 text-error'
          else if (elegida) estilo = 'border-oro bg-violeta/40'
          else if (reveal || disabled) estilo = 'border-oro/15 bg-noche-2/60 opacity-60'
          return (
            <li key={i}>
              <motion.button
                ref={i === 0 ? primera : undefined}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(i)}
                whileTap={disabled ? undefined : { scale: 0.98 }}
                aria-pressed={elegida}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base transition-colors disabled:cursor-default ${estilo}`}
              >
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-oro/50 font-display text-sm text-oro-claro"
                >
                  {LETRAS[i]}
                </span>
                <span className="flex-1">{op}</span>
                {reveal && esCorrecta && <span className="text-sm font-semibold">Correcta</span>}
                {reveal && elegida && !esCorrecta && <span className="text-sm font-semibold">Tu respuesta</span>}
              </motion.button>
            </li>
          )
        })}
      </ul>
      {!reveal && !disabled && (
        <p className="hidden text-center text-xs text-niebla sm:block">Atajo: teclas 1–4 o A–D</p>
      )}
    </div>
  )
}
