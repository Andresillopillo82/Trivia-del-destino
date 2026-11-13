import { defaultRng, type Rng } from './rng'

/** Sin 0/O, 1/I para que el código se lea y dicte sin confusiones. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 5

export function generateGroupCode(rng: Rng = defaultRng): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)]
  return code
}

/** Normaliza lo que escribe el usuario: mayúsculas, sin espacios ni guiones. */
export function normalizeGroupCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}

export function isValidGroupCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false
  return [...code].every((ch) => CODE_ALPHABET.includes(ch))
}

export const ADMIN_KEY_LENGTH = 8

/** Clave de administración del grupo (mismo alfabeto que los códigos, 8 caracteres). */
export function generateAdminKey(rng: Rng = defaultRng): string {
  let clave = ''
  for (let i = 0; i < ADMIN_KEY_LENGTH; i++) clave += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)]
  return clave
}

export function isValidAdminKey(clave: string): boolean {
  return clave.length === ADMIN_KEY_LENGTH && [...clave].every((ch) => CODE_ALPHABET.includes(ch))
}
