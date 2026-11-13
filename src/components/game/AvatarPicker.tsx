import { useRef, type KeyboardEvent } from 'react'
import { AVATARS, type AvatarId } from '../../game/avatars'
import { AvatarIcon } from '../tarot/AvatarIcon'

interface Props {
  value: AvatarId
  onChange: (a: AvatarId) => void
}

/** Grupo de radio accesible: flechas para moverse, Espacio/Enter para elegir. */
export function AvatarPicker({ value, onChange }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: KeyboardEvent, i: number) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!delta) return
    e.preventDefault()
    const j = (i + delta + AVATARS.length) % AVATARS.length
    onChange(AVATARS[j]!.id)
    refs.current[j]?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Elige tu avatar" className="grid grid-cols-5 gap-2 sm:gap-3">
      {AVATARS.map((a, i) => {
        const activo = a.id === value
        return (
          <button
            key={a.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={activo}
            tabIndex={activo ? 0 : -1}
            onClick={() => onChange(a.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-xs transition ${
              activo ? 'border-oro bg-violeta/40 text-oro-claro shadow-dorado' : 'border-transparent text-niebla hover:border-oro/30'
            }`}
          >
            <AvatarIcon avatar={a.id} size={44} decorative />
            {a.nombre}
          </button>
        )
      })}
    </div>
  )
}
