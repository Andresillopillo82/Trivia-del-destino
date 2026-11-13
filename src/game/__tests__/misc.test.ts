import { describe, expect, it } from 'vitest'
import { CODE_ALPHABET, generateGroupCode, isValidGroupCode, normalizeGroupCode } from '../codes'
import { MS_DIA, isSeasonOver, msUntilNextDay, offsetForDay, seasonDay, startOfLocalDay } from '../day'
import { seededRng } from '../rng'
import { cleanText, validateApodo, validateGroupName } from '../validation'

describe('día de temporada', () => {
  const inicio = new Date(2026, 9, 17).getTime() // medianoche local
  const hora = 3_600_000

  it('día 0 el día de creación, 1 tras medianoche', () => {
    expect(seasonDay(inicio, 0, inicio + 10 * hora)).toBe(0)
    expect(seasonDay(inicio, 0, inicio + MS_DIA + hora)).toBe(1)
  })

  it('dayOffset adelanta el día (modo demo)', () => {
    expect(seasonDay(inicio, 3, inicio + hora)).toBe(3)
  })

  it('nunca es negativo', () => {
    expect(seasonDay(inicio, 0, inicio - hora)).toBe(0)
  })

  it('la temporada termina el día 7', () => {
    expect(isSeasonOver(6)).toBe(false)
    expect(isSeasonOver(7)).toBe(true)
  })

  it('offsetForDay permite saltar al final', () => {
    const ahora = inicio + 2 * MS_DIA + 5 * hora
    expect(seasonDay(inicio, offsetForDay(inicio, ahora, 7), ahora)).toBe(7)
  })

  it('startOfLocalDay y msUntilNextDay', () => {
    expect(startOfLocalDay(inicio + 13 * hora)).toBe(inicio)
    expect(msUntilNextDay(inicio, inicio + 20 * hora)).toBe(4 * hora)
  })
})

describe('códigos de grupo', () => {
  it('5 caracteres del alfabeto sin ambiguos', () => {
    const rng = seededRng(5)
    for (let i = 0; i < 200; i++) {
      const c = generateGroupCode(rng)
      expect(c).toHaveLength(5)
      expect(isValidGroupCode(c)).toBe(true)
    }
    expect(CODE_ALPHABET).not.toMatch(/[01IO]/)
  })

  it('normaliza lo que escribe el usuario', () => {
    expect(normalizeGroupCode(' a7k-2q ')).toBe('A7K2Q')
    expect(isValidGroupCode('A7K2Q')).toBe(true)
    expect(isValidGroupCode('A7K2')).toBe(false)
    expect(isValidGroupCode('A0K2Q')).toBe(false)
  })
})

describe('validaciones de texto', () => {
  it('limpia espacios y caracteres de control', () => {
    expect(cleanText('  Luna \n  Errante\u0007 ')).toBe('Luna Errante')
  })

  it('apodo entre 2 y 16 caracteres', () => {
    expect(validateApodo('A')).toMatch(/al menos 2/)
    expect(validateApodo('Ñu')).toBeNull()
    expect(validateApodo('x'.repeat(17))).toMatch(/máximo 16/)
  })

  it('nombre de grupo entre 3 y 30', () => {
    expect(validateGroupName('ab')).not.toBeNull()
    expect(validateGroupName('Los Arcanos')).toBeNull()
  })
})
