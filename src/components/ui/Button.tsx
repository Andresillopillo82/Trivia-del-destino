import type { ButtonHTMLAttributes } from 'react'

type Variant = 'oro' | 'violeta' | 'fantasma' | 'peligro'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'lg'
  loading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  oro:
    'bg-gradient-to-b from-oro-claro via-oro to-oro-oscuro text-noche shadow-dorado hover:brightness-110 active:brightness-95',
  violeta:
    'bg-violeta text-pergamino border border-violeta-claro/70 hover:bg-[#6a33a0] active:brightness-95',
  fantasma: 'bg-transparent text-oro-claro border border-oro/40 hover:bg-oro/10',
  peligro: 'bg-transparent text-error border border-error/60 hover:bg-error/10',
}

const SIZES = {
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-14 px-7 text-base',
}

export function Button({ variant = 'oro', size = 'md', loading = false, className = '', children, disabled, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold tracking-wider uppercase transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading && (
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
