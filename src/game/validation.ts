export const APODO_MIN = 2
export const APODO_MAX = 16
export const NOMBRE_GRUPO_MIN = 3
export const NOMBRE_GRUPO_MAX = 30

/** Quita espacios sobrantes y caracteres de control. */
export function cleanText(input: string): string {
  return input
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function validarLargo(valor: string, min: number, max: number, que: string): string | null {
  const largo = [...valor].length
  if (largo < min) return `${que} debe tener al menos ${min} caracteres.`
  if (largo > max) return `${que} puede tener como máximo ${max} caracteres.`
  return null
}

/** Devuelve un mensaje de error en español, o null si es válido. */
export function validateApodo(input: string): string | null {
  return validarLargo(cleanText(input), APODO_MIN, APODO_MAX, 'El apodo')
}

export function validateGroupName(input: string): string | null {
  return validarLargo(cleanText(input), NOMBRE_GRUPO_MIN, NOMBRE_GRUPO_MAX, 'El nombre del grupo')
}
