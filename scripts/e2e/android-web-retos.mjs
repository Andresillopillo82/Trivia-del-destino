/** Lado web de RetosCruzadosUiTest: Beto juega y reta; Dani co-administra y salta al final. */
// Uso (con el emulador encendido, la app y su APK de pruebas instaladas, y `npm run dev` corriendo):
//   node scripts/e2e/android-web-retos.mjs [carpeta-capturas]
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
async function esperarLog(patron, ms = 300_000) {
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
  'com.triviadeldestino.app.RetosCruzadosUiTest', 'com.triviadeldestino.app.test/androidx.test.runner.AndroidJUnitRunner'], { env })
let salida = ''
instr.stdout.on('data', (d) => (salida += d))

const [, code, clave] = await esperarLog(/CODIGO=(\w{5}) CLAVE=(\w{8})/)
log(`Andrea (Android) creó ${code} desde la interfaz`)

const browser = await chromium.launch({ channel: 'chrome' })
const nueva = async (nombre, viewport) => {
  const p = await (await browser.newContext({ viewport })).newPage()
  p.on('console', (m) => m.type() === 'error' && errores.push(`[${nombre}] ${m.text()}`))
  p.on('pageerror', (e) => errores.push(`[${nombre}] ${e.message}`))
  return p
}
/** Saca la siguiente carta (o la revela), ve la pregunta y la responde (bien o mal). */
const jugarCarta = async (p, boton, acertar = true) => {
  await p.getByRole('button', { name: boton }).click()
  await p.getByRole('button', { name: 'Ver la pregunta' }).click({ timeout: 15000 })
  await p.getByRole('timer').waitFor({ timeout: 15000 })
  const idx = await correcta(p)
  await p.keyboard.press(String((acertar ? idx : (idx + 1) % 4) + 1))
}
const correcta = async (p) => {
  const t = (await p.locator('main h2').filter({ hasText: '?' }).first().textContent()).trim()
  return PREG.find((q) => q.pregunta.trim() === t).respuestaCorrecta
}
const beto = await nueva('Beto', { width: 390, height: 844 })
const dani = await nueva('Dani', { width: 1440, height: 900 })
try {
  await beto.goto(`${BASE}/unirse/${code}`)
  await beto.getByLabel('Tu apodo').fill('Beto Web')
  await beto.getByRole('button', { name: 'Entrar' }).click()
  await beto.getByRole('button', { name: 'Unirme' }).click()
  await beto.getByRole('heading', { name: /Día 1 de 7/ }).waitFor({ timeout: 15000 })
  await dani.goto(BASE)
  await dani.getByLabel('Tu apodo').fill('Dani PC')
  await dani.getByRole('button', { name: 'Entrar' }).click()
  await dani.getByText('¿Organizas un grupo que se creó en otro dispositivo?').click()
  await dani.getByLabel('Código del grupo').nth(1).fill(code)
  await dani.getByLabel('Clave de administración').fill(clave)
  await dani.getByRole('button', { name: 'Administrar' }).click()
  await dani.getByText('Organizas este grupo').waitFor({ timeout: 15000 })
  log('Beto se unió y Dani administra con la clave')

  // El reto de Andrea llega a la web y es obligatorio antes de la siguiente carta: Beto lo responde (y falla)
  await esperarLog(/ANDROID_RETO_ENVIADO/)
  await beto.goto(`${BASE}/`)
  const aviso = beto.getByRole('link', { name: /Andrea Android te lanzó un reto/ })
  await aviso.waitFor({ timeout: 20000 })
  log('La web bloquea la carta hasta responder el reto:', await beto.getByText('Responde tu reto pendiente').isVisible())
  await aviso.click()
  await beto.getByRole('button', { name: 'Aceptar el reto' }).click()
  await beto.getByRole('timer').waitFor({ timeout: 15000 })
  await beto.keyboard.press(String(((await correcta(beto)) + 1) % 4 + 1))
  await beto.getByRole('heading', { name: 'El reto te venció' }).waitFor({ timeout: 10000 })
  log('Beto respondió (y falló) el reto de Andrea: −5 para Beto, +10 para Andrea')

  // Beto juega 2 cartas (2 aciertos) y reta a Andrea
  await beto.goto(`${BASE}/`)
  await jugarCarta(beto, 'Revelar mi destino')
  await beto.getByRole('heading', { name: '¡El destino te sonríe!' }).waitFor({ timeout: 10000 })
  await jugarCarta(beto, 'Siguiente carta (2 de 3)')
  await beto.getByRole('link', { name: 'Lanzar un reto' }).click()
  await beto.getByRole('radio', { name: /^Andrea Android/ }).click()
  await beto.getByRole('button', { name: /^Retar a/ }).click()
  await beto.getByRole('heading', { name: /Reto lanzado a/ }).waitFor({ timeout: 15000 })
  log('Beto retó a Andrea')

  // Andrea lo devuelve desde Android: si sale bien, Beto debe responderlo aquí
  const [, exito] = await esperarLog(/ANDROID_DEVOLVIO exito=(true|false)/)
  log(`Andrea devolvió el reto desde Android: ${exito === 'true' ? 'salió bien' : 'salió mal (doble reto en Android)'}`)
  if (exito === 'true') {
    await beto.goto(`${BASE}/`)
    const devuelto = beto.getByRole('link', { name: /Andrea Android te devolvió tu reto/ })
    await devuelto.waitFor({ timeout: 20000 })
    await devuelto.click()
    await beto.getByRole('button', { name: 'Ver la pregunta' }).click()
    await beto.getByRole('timer').waitFor({ timeout: 15000 })
    await beto.keyboard.press(String((await correcta(beto)) + 1))
    await beto.getByText('Te salvaste: no pierdes nada.').waitFor({ timeout: 10000 })
    log('Beto respondió bien el reto que le devolvieron (0 puntos)')
  }

  // Cuando Andrea responde el suyo, Dani salta al final
  await esperarLog(/ANDROID_RETO_RESPONDIDO/)
  await dani.getByRole('link', { name: 'Admin' }).click()
  await dani.getByRole('button', { name: 'Saltar al final de la semana' }).click()
  await dani.getByRole('button', { name: 'Saltar al final', exact: true }).click()
  log('Dani saltó al final de la semana')

  const [, android] = await esperarLog(/CLASIFICACION_ANDROID=(.*)/)
  await beto.goto(`${BASE}/clasificacion`)
  await beto.getByText('Andrea Android').first().waitFor()
  await beto.waitForTimeout(1500)
  const pts = async (n) => Number((await beto.locator('li', { hasText: n }).first().textContent()).match(/(-?\d+)\s*pts/)[1])
  const web = `Andrea Android:${await pts('Andrea Android')}, Beto Web:${await pts('Beto Web')}`
  const norm = (s) => s.split(',').map((x) => x.trim()).sort().join(', ')
  log('Clasificación Android:', android.trim())
  log('Clasificación web:    ', web)
  log('¿Coinciden?', norm(android) === norm(web) ? 'SÍ' : 'NO')
  await dani.goto(`${BASE}/presentacion`)
  await dani.waitForTimeout(4000)
  await dani.screenshot({ path: `${OUT}/presentacion-ceremonia.png` })
} finally {
  await new Promise((r) => instr.on('close', r))
  console.log('\nPrueba instrumentada:\n' + salida.trim().split('\n').slice(-4).join('\n'))
  for (const p of [beto, dani]) await p.evaluate(async () => (await import('/tests/smoke/helpers.ts')).deleteMe()).catch(() => {})
  await browser.close()
  console.log(errores.length ? 'ERRORES WEB: ' + errores.join(' | ') : 'SIN ERRORES EN LA CONSOLA WEB')
}
