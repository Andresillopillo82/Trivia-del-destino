import type { ReactNode } from 'react'
import { NOCHE, ORO, ORO_CLARO, ORO_OSCURO, VIOLETA, useSvgId } from './palette'

export const CARD_W = 200
export const CARD_H = 340

interface Props {
  /** Color principal del fondo (arriba); se funde con negro hacia abajo. */
  fondo?: string
  titulo: string
  children?: ReactNode
  className?: string
}

/** Esquinero ornamental (se dibuja para la esquina superior izquierda y se refleja). */
function Esquinero({ id }: { id: string }) {
  return (
    <g id={id} fill="none" stroke={`url(#${id}-oro)`} strokeWidth={1.4} strokeLinecap="round">
      <path d="M14 34V18Q14 14 18 14H34" />
      <path d="M20 40C20 28 28 20 40 20" strokeWidth={0.9} />
      <circle cx={22} cy={22} r={2.4} fill={ORO_CLARO} stroke="none" />
      <path d="M22 28c4 0 6-2 6-6" strokeWidth={0.9} />
    </g>
  )
}

/**
 * Marco dorado común a todas las cartas (caras, reverso y Carta de Reto).
 * Las coordenadas internas son 200×340.
 */
export function CardFrame({ fondo = VIOLETA, titulo, children, className }: Props) {
  const id = useSvgId('cf')

  return (
    <svg
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      role="img"
      aria-label={titulo}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{titulo}</title>
      <defs>
        <linearGradient id={`${id}-fondo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fondo} />
          <stop offset="0.55" stopColor="#1a1226" />
          <stop offset="1" stopColor={NOCHE} />
        </linearGradient>
        <linearGradient id={`${id}-esq-oro`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={ORO_CLARO} />
          <stop offset="0.5" stopColor={ORO} />
          <stop offset="1" stopColor={ORO_OSCURO} />
        </linearGradient>
        <linearGradient id={`${id}-borde`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={ORO_CLARO} />
          <stop offset="0.35" stopColor={ORO} />
          <stop offset="0.65" stopColor={ORO_OSCURO} />
          <stop offset="1" stopColor={ORO_CLARO} />
        </linearGradient>
        <radialGradient id={`${id}-halo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={ORO} stopOpacity={0.28} />
          <stop offset="0.6" stopColor={VIOLETA} stopOpacity={0.25} />
          <stop offset="1" stopColor={VIOLETA} stopOpacity={0} />
        </radialGradient>
      </defs>

      <rect width={CARD_W} height={CARD_H} rx={14} fill={`url(#${id}-fondo)`} />
      <rect width={CARD_W} height={CARD_H} rx={14} fill="none" stroke={ORO_OSCURO} strokeWidth={2} />
      <rect x={8} y={8} width={CARD_W - 16} height={CARD_H - 16} rx={9} fill="none" stroke={`url(#${id}-borde)`} strokeWidth={2.2} />
      <rect x={13} y={13} width={CARD_W - 26} height={CARD_H - 26} rx={6} fill="none" stroke={ORO} strokeOpacity={0.55} strokeWidth={0.8} />

      <circle cx={100} cy={172} r={80} fill={`url(#${id}-halo)`} />

      <Esquinero id={`${id}-esq`} />
      <use href={`#${id}-esq`} transform={`translate(${CARD_W} 0) scale(-1 1)`} />
      <use href={`#${id}-esq`} transform={`translate(0 ${CARD_H}) scale(1 -1)`} />
      <use href={`#${id}-esq`} transform={`translate(${CARD_W} ${CARD_H}) scale(-1 -1)`} />

      {children}
    </svg>
  )
}
