import { useId, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string | null
}

/** Campo de texto con etiqueta, ayuda y error asociados para lectores de pantalla. */
export function Field({ label, hint, error, className = '', ...rest }: Props) {
  const id = useId()
  const descId = `${id}-desc`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-pergamino">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={hint || error ? descId : undefined}
        className={`min-h-12 rounded-xl border bg-noche-3/80 px-4 text-base text-pergamino placeholder:text-niebla/60 focus:border-oro focus:outline-none ${
          error ? 'border-error' : 'border-oro/30'
        } ${className}`}
        {...rest}
      />
      {(error || hint) && (
        <p id={descId} className={`text-xs ${error ? 'text-error' : 'text-niebla'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-xl border border-error/50 bg-error/10 p-3 text-sm text-error">
      {children}
    </p>
  )
}
