import { motion } from 'framer-motion'
import { CardBack } from './CardBack'

interface Props {
  /** Mientras es true, las cartas se barajan en bucle. */
  shuffling: boolean
  className?: string
}

const CAPAS = 5

/** Mazo boca abajo; al barajar, las cartas se abren en abanico y se cruzan. */
export function Deck({ shuffling, className = '' }: Props) {
  return (
    <div className={`relative aspect-[200/340] ${className}`} aria-hidden>
      {Array.from({ length: CAPAS }, (_, i) => {
        const lado = i % 2 === 0 ? -1 : 1
        const reposo = { x: -i * 1.5, y: -i * 2, rotate: (i - 2) * 1.2 }
        return (
          <motion.div
            key={i}
            className="absolute inset-0 drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)]"
            style={{ zIndex: i }}
            initial={false}
            animate={
              shuffling
                ? {
                    x: [reposo.x, lado * (40 + i * 12), reposo.x],
                    y: [reposo.y, -10 - i * 3, reposo.y],
                    rotate: [reposo.rotate, lado * (10 + i * 2), reposo.rotate],
                  }
                : reposo
            }
            transition={
              shuffling
                ? { duration: 0.55, repeat: Infinity, delay: i * 0.06, ease: 'easeInOut' }
                : { duration: 0.3 }
            }
          >
            <CardBack className="h-full w-full" />
          </motion.div>
        )
      })}
    </div>
  )
}
