/**
 * Prueba cruzada Android ↔ web: la app Android (prueba instrumentada en el emulador) crea el grupo;
 * aquí un jugador web se une y juega, y una organizadora web lo administra con la clave.
 *
 * Uso (con el emulador encendido, la app y su APK de pruebas instaladas, y `npm run dev` corriendo):
 *   node scripts/e2e/android-web-datos.mjs [carpeta-capturas]
 */
import { chromium } from 'playwright-core'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const OUT = process.argv[2] ?? 'android/captures'
mkdirSync(OUT, { recursive: true })
const PREG = JSON.parse(readFileSync(process.argv[3] ?? 'src/data/questions.json', 'utf8'))
const ADB = `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`
const env = { ...process.env, MSYS_NO_PATHCONV: '1' }
const log = (...a) => console.log('·', ...a)
const errores = []

const logcat = () => execFileSync(ADB, ['logcat', '-d', '-s', 'TRIVIA_E2E'], { encoding: 'utf8', env })
async function esperarLog(patron, ms = 240_000) {
  const fin = Date.now() + ms
  while (Date.now() < fin) {
    const m = logcat().match(patron)
    if (m) return m
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('No apareció en logcat: ' + patron)
}

execFileSync(ADB, ['logcat', '-c'], { env })
const instr = spawn(ADB, ['shell', 'am', 'instrument', '-w', '-e', 'esperarWeb', 'true', '-e', 'class',
  'com.triviadeldestino.app.FirebaseIntegracionTest', 'com.triviadeldestino.app.test/androidx.test.runner.AndroidJUnitRunner'], { env })
let salidaInstr = ''
instr.stdout.on('data', (d) => (salidaInstr += d))

const [, code, clave] = await esperarLog(/CODIGO=(\w{5}) CLAVE=(\w{8})/)
log(`Android creó el grupo ${code} (clave ${clave})`)

const browser = await chromium.launch({ channel: 'chrome' })
async function nuevo(nombre, viewport) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && errores.push(`[${nombre}] ${m.text()}`))
  page.on('pageerror', (e) => errores.push(`[${nombre}] ${e.message}`))
  return page
}
const correcta = async (p) => {
  const t = (await p.locator('main h2').filter({ hasText: '?' }).first().textContent()).trim()
  return PREG.find((q) => q.pregunta.trim() === t).respuestaCorrecta
}
const puntosDe = async (p, apodo) => {
  const fila = p.locator('li', { hasText: apodo }).first()
  return Number((await fila.textContent()).match(/(-?\d+)\s*pts/)[1])
}

const beto = await nuevo('Beto web', { width: 390, height: 844 })
const dani = await nuevo('Dani PC', { width: 1600, height: 900 })
try {
  // Jugador web entra por el enlace de invitación
  await beto.goto(`${BASE}/unirse/${code}`)
  await beto.getByLabel('Tu apodo').fill('Beto Web')
  await beto.getByRole('button', { name: 'Entrar' }).click()
  await beto.getByRole('button', { name: 'Unirme' }).click()
  await beto.getByText('Andrea Android').first().waitFor({ timeout: 15000 })
  log(`La web ve a Andrea Android con ${await puntosDe(beto, 'Andrea Android')} pts`)
  await esperarLog(/WEB_UNIDO=Beto Web/)
  log('Android ve que Beto Web se unió')

  // Organizadora en la PC: administra con la clave, sin jugar
  await dani.goto(BASE)
  await dani.getByLabel('Tu apodo').fill('Dani PC')
  await dani.getByRole('button', { name: 'Entrar' }).click()
  await dani.getByText('¿Organizas un grupo que se creó en otro dispositivo?').click()
  await dani.getByLabel('Código del grupo').nth(1).fill(code)
  await dani.getByLabel('Clave de administración').fill(clave)
  await dani.getByRole('button', { name: 'Administrar' }).click()
  await dani.getByText('Organizas este grupo').waitFor({ timeout: 15000 })
  log('Dani administra desde la web con la clave (sin jugar):', await dani.getByRole('link', { name: 'Admin' }).isVisible())

  // Beto juega su primera carta
  await beto.getByRole('button', { name: 'Revelar mi destino' }).click()
  await beto.getByRole('button', { name: 'Ver la pregunta' }).click({ timeout: 15000 })
  await beto.getByRole('timer').waitFor({ timeout: 15000 })
  await beto.keyboard.press(String((await correcta(beto)) + 1))
  await beto.getByRole('heading', { name: '¡El destino te sonríe!' }).waitFor({ timeout: 10000 })
  const [, clasifAndroid] = await esperarLog(/ANDROID_VE_CLASIFICACION=(.*)/)
  log('Android ve la jugada de Beto:', clasifAndroid.trim())

  // Android reta a Beto: la Carta de Reto llega a la web; Beto falla a propósito
  await esperarLog(/RETO_ENVIADO/)
  await beto.goto(`${BASE}/`)
  const aviso = beto.getByRole('link', { name: /Andrea Android te lanzó un reto/ })
  await aviso.waitFor({ timeout: 15000 })
  log('La web recibe el reto de Android')
  await aviso.click()
  await beto.getByRole('button', { name: 'Aceptar el reto' }).click()
  await beto.getByRole('timer').waitFor({ timeout: 15000 })
  await beto.keyboard.press(String(((await correcta(beto)) + 1) % 4 + 1))
  await beto.getByRole('heading', { name: 'El reto te venció' }).waitFor({ timeout: 10000 })

  // Misma clasificación en Android y en la web
  const [, finalAndroid] = await esperarLog(/CLASIFICACION_FINAL=(.*)/)
  await beto.goto(`${BASE}/clasificacion`)
  await beto.getByText('Andrea Android').first().waitFor()
  await beto.waitForTimeout(1500)
  const web = `Andrea Android:${await puntosDe(beto, 'Andrea Android')}, Beto Web:${await puntosDe(beto, 'Beto Web')}`
  log('Clasificación en Android:', finalAndroid.trim())
  log('Clasificación en la web: ', web)
  const norm = (s) => s.split(',').map((x) => x.trim()).sort().join(', ')
  log('¿Coinciden?', norm(finalAndroid) === norm(web) ? 'SÍ' : 'NO')

  // La presentación de la organizadora muestra a ambos
  await dani.goto(`${BASE}/presentacion`)
  await dani.getByText('Clasificación en vivo').first().waitFor()
  await dani.waitForTimeout(2000)
  await dani.screenshot({ path: `${OUT}/presentacion-android-web.png` })
} finally {
  await new Promise((r) => instr.on('close', r))
  console.log('\nResultado de la prueba instrumentada:\n' + salidaInstr.trim().split('\n').slice(-4).join('\n'))
  console.log('\nLogcat Android:\n' + logcat().split('\n').filter((l) => l.includes('TRIVIA_E2E')).map((l) => '  ' + l.replace(/^.*TRIVIA_E2E: /, '')).join('\n'))
  for (const p of [beto, dani]) await p.evaluate(async () => (await import('/tests/smoke/helpers.ts')).deleteMe()).catch(() => {})
  await browser.close()
  console.log(errores.length ? 'ERRORES WEB: ' + errores.join(' | ') : 'SIN ERRORES EN LA CONSOLA WEB')
}
