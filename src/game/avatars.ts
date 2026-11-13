/** Símbolos de tarot que los jugadores pueden elegir como avatar. */

export type AvatarId =
  | 'sol'
  | 'luna'
  | 'estrella'
  | 'ojo'
  | 'llave'
  | 'copa'
  | 'espada'
  | 'pentaculo'
  | 'vela'
  | 'rosa'

export interface AvatarDef {
  id: AvatarId
  nombre: string
}

export const AVATARS: readonly AvatarDef[] = [
  { id: 'sol', nombre: 'Sol' },
  { id: 'luna', nombre: 'Luna' },
  { id: 'estrella', nombre: 'Estrella' },
  { id: 'ojo', nombre: 'Ojo' },
  { id: 'llave', nombre: 'Llave' },
  { id: 'copa', nombre: 'Copa' },
  { id: 'espada', nombre: 'Espada' },
  { id: 'pentaculo', nombre: 'Pentáculo' },
  { id: 'vela', nombre: 'Vela' },
  { id: 'rosa', nombre: 'Rosa' },
]

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && AVATARS.some((a) => a.id === value)
}
