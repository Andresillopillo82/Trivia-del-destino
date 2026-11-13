import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  revealed: boolean
  back: ReactNode
  front: ReactNode
  className?: string
  onFlipEnd?: () => void
}

/**
 * Carta que se voltea en 3D del reverso al anverso.
 * Con prefers-reduced-motion, MotionConfig (en main.tsx) hace el cambio instantáneo.
 */
export function FlipCard({ revealed, back, front, className, onFlipEnd }: Props) {
  return (
    <div className={className} style={{ perspective: 1200 }}>
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
        onAnimationComplete={onFlipEnd}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }} aria-hidden={revealed}>
          {back}
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          aria-hidden={!revealed}
        >
          {front}
        </div>
      </motion.div>
    </div>
  )
}
