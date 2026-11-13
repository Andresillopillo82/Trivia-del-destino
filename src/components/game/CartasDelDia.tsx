import { GAME_CONFIG } from '../../config/gameConfig'
import { getCard } from '../../game/cards'
import { dailyPoints } from '../../game/scoring'
import type { AnswerEvent } from '../../game/types'
import { CardBack } from '../tarot/CardBack'
import { TarotCard } from '../tarot/TarotCard'

/** Descripción de una carta del día para lectores de pantalla. */
function describir(a: AnswerEvent | undefined, i: number): string {
  const num = `Carta ${i + 1}`
  if (!a) return `${num}: sin sacar`
  const nombre = getCard(a.carta).nombre
  if (a.estado !== 'cerrada') return `${num}: ${nombre}, en juego`
  return a.correcta ? `${num}: ${nombre}, acertada, +${dailyPoints(a)}` : `${num}: ${nombre}, fallada`
}

/** Las 3 cartas del día: respondidas (con su resultado), la que está en juego y las que faltan. */
export function CartasDelDia({ answers, className = '' }: { answers: readonly AnswerEvent[]; className?: string }) {
  const slots = Array.from({ length: GAME_CONFIG.preguntasPorDia }, (_, i) => answers.find((a) => a.n === i))
  return (
    <ol className={`flex justify-center gap-3 ${className}`} aria-label="Tus cartas de hoy">
      {slots.map((a, i) => (
        <li key={i} className="flex w-16 flex-col items-center gap-1 sm:w-20" aria-label={describir(a, i)}>
          <div className={`relative w-full ${a?.estado === 'cerrada' ? '' : 'opacity-60'}`} aria-hidden>
            {a ? <TarotCard card={a.carta} className="w-full" /> : <CardBack className="w-full" />}
            {a?.comodin && (
              <span className="absolute -top-2 -right-2 rounded-full bg-violeta px-1.5 text-[10px] font-semibold text-pergamino ring-1 ring-violeta-claro">
                comodín
              </span>
            )}
          </div>
          <span
            aria-hidden
            className={`text-xs font-semibold tabular-nums ${
              !a || a.estado !== 'cerrada' ? 'text-niebla' : a.correcta ? 'text-acierto' : 'text-error'
            }`}
          >
            {!a ? `${i + 1}/${GAME_CONFIG.preguntasPorDia}` : a.estado !== 'cerrada' ? 'en juego' : a.correcta ? `+${dailyPoints(a)}` : '✗'}
          </span>
        </li>
      ))}
    </ol>
  )
}
