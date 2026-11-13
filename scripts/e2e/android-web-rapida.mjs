/** Lado web de RapidaCruzadaUiTest: Beto juega en la sala de Android; luego Ana crea una sala «Solo pantalla». */
// Uso (con el emulador encendido, la app y su APK de pruebas instaladas, y `npm run dev` corriendo):
//   node scripts/e2e/android-web-rapida.mjs [carpeta-capturas]
import { chromium } from 'playwright-core'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = process.argv[2] ?? 'capturas-e2e/android-rapida'
mkdirSync(OUT, { recursive: true })
const PREG = JSON.parse(readFileSync('src/data/questions.json', 'utf8'))
const ADB = `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`
const env = { ...process.env, MSYS_NO_PATHCONV: '1' }
const log = (...a) => console.log('·', ...a)
const errores = []
const ok = (cond, msg) => {
  if (!cond) throw new Error('FALLO: ' + msg)
  log('OK', msg)
}
const logcat = () => execFileSync(ADB, ['logcat', '-d', '-s', 'TRIVIA_E2E'], { encoding: 'utf8', env, maxBuffer: 1 << 26 })
async function esperarLog(patron, ms = 300_000) {
  const fin = Date.now() + ms
  while (Date.now() < fin) {
    const m = logcat().match(patron)
    if (m) return m
    if (instrTermino) throw new Error('La prueba de Android terminó antes de: ' + patron + '\n' + salida)
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('No apareció en logcat: ' + patron)
}

execFileSync(ADB, ['logcat', '-c'], { env })
const instr = spawn(ADB, ['shell', 'am', 'instrument', '-w', '-e', 'esperarWeb', 'true', '-e', 'class',
  'com.triviadeldestino.app.RapidaCruzadaUiTest', 'com.triviadeldestino.app.test/androidx.test.runner.AndroidJUnitRunner'], { env })
let salida = ''
let instrTermino = false
instr.stdout.on('data', (d) => {
  salida += d
  if (/FAILURES!!!|OK \(1 test\)/.test(salida)) instrTermino = true
})
instr.on('exit', () => (instrTermino = true))

const browser = await chromium.launch({ channel: 'chrome' })
const nueva = async (nombre, viewport) => {
  const p = await (await browser.newContext({ viewport })).newPage()
  p.on('console', (m) => m.type() === 'error' && !/permission/i.test(m.text()) && errores.push(`[${nombre}] ${m.text()}`))
  p.on('pageerror', (e) => errores.push(`[${nombre}] ${e.message}`))
  return p
}
let n = 0
const shot = (p, nombre, full = false) => p.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${nombre}.png`, fullPage: full })

const FIN = /¡Se acabó tu tiempo!|^¡Gana|^Empate|^Partida terminada|Volviste a la sala/
async function jugar(page, acertar) {
  const ids = []
  let bien = 0
  const h = page.locator('section[aria-label^="Pregunta"] h2')
  for (;;) {
    if (await page.getByRole('heading', { name: FIN }).first().isVisible().catch(() => false)) break
    if (!(await h.isVisible().catch(() => false))) {
      await page.waitForTimeout(100)
      continue
    }
    const texto = (await h.textContent({ timeout: 1000 }).catch(() => null))?.trim()
    if (!texto) continue
    const q = PREG.find((p) => p.pregunta.trim() === texto)
    if (ids.at(-1) === q.id) {
      await page.waitForTimeout(50)
      continue
    }
    const si = acertar(ids.length)
    ids.push(q.id)
    if (si) bien++
    await page.keyboard.press(String((si ? q.respuestaCorrecta : (q.respuestaCorrecta + 1) % 4) + 1))
  }
  return { ids }
}

/** Tabla de resultados de la web en el mismo formato que el log de Android. */
async function tabla(page) {
  await page.getByRole('table').waitFor({ timeout: 30000 })
  await page.waitForTimeout(1500)
  const filas = await page.locator('tbody tr').all()
  const out = []
  for (const f of filas) {
    const celdas = await f.locator('td').allTextContents()
    out.push(`${celdas[1].replace(' · bot', '').trim()}:${celdas[2].trim()}:${celdas[3].trim()}`)
  }
  return out.join('|')
}

const senal = (marca) =>
  execFileSync(ADB, ['shell', `echo ${marca} >> /sdcard/Android/data/com.triviadeldestino.app/files/rapida_senales.txt`], { env })

const prefijo = (a, b) => {
  const k = Math.min(a.length, b.length)
  return a.slice(0, k).join() === b.slice(0, k).join()
}

try {
  // ---- A) sala de Android ----
  const [, code] = await esperarLog(/RAPIDA_CODIGO=(\w{5})/)
  log(`Andrea (Android) creó la sala ${code}`)
  const beto = await nueva('Beto', { width: 390, height: 844 })
  const pc = await nueva('PC', { width: 1600, height: 900 })
  await pc.goto(`${BASE}/sala/${code}/pantalla`)
  await beto.goto(`${BASE}/rapida/${code}`)
  await beto.getByLabel('Tu apodo').fill('Beto Web')
  await beto.getByRole('button', { name: 'Entrar' }).click()
  await beto.getByText('Estás dentro.').waitFor({ timeout: 20000 })
  await pc.getByText(/jugadores en la sala|¡A jugar!/).first().waitFor({ timeout: 20000 })
  await shot(pc, 'pc-lobby-sala-android')
  const rb = await jugar(beto, (i) => i % 3 === 0)
  await shot(beto, 'beto-fin')
  const [, c1, f1, ids1] = await esperarLog(/ANDROID_FIN c=(\d+) f=(\d+) ids=([\w,-]+)/)
  ok(prefijo(rb.ids, ids1.split(',')), `Android y web ven las mismas preguntas (Android ${ids1.split(',').length}, web ${rb.ids.length})`)
  await pc.getByRole('list', { name: 'Aciertos en vivo' }).or(pc.getByRole('list', { name: 'Podio' })).first().waitFor({ timeout: 20000 })
  await shot(pc, 'pc-en-vivo')
  const [, rankingA] = await esperarLog(/ANDROID_RANKING=(.+)/)
  const tablaWeb = await tabla(beto)
  log('Android:', rankingA.trim())
  log('Web:    ', tablaWeb)
  ok(rankingA.trim() === tablaWeb, 'mismo ranking en Android y en la web')
  ok(tablaWeb.includes(`Andrea Android:${c1}:${f1}`), 'los contadores de Andrea en la web son los de su pantalla')
  await pc.getByRole('list', { name: 'Podio' }).waitFor({ timeout: 20000 })
  await shot(pc, 'pc-podio')
  senal('RONDA1_OK')

  // Revancha
  await esperarLog(/ANDROID_REVANCHA/)
  // Android inicia enseguida: puede que Beto ya esté en la cuenta atrás.
  await beto.getByText('Estás dentro.').or(beto.getByText('La partida empieza en')).or(beto.locator('section[aria-label^="Pregunta"]')).first().waitFor({ timeout: 20000 })
  const rb2 = await jugar(beto, () => false)
  const [, , , ids2] = await esperarLog(/ANDROID_FIN2 c=(\d+) f=(\d+) ids=([\w,-]+)/)
  ok(prefijo(rb2.ids, ids2.split(',')), 'revancha: mismas preguntas en las dos plataformas')
  ok(!rb2.ids.slice(0, 5).some((id) => rb.ids.includes(id) || ids1.split(',').includes(id)), 'la revancha empieza con preguntas nuevas')
  const [, rankingA2] = await esperarLog(/ANDROID_RANKING2=(.+)/)
  ok(rankingA2.trim() === (await tabla(beto)), 'ranking de la revancha igual en Android y en la web')
  senal('RONDA2_OK')
  await esperarLog(/ANDROID_CERRADA/)
  await beto.getByRole('heading', { name: 'La sala se cerró' }).waitFor({ timeout: 20000 })
  ok(true, 'al cerrar la sala en Android, la web lo ve')

  // ---- B) sala de la web («Solo pantalla») ----
  const ana = await nueva('Ana', { width: 1440, height: 900 })
  await ana.goto(`${BASE}/rapida`)
  await ana.getByLabel('Tu apodo').fill('Ana Web')
  await ana.getByRole('button', { name: 'Entrar' }).click()
  await ana.getByText('Solo pantalla').click()
  await ana.getByRole('button', { name: 'Crear sala' }).click()
  await ana.waitForURL(/\/rapida\/[A-Z2-9]{5}$/, { timeout: 20000 })
  const code2 = ana.url().split('/').at(-1)
  await ana.getByRole('button', { name: /Añadir bot/ }).click()
  await ana.getByText('1 jugador en la sala').waitFor({ timeout: 15000 })
  execFileSync(ADB, ['shell', `echo ${code2} > /sdcard/Android/data/com.triviadeldestino.app/files/rapida_code.txt`], { env })
  log(`Ana (web) creó la sala ${code2} en «Solo pantalla»`)
  await esperarLog(/ANDROID_DENTRO/)
  await ana.getByText('2 jugadores en la sala').waitFor({ timeout: 20000 })
  await shot(ana, 'ana-lobby-con-android')
  await ana.getByRole('button', { name: 'Iniciar' }).click()
  await esperarLog(/ANDROID_FIN3/)
  await ana.getByRole('button', { name: 'Terminar ahora' }).click()
  await ana.getByRole('list', { name: 'Podio' }).waitFor({ timeout: 20000 })
  await ana.waitForTimeout(1500)
  await shot(ana, 'ana-podio')
  const [, rankingA3] = await esperarLog(/ANDROID_RANKING3=(.+)/)
  ok(rankingA3.trim() === (await tabla(ana)), 'ranking igual en la sala de la web (con bot de la web)')
  await ana.getByRole('button', { name: 'Cerrar sala' }).click()
  await ana.getByRole('dialog').getByRole('button', { name: 'Cerrar sala' }).click()
  await esperarLog(/ANDROID_TODO_OK/)
  for (let i = 0; i < 120 && !instrTermino; i++) await new Promise((r) => setTimeout(r, 500))
  ok(/OK \(1 test\)/.test(salida), 'la prueba de Android terminó bien')
  ok(errores.length === 0, `sin errores en consola${errores.length ? ': ' + errores.join(' | ') : ''}`)
  log('TODO OK')
} catch (e) {
  console.error(e)
  console.error(salida)
  process.exitCode = 1
} finally {
  await browser.close()
  instr.kill()
}
