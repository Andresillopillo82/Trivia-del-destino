import { describe, expect, it } from 'vitest'
import { computeStandings, streaks } from '../standings'
import { awardTitles } from '../titles'
import type { StandingRow } from '../types'
import { DEVUELTO_MAL_MS, answer, challenge, extraChallenge, player } from './fixtures'

const base = { seasonClosed: false }

function fila(rows: StandingRow[], uid: string): StandingRow {
  const r = rows.find((x) => x.uid === uid)
  if (!r) throw new Error(`sin fila ${uid}`)
  return r
}

describe('computeStandings: puntos', () => {
  it('suma las preguntas del día: +5 por acierto y +2 si fue en menos de 8 s', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana')],
      answers: [
        answer('ana', 0, { n: 0, tiempoMs: 5_000 }), // 7
        answer('ana', 0, { n: 1, tiempoMs: 12_000 }), // 5
        answer('ana', 0, { n: 2, correcta: false, tiempoMs: 3_000 }), // 0
        answer('ana', 1, { n: 0, tiempoMs: 7_999 }), // 7
      ],
      challenges: [],
    })
    expect(rows[0]).toMatchObject({ puntos: 19, aciertos: 3, respondidas: 4, tiempoPromedioMs: 27_999 / 4 })
  })

  it('una carta volteada sin abrir no suma ni cuenta como respondida', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana')],
      answers: [answer('ana', 0, { estado: 'carta', preguntaId: null, correcta: false, tiempoMs: 0 })],
      challenges: [],
    })
    expect(rows[0]).toMatchObject({ puntos: 0, respondidas: 0, tiempoPromedioMs: null })
  })

  it('una respuesta abierta (en curso) no suma ni cuenta para el promedio', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana')],
      answers: [answer('ana', 0, { estado: 'abierta', correcta: false, tiempoMs: 0 })],
      challenges: [],
    })
    expect(rows[0]).toMatchObject({ puntos: 0, respondidas: 0, tiempoPromedioMs: null })
  })

  it('reto: lanzar no da puntos; +10 al retado si acierta', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana'), player('beto')],
      answers: [],
      challenges: [challenge('ana', 'beto', 0, { estado: 'resuelto', correcta: true })],
    })
    expect(fila(rows, 'ana')).toMatchObject({ puntos: 0, retosLanzados: 1, retosGanados: 0 })
    expect(fila(rows, 'beto')).toMatchObject({ puntos: 10, retosGanados: 1 })
  })

  it('reto: el retado que falla pierde 5 y el retador gana +10', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana'), player('beto')],
      answers: [],
      challenges: [challenge('ana', 'beto', 0, { estado: 'resuelto', correcta: false })],
    })
    expect(fila(rows, 'ana')).toMatchObject({ puntos: 10, retosGanados: 1 })
    expect(fila(rows, 'beto').puntos).toBe(-5)
  })

  it('reto pendiente: nada mientras la temporada sigue; al cerrarla, fallo del retado', () => {
    const input = {
      players: [player('ana'), player('beto')],
      answers: [],
      challenges: [challenge('ana', 'beto', 0)],
    }
    const abierta = computeStandings({ ...input, seasonClosed: false })
    expect([fila(abierta, 'ana').puntos, fila(abierta, 'beto').puntos]).toEqual([0, 0])
    const cerrada = computeStandings({ ...input, seasonClosed: true })
    expect([fila(cerrada, 'ana').puntos, fila(cerrada, 'beto').puntos]).toEqual([10, -5])
  })

  it('doble reto: la pregunta extra se suma al reto principal y no cuenta como otro reto lanzado', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana'), player('beto')],
      answers: [],
      challenges: [
        challenge('ana', 'beto', 0, { devueltoEnMs: DEVUELTO_MAL_MS, estado: 'resuelto', correcta: false }),
        extraChallenge('ana', 'beto', 0, { estado: 'resuelto', correcta: false }),
      ],
    })
    expect(fila(rows, 'beto')).toMatchObject({ puntos: -10, retosGanados: 0 })
    expect(fila(rows, 'ana')).toMatchObject({ puntos: 10, retosLanzados: 1, retosGanados: 1 })
  })

  it('los puntos pueden quedar en negativo', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana'), player('beto')],
      answers: [],
      challenges: [challenge('ana', 'beto', 0, { estado: 'resuelto', correcta: false })],
    })
    expect(rows.map((r) => [r.uid, r.puntos, r.posicion])).toEqual([
      ['ana', 10, 1],
      ['beto', -5, 2],
    ])
  })

  it('ignora eventos de jugadores que no están en el grupo', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana')],
      answers: [answer('fantasma', 0)],
      challenges: [challenge('fantasma', 'ana', 0, { estado: 'resuelto', correcta: false })],
    })
    expect(rows).toHaveLength(1)
    // El +10 del fantasma no aparece; el −5 de Ana por fallar el reto sí cuenta.
    expect(rows[0]!.puntos).toBe(-5)
  })
})

describe('computeStandings: orden y desempates', () => {
  it('ordena por puntos', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana'), player('beto')],
      answers: [answer('beto', 0)],
      challenges: [],
    })
    expect(rows.map((r) => [r.uid, r.posicion])).toEqual([
      ['beto', 1],
      ['ana', 2],
    ])
  })

  it('empate en puntos: gana quien tiene más aciertos', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana'), player('beto'), player('caro')],
      // ana: 5 + 5 = 10 con 2 aciertos; beto: 10 por ganar el reto que falló caro, sin aciertos.
      answers: [answer('ana', 0, { n: 0 }), answer('ana', 0, { n: 1 })],
      challenges: [challenge('beto', 'caro', 0, { estado: 'resuelto', correcta: false })],
    })
    expect(fila(rows, 'ana').puntos).toBe(10)
    expect(fila(rows, 'beto').puntos).toBe(10)
    expect(rows[0]!.uid).toBe('ana')
    expect(rows[1]!.uid).toBe('beto')
  })

  it('empate en puntos y aciertos: gana el menor tiempo promedio', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana'), player('beto')],
      answers: [answer('ana', 0, { tiempoMs: 12_000 }), answer('beto', 0, { tiempoMs: 9_000 })],
      challenges: [],
    })
    expect(rows.map((r) => r.uid)).toEqual(['beto', 'ana'])
    expect(rows.map((r) => r.posicion)).toEqual([1, 2])
  })

  it('el tiempo promedio incluye las respuestas falladas', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana'), player('beto')],
      answers: [
        answer('ana', 0, { tiempoMs: 9_000 }),
        answer('ana', 1, { correcta: false, tiempoMs: 20_000 }),
        answer('beto', 0, { tiempoMs: 12_000 }),
        answer('beto', 1, { correcta: false, tiempoMs: 12_000 }),
      ],
      challenges: [],
    })
    expect(rows.map((r) => r.uid)).toEqual(['beto', 'ana'])
  })

  it('empate total: comparten posición', () => {
    const rows = computeStandings({
      ...base,
      players: [player('beto'), player('ana'), player('caro')],
      answers: [answer('ana', 0), answer('beto', 0)],
      challenges: [],
    })
    expect(rows.map((r) => [r.uid, r.posicion])).toEqual([
      ['ana', 1],
      ['beto', 1],
      ['caro', 3],
    ])
  })

  it('sin respuestas, el tiempo promedio no gana el desempate', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana'), player('beto')],
      answers: [answer('beto', 0, { correcta: false })],
      challenges: [],
    })
    expect(rows.map((r) => r.uid)).toEqual(['beto', 'ana'])
  })
})

describe('streaks (aciertos seguidos)', () => {
  /** [día, número de pregunta, acertó] */
  const resp = (...rs: [number, number, boolean][]) => rs.map(([dia, n, correcta]) => answer('x', dia, { n, correcta }))

  it('cuenta aciertos seguidos en orden de día y pregunta; un fallo la corta', () => {
    expect(streaks(resp([0, 0, true], [0, 1, true], [0, 2, false], [1, 0, true], [1, 1, true], [1, 2, true]))).toEqual({
      mejor: 3,
      actual: 3,
    })
  })

  it('sigue de un día al siguiente y las preguntas sin jugar no la cortan', () => {
    expect(streaks(resp([0, 1, true], [0, 2, true], [3, 0, true]))).toEqual({ mejor: 3, actual: 3 })
  })

  it('el orden de llegada de los eventos no importa', () => {
    expect(streaks(resp([1, 0, true], [0, 2, false], [0, 0, true], [0, 1, true]))).toEqual({ mejor: 2, actual: 1 })
  })

  it('un fallo al final deja la racha actual en 0', () => {
    expect(streaks(resp([1, 0, true], [1, 1, true], [1, 2, false]))).toEqual({ mejor: 2, actual: 0 })
  })

  it('una pregunta abierta o una carta sin abrir no cuentan', () => {
    const r = streaks([
      ...resp([2, 0, true]),
      answer('x', 2, { n: 1, estado: 'abierta', correcta: false }),
      answer('x', 2, { n: 2, estado: 'carta', correcta: false }),
    ])
    expect(r).toEqual({ mejor: 1, actual: 1 })
  })
})

describe('awardTitles', () => {
  it('Dueño del Destino, El Vidente y El Retador', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana'), player('beto'), player('caro')],
      answers: [
        answer('ana', 0, { n: 0 }),
        answer('ana', 0, { n: 1 }),
        answer('ana', 0, { n: 2 }),
        answer('beto', 0),
        answer('caro', 0),
        answer('caro', 1, { correcta: false }),
      ],
      challenges: [
        challenge('beto', 'caro', 0, { estado: 'resuelto', correcta: false }),
        challenge('beto', 'ana', 1, { estado: 'resuelto', correcta: false }),
      ],
    })
    const t = awardTitles(rows)
    expect(t.duenoDelDestino?.uid).toBe('beto') // 5 + 2×10 = 25
    expect(t.vidente?.uid).toBe('ana') // 3 aciertos seguidos
    expect(t.retador?.uid).toBe('beto') // 2 retos ganados
  })

  it('en los títulos secundarios, el empate lo gana quien va mejor clasificado', () => {
    const rows = computeStandings({
      ...base,
      players: [player('ana'), player('beto')],
      answers: [answer('ana', 0, { tiempoMs: 12_000 }), answer('beto', 0, { tiempoMs: 1_000 })],
      challenges: [],
    })
    expect(awardTitles(rows).vidente?.uid).toBe('beto')
  })

  it('sin actividad no hay títulos', () => {
    const rows = computeStandings({ ...base, players: [player('ana')], answers: [], challenges: [] })
    expect(awardTitles(rows)).toEqual({ duenoDelDestino: null, vidente: null, retador: null })
    expect(awardTitles([])).toEqual({ duenoDelDestino: null, vidente: null, retador: null })
  })
})
