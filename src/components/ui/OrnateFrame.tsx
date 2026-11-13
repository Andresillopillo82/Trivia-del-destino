import type { ReactNode } from 'react'

function Esquina({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`pointer-events-none absolute size-6 text-oro ${className}`}>
      <path d="M2 14V6Q2 2 6 2H14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={6} cy={6} r={1.8} fill="currentColor" />
    </svg>
  )
}

interface Props {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'aside'
  /** Título opcional con separadores ornamentales. */
  title?: string
}

/** Panel con esquineros dorados. */
export function OrnateFrame({ children, className = '', as: Tag = 'div', title }: Props) {
  return (
    <Tag className={`panel relative p-5 ${className}`}>
      <Esquina className="top-1.5 left-1.5" />
      <Esquina className="top-1.5 right-1.5 -scale-x-100" />
      <Esquina className="bottom-1.5 left-1.5 -scale-y-100" />
      <Esquina className="right-1.5 bottom-1.5 -scale-100" />
      {title && <OrnateTitle>{title}</OrnateTitle>}
      {children}
    </Tag>
  )
}

export function OrnateTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`mb-4 flex items-center gap-3 text-center text-lg text-oro-claro ${className}`}>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-oro/60" />
      <span>{children}</span>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-oro/60" />
    </h2>
  )
}
