import type { ReactElement } from 'react'
import { AVATARS, type AvatarId } from '../../game/avatars'
import { ORO, ORO_CLARO, VIOLETA_CLARO } from './palette'

const t = { fill: 'none', stroke: ORO, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** Símbolos de avatar dibujados en una caja de 48×48. */
const GLIFOS: Record<AvatarId, () => ReactElement> = {
  sol: () => (
    <g>
      <circle cx={24} cy={24} r={8} {...t} fill={ORO} fillOpacity={0.3} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return <line key={i} x1={24 + Math.cos(a) * 12} y1={24 + Math.sin(a) * 12} x2={24 + Math.cos(a) * 17} y2={24 + Math.sin(a) * 17} {...t} />
      })}
    </g>
  ),
  luna: () => <path d="M30 9A16 16 0 1 0 30 39A12 12 0 1 1 30 9Z" {...t} fill={ORO} fillOpacity={0.3} />,
  estrella: () => (
    <path
      d="M24 7L28.5 18.5L41 19L31 27L34.5 39.5L24 32.5L13.5 39.5L17 27L7 19L19.5 18.5Z"
      {...t}
      fill={ORO}
      fillOpacity={0.3}
    />
  ),
  ojo: () => (
    <g>
      <path d="M6 24Q24 6 42 24Q24 42 6 24Z" {...t} />
      <circle cx={24} cy={24} r={6} fill={VIOLETA_CLARO} stroke={ORO} strokeWidth={2} />
      <circle cx={24} cy={24} r={2} fill={ORO_CLARO} />
    </g>
  ),
  llave: () => (
    <g>
      <circle cx={16} cy={16} r={7} {...t} />
      <path d="M21 21L40 40M33 33L37 29M37 37L41 33" {...t} />
    </g>
  ),
  copa: () => (
    <g>
      <path d="M12 9H36Q36 26 24 28Q12 26 12 9Z" {...t} fill={ORO} fillOpacity={0.25} />
      <path d="M24 28V38M15 40H33" {...t} />
    </g>
  ),
  espada: () => (
    <g>
      <path d="M24 5L27 10V30H21V10Z" {...t} fill={ORO} fillOpacity={0.2} />
      <path d="M14 30H34M24 30V40" {...t} />
      <circle cx={24} cy={42} r={2.4} fill={ORO} />
    </g>
  ),
  pentaculo: () => {
    const p = Array.from({ length: 5 }, (_, i) => {
      const a = ((i * 2) / 5) * Math.PI * 2 - Math.PI / 2
      return `${24 + Math.cos(a) * 13},${24 + Math.sin(a) * 13}`
    }).join(' ')
    return (
      <g>
        <circle cx={24} cy={24} r={17} {...t} />
        <polygon points={p} {...t} strokeWidth={2} />
      </g>
    )
  },
  vela: () => (
    <g>
      <path d="M24 6C29 12 29 17 24 20C19 17 19 12 24 6Z" fill={ORO_CLARO} />
      <path d="M17 24H31V41H17Z" {...t} />
      <path d="M12 42H36" {...t} />
    </g>
  ),
  rosa: () => (
    <g>
      <circle cx={24} cy={18} r={10} {...t} fill={ORO} fillOpacity={0.2} />
      <path d="M24 12C20 14 20 20 24 21C28 20 28 15 24 15" {...t} strokeWidth={1.8} />
      <path d="M24 28V44M24 36C19 36 16 33 15 30M24 38C29 38 32 35 33 32" {...t} />
    </g>
  ),
}

interface Props {
  avatar: AvatarId
  size?: number
  className?: string
  /** Si es true, el SVG es decorativo (el nombre ya aparece junto a él). */
  decorative?: boolean
}

export function AvatarIcon({ avatar, size = 40, className, decorative = false }: Props) {
  const Glifo = GLIFOS[avatar]
  const nombre = AVATARS.find((a) => a.id === avatar)?.nombre ?? avatar
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `Avatar: ${nombre}` })}
    >
      <circle cx={24} cy={24} r={23} fill="#1d1829" stroke={ORO} strokeOpacity={0.45} strokeWidth={1} />
      <g transform="translate(6 6) scale(0.75)">
        <Glifo />
      </g>
    </svg>
  )
}
