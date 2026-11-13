import type { QuickDifficultyStep } from '../../config/gameConfig'
import { seededRng, type Rng } from '../rng'
import type { Question } from '../types'

/** El último tramo (sin fin) se reparte en bloques de este tamaño. */
const BLOQUE_ABIERTO = 5

/**
 * Niveles (true = hard) del tramo que empieza en la pregunta `pos` (1-based). En cada tramo hay
 * exactamente round(proporción × tamaño) preguntas hard, en posiciones elegidas con la semilla.
 */
function planTramo(pos: number, steps: readonly QuickDifficultyStep[], rng: Rng): boolean[] {
  let s = -1
  for (let i = 0; i < steps.length; i++) if (steps[i]!.desde <= pos) s = i
  const siguiente = steps[s + 1]
  const tam = siguiente ? siguiente.desde - pos : BLOQUE_ABIERTO
  const p = s >= 0 ? steps[s]!.hard : 0
  const k = Math.floor(p * tam + 0.5)
  const idx = Array.from({ length: tam }, (_, i) => i)
  for (let j = 0; j < k; j++) {
    const r = j + Math.floor(rng() * (tam - j))
    const t = idx[j]!
    idx[j] = idx[r]!
    idx[r] = t
  }
  const flags = Array<boolean>(tam).fill(false)
  for (let j = 0; j < k; j++) flags[idx[j]!] = true
  return flags
}

/**
 * Elige la siguiente pregunta. Si no hay candidatas, relaja las condiciones en este orden:
 * evitar (ronda anterior) → nivel. Si solo quedan preguntas de la carta anterior, devuelve null.
 */
function elegir(
  questions: readonly Question[],
  hard: boolean,
  usadas: ReadonlySet<string>,
  evitar: ReadonlySet<string>,
  ultimaCarta: string | null,
  rng: Rng,
): Question | null {
  const nivel = hard ? 'hard' : 'normal'
  const filtros: ((q: Question) => boolean)[] = [
    (q) => q.nivel === nivel && !usadas.has(q.id) && !evitar.has(q.id) && q.carta !== ultimaCarta,
    (q) => q.nivel === nivel && !usadas.has(q.id) && q.carta !== ultimaCarta,
    (q) => !usadas.has(q.id) && !evitar.has(q.id) && q.carta !== ultimaCarta,
    (q) => !usadas.has(q.id) && q.carta !== ultimaCarta,
  ]
  for (const f of filtros) {
    const c = questions.filter(f)
    if (c.length > 0) return c[Math.floor(rng() * c.length)]!
  }
  return null
}

/**
 * Secuencia determinista de la Partida Rápida: misma semilla ⇒ mismas preguntas para todos (web y
 * Android). Sin repetir (al agotar el banco empieza otra vuelta), sin dos cartas seguidas iguales y
 * con dificultad progresiva. El prefijo no depende de `length`, así que se puede generar bajo demanda.
 */
export function buildQuickSequence(
  seed: number,
  questions: readonly Question[],
  config: { difficulty: readonly QuickDifficultyStep[] },
  length: number,
  evitar: readonly string[] = [],
): Question[] {
  if (questions.length === 0) throw new Error('buildQuickSequence: banco vacío')
  const rng = seededRng(seed)
  const evitarSet = new Set(evitar)
  const usadas = new Set<string>()
  const seq: Question[] = []
  let tramo: boolean[] = []
  let t = 0
  while (seq.length < length) {
    if (t >= tramo.length) {
      tramo = planTramo(seq.length + 1, config.difficulty, rng)
      t = 0
    }
    const hard = tramo[t++]!
    const ultima = seq.at(-1)?.carta ?? null
    let q = elegir(questions, hard, usadas, evitarSet, ultima, rng)
    if (!q) {
      // Banco agotado (o solo queda la carta anterior): empieza otra vuelta del mazo.
      usadas.clear()
      q = elegir(questions, hard, usadas, evitarSet, ultima, rng) ?? elegir(questions, hard, usadas, evitarSet, null, rng)!
    }
    usadas.add(q.id)
    seq.push(q)
  }
  return seq
}
