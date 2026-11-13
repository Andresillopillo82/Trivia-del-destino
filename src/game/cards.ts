/** Arcanos mayores usados en el juego y la categoría que representa cada uno. */

export type CardId =
  | 'loco'
  | 'mago'
  | 'sacerdotisa'
  | 'emperatriz'
  | 'emperador'
  | 'enamorados'
  | 'carro'
  | 'ermitano'
  | 'rueda'
  | 'mundo'

export interface CardDef {
  id: CardId
  /** Nombre exacto tal como aparece en el campo `carta` de questions.json. */
  nombre: string
  numeral: string
  categoria: string
}

export const CARDS: readonly CardDef[] = [
  { id: 'loco', nombre: 'El Loco', numeral: '0', categoria: 'Matemáticas' },
  { id: 'mago', nombre: 'El Mago', numeral: 'I', categoria: 'Ciencia y tecnología' },
  { id: 'sacerdotisa', nombre: 'La Sacerdotisa', numeral: 'II', categoria: 'Literatura' },
  { id: 'emperatriz', nombre: 'La Emperatriz', numeral: 'III', categoria: 'Naturaleza y biología' },
  { id: 'emperador', nombre: 'El Emperador', numeral: 'IV', categoria: 'Historia' },
  { id: 'enamorados', nombre: 'Los Enamorados', numeral: 'VI', categoria: 'Música y cine' },
  { id: 'carro', nombre: 'El Carro', numeral: 'VII', categoria: 'Deportes' },
  { id: 'ermitano', nombre: 'El Ermitaño', numeral: 'IX', categoria: 'Filosofía y mitología' },
  { id: 'rueda', nombre: 'La Rueda de la Fortuna', numeral: 'X', categoria: 'Cultura pop y videojuegos' },
  { id: 'mundo', nombre: 'El Mundo', numeral: 'XXI', categoria: 'Geografía' },
]

const BY_ID = new Map(CARDS.map((c) => [c.id, c]))
const BY_NAME = new Map(CARDS.map((c) => [c.nombre, c]))

export function getCard(id: CardId): CardDef {
  const card = BY_ID.get(id)
  if (!card) throw new Error(`Carta desconocida: ${id}`)
  return card
}

/** Busca la carta por el nombre usado en las preguntas ("El Loco"). */
export function cardByName(nombre: string): CardDef | undefined {
  return BY_NAME.get(nombre)
}
