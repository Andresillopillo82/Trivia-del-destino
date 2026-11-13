/** Generador de números aleatorios inyectable: devuelve un número en [0, 1). */
export type Rng = () => number

export const defaultRng: Rng = Math.random

/** PRNG determinista (mulberry32) para pruebas y para que los bots sean reproducibles. */
export function seededRng(seed: number | string): Rng {
  let a = typeof seed === 'number' ? seed >>> 0 : hashString(seed)
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function randInt(rng: Rng, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1))
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: lista vacía')
  return items[Math.floor(rng() * items.length)]!
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p
}
