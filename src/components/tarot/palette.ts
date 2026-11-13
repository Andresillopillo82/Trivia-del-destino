import { useId } from 'react'

export const ORO = '#D4AF37'
export const ORO_CLARO = '#F1D77A'
export const ORO_OSCURO = '#9C7C1F'
export const VIOLETA = '#5B2A86'
export const VIOLETA_CLARO = '#8B5CF6'
export const NOCHE = '#0B0A10'

/** useId de React apto para usarse dentro de url(#...) en SVG. */
export function useSvgId(prefix: string): string {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '')
}
