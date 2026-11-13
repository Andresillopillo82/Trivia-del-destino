const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function IconInicio() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <rect x={6} y={3} width={12} height={18} rx={2} {...base} />
      <path d="M12 8l1.5 3 3 .4-2.2 2 .6 3L12 15l-2.9 1.4.6-3-2.2-2 3-.4z" {...base} strokeWidth={1.4} />
    </svg>
  )
}

export function IconClasificacion() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <path d="M4 20V13h5v7M9 20V8h6v12M15 20v-5h5v5M3 20h18" {...base} />
    </svg>
  )
}

export function IconPerfil() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <circle cx={12} cy={8} r={4} {...base} />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...base} />
    </svg>
  )
}

export function IconAdmin() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <circle cx={12} cy={12} r={3} {...base} />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"
        {...base}
      />
    </svg>
  )
}
