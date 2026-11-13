/**
 * Genera los efectos de sonido de la app Android (WAV PCM 16 bits, mono, 22 050 Hz) por síntesis:
 * son originales, sin problemas de licencia.
 *
 *   node scripts/generate-android-sounds.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RATE = 22_050
const destino = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'android/app/src/main/res/raw')

/** Envolvente de campana: ataque corto y caída exponencial. */
const campana = (t, ataque, caida) => (t < ataque ? t / ataque : Math.exp(-(t - ataque) / caida))

function nota(muestras, inicio, frecuencia, duracion, volumen = 0.5, armonicos = [1, 0.5, 0.25], caida = 0.18) {
  const n0 = Math.floor(inicio * RATE)
  const n = Math.floor(duracion * RATE)
  for (let i = 0; i < n && n0 + i < muestras.length; i++) {
    const t = i / RATE
    let v = 0
    armonicos.forEach((a, k) => (v += a * Math.sin(2 * Math.PI * frecuencia * (k + 1) * t)))
    muestras[n0 + i] += (v / armonicos.length) * volumen * campana(t, 0.006, caida)
  }
}

function wav(nombre, segundos, componer) {
  const muestras = new Float32Array(Math.floor(segundos * RATE))
  componer(muestras)
  // Fundido final para evitar chasquidos y normalización suave.
  const pico = Math.max(0.0001, ...muestras.map(Math.abs))
  const ganancia = Math.min(1, 0.85 / pico)
  const datos = Buffer.alloc(muestras.length * 2)
  muestras.forEach((v, i) => {
    const fin = Math.min(1, (muestras.length - i) / (RATE * 0.02))
    datos.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * ganancia * fin)) * 32_767), i * 2)
  })
  const cab = Buffer.alloc(44)
  cab.write('RIFF', 0)
  cab.writeUInt32LE(36 + datos.length, 4)
  cab.write('WAVEfmt ', 8)
  cab.writeUInt32LE(16, 16)
  cab.writeUInt16LE(1, 20) // PCM
  cab.writeUInt16LE(1, 22) // mono
  cab.writeUInt32LE(RATE, 24)
  cab.writeUInt32LE(RATE * 2, 28)
  cab.writeUInt16LE(2, 32)
  cab.writeUInt16LE(16, 34)
  cab.write('data', 36)
  cab.writeUInt32LE(datos.length, 40)
  writeFileSync(join(destino, `${nombre}.wav`), Buffer.concat([cab, datos]))
  console.log(`${nombre}.wav  ${(segundos * 1000).toFixed(0)} ms`)
}

mkdirSync(destino, { recursive: true })

// Carta que se voltea: barrido ascendente con destellos.
wav('sonido_carta', 0.5, (m) => {
  for (let i = 0; i < m.length; i++) {
    const t = i / RATE
    const f = 500 + 1400 * (t / 0.5) ** 1.5
    m[i] += Math.sin(2 * Math.PI * f * t) * 0.25 * campana(t, 0.05, 0.2)
  }
  ;[0.12, 0.2, 0.28].forEach((t, k) => nota(m, t, 1760 + k * 440, 0.2, 0.3, [1, 0.3], 0.06))
})

// Acierto: arpegio mayor brillante (Do–Mi–Sol–Do).
wav('sonido_acierto', 0.75, (m) => {
  ;[1046.5, 1318.5, 1568, 2093].forEach((f, k) => nota(m, k * 0.085, f, 0.55, 0.45, [1, 0.4, 0.15], 0.16))
})

// Fallo: dos notas graves descendentes.
wav('sonido_fallo', 0.6, (m) => {
  nota(m, 0, 330, 0.3, 0.5, [1, 0.6, 0.3, 0.15], 0.12)
  nota(m, 0.18, 247, 0.42, 0.5, [1, 0.6, 0.3, 0.15], 0.16)
})

// Tic de los últimos segundos.
wav('sonido_tic', 0.06, (m) => nota(m, 0, 1400, 0.06, 0.4, [1, 0.2], 0.012))

// Fanfarria de la ceremonia: acordes ascendentes y arpegio final.
wav('sonido_fanfarria', 1.8, (m) => {
  const acorde = (t, fs, d) => fs.forEach((f) => nota(m, t, f, d, 0.28, [1, 0.5, 0.25, 0.1], 0.35))
  acorde(0, [523.3, 659.3, 784], 0.4)
  acorde(0.32, [587.3, 740, 880], 0.4)
  acorde(0.64, [659.3, 830.6, 987.8], 1.1)
  ;[1318.5, 1568, 1975.5, 2637].forEach((f, k) => nota(m, 0.7 + k * 0.08, f, 0.6, 0.25, [1, 0.3], 0.2))
})
