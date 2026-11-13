/**
 * Prueba de punta a punta de la Partida Rápida en la web, contra el emulador local de Firebase.
 * Ana (PC, sin grupo) crea la sala; Beto entra por el enlace y Caro con el código; Dani proyecta
 * la sala en otra PC. Ronda 1 con bots y «Terminar ahora»; revancha sin bots que termina sola
 * (Caro recarga a mitad); alguien que llega tarde no puede entrar; al final se cierra la sala.
 *
 * Uso (desde la raíz del repositorio, con Java en el PATH):
 *   npx firebase emulators:start --only firestore,auth --project trivia-59073
 *   VITE_FIREBASE_EMULATOR=true npx vite --port 5175
 *   node scripts/e2e/web-rapida.mjs [carpeta-capturas]
 */
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5175'
const OUT = process.argv[2] ?? 'capturas-e2e/rapida'
mkdirSync(OUT, { recursive: true })
const PREGUNTAS = JSON.parse(readFileSync('src/data/questions.json', 'utf8'))
const EMU = 'http://127.0.0.1:8080/v1/projects/trivia-59073/databases/(default)/documents'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errores = []
const log = (...a) => console.log('·', ...a)
let n = 0
const shot = (p, name, full = false) => p.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full })
const ok = (cond, msg) => {
  if (!cond) throw new Error('FALLO: ' + msg)
  log('OK', msg)
}

async function nuevo(nombre, viewport, extra = {}) {
  const ctx = await browser.newContext({ viewport, ...extra })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' && !/permission|PERMISSION_DENIED/.test(m.text())) errores.push(`[${nombre}] ${m.text()}`)
  })
  page.on('pageerror', (e) => errores.push(`[${nombre}] pageerror: ${e.message}`))
  return { ctx, page }
}

async function perfil(page, apodo) {
  await page.getByLabel('Tu apodo').fill(apodo)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

async function docs(ruta) {
  const r = await fetch(`${EMU}/${ruta}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } })
  return (await r.json()).documents ?? []
}
async function documento(ruta) {
  const r = await fetch(`${EMU}/${ruta}`, { headers: { Authorization: 'Bearer owner' } })
  return r.ok ? (await r.json()).fields : null
}
const entero = (f) => Number(f?.integerValue ?? f?.doubleValue ?? NaN)

const FIN = /¡Se acabó tu tiempo!|^¡Gana|^Empate|^Partida terminada|Volviste a la sala/

/** Juega hasta que se acaba su reloj; `acertar(i)` decide cada respuesta. Devuelve [aciertos, fallos, vistas]. */
async function jugar(page, acertar, { parar } = {}) {
  let i = 0
  let bien = 0
  const vistas = []
  const h = page.locator('section[aria-label^="Pregunta"] h2')
  for (;;) {
    if (await page.getByRole('heading', { name: FIN }).first().isVisible().catch(() => false)) break
    if (parar && i >= parar) break
    if (!(await h.isVisible().catch(() => false))) {
      await page.waitForTimeout(100)
      continue
    }
    const texto = (await h.textContent()).trim()
    const q = PREGUNTAS.find((p) => p.pregunta.trim() === texto)
    if (!q) throw new Error('Pregunta no encontrada: ' + texto)
    if (vistas.at(-1) === q.id) {
      await page.waitForTimeout(50)
      continue
    }
    vistas.push(q.id)
    const si = acertar(i)
    await page.keyboard.press(String((si ? q.respuestaCorrecta : (q.respuestaCorrecta + 1) % 4) + 1))
    if (si) bien++
    i++
    await page
      .waitForFunction((t) => document.querySelector('section[aria-label^="Pregunta"] h2')?.textContent.trim() !== t, texto, { timeout: 3000 })
      .catch(() => {})
  }
  return [bien, i - bien, vistas]
}

const A = await nuevo('Ana', { width: 1440, height: 900 })
const B = await nuevo('Beto', { width: 390, height: 844 }, { hasTouch: true, isMobile: true })
const C = await nuevo('Caro', { width: 390, height: 844 }, { hasTouch: true, isMobile: true })
const D = await nuevo('Dani', { width: 1920, height: 1080 })

try {
  // ---- crear sala sin grupo ----
  await A.page.goto(`${BASE}/`, { waitUntil: 'load' })
  await perfil(A.page, 'Ana')
  await A.page.getByRole('heading', { name: 'Partida Rápida' }).waitFor({ timeout: 15000 })
  await shot(A.page, 'inicio-sin-grupo')
  await A.page.getByRole('link', { name: 'Crear sala o unirme' }).click()
  await A.page.getByRole('button', { name: 'Crear sala' }).waitFor()
  await shot(A.page, 'menu')
  await A.page.getByRole('button', { name: 'Crear sala' }).click()
  await A.page.waitForURL(/\/rapida\/[A-Z2-9]{5}$/, { timeout: 15000 })
  const code = A.page.url().split('/').at(-1)
  log('Sala', code)
  ok((await docs('groups')).length === 0, 'crear la sala no toca groups/')

  // ---- entrar por enlace (Beto) y por código (Caro) ----
  await B.page.goto(`${BASE}/rapida/${code}`, { waitUntil: 'load' })
  await perfil(B.page, 'Beto')
  await B.page.getByText('Estás dentro.').waitFor({ timeout: 15000 })
  await C.page.goto(`${BASE}/rapida`, { waitUntil: 'load' })
  await perfil(C.page, 'Caro')
  await C.page.getByLabel('Código de la sala').fill(code.toLowerCase())
  await C.page.getByRole('button', { name: 'Unirme' }).click()
  await C.page.getByText('Estás dentro.').waitFor({ timeout: 15000 })
  await A.page.getByRole('list', { name: 'Jugadores en la sala' }).getByText('Caro').waitFor({ timeout: 10000 })
  ok(true, 'Ana ve entrar a Beto y Caro en tiempo real')

  // ---- pantalla de sala en otra PC ----
  await D.page.goto(`${BASE}/sala/${code}/pantalla`, { waitUntil: 'load' })
  await D.page.getByText('3 jugadores en la sala').waitFor({ timeout: 15000 })
  await A.page.getByRole('button', { name: /Añadir bot/ }).click()
  await A.page.getByRole('button', { name: 'Añadir bot (1/6)' }).click()
  await D.page.getByText('5 jugadores en la sala').waitFor({ timeout: 10000 })
  await shot(D.page, 'pc-lobby')
  await shot(A.page, 'lobby-anfitrion')
  await shot(B.page, 'lobby-movil')

  // ---- ronda 1 ----
  await A.page.getByRole('button', { name: 'Iniciar' }).click()
  await B.page.getByText('La partida empieza en', { exact: false }).waitFor({ timeout: 10000 })
  await shot(B.page, 'cuenta-atras')
  const [ra, rb, rc] = await Promise.all([
    jugar(A.page, (i) => i < 3),
    jugar(B.page, (i) => i % 3 === 0),
    (async () => {
      const r = await jugar(C.page, (i) => i === 0, { parar: 2 })
      await shot(C.page, 'juego-movil')
      const resto = await jugar(C.page, () => false)
      return [r[0] + resto[0], r[1] + resto[1], [...r[2], ...resto[2]]]
    })(),
  ])
  log('Ronda 1 — Ana', ra.slice(0, 2), 'Beto', rb.slice(0, 2), 'Caro', rc.slice(0, 2))
  ok(ra[2].join() === rb[2].slice(0, ra[2].length).join() || rb[2].join() === ra[2].slice(0, rb[2].length).join(), 'Ana y Beto ven las mismas preguntas en el mismo orden')
  ok(rc[2].join() === ra[2].slice(0, rc[2].length).join() || ra[2].join() === rc[2].slice(0, ra[2].length).join(), 'Caro también')
  await B.page.getByText(/siguen? jugando/).waitFor({ timeout: 10000 })
  await shot(B.page, 'espera')
  await D.page.getByRole('list', { name: 'Aciertos en vivo' }).waitFor({ timeout: 10000 })
  await shot(D.page, 'pc-en-vivo')
  for (const [quien, p, r] of [['Ana', A.page, ra], ['Beto', B.page, rb], ['Caro', C.page, rc]]) {
    // Lo que muestra su pantalla al terminar ("3 aciertos · 22 fallos").
    const texto = await p.getByText(/\d+ aciertos? · \d+ fallos?/).textContent()
    const [bien, mal] = texto.match(/\d+/g).map(Number)
    // La última pulsación puede llegar con el reloj ya en 0: esa no cuenta.
    ok(bien + mal === r[0] + r[1] || bien + mal === r[0] + r[1] - 1, `${quien}: la pantalla cuenta lo respondido a tiempo (${bien}/${mal})`)
    await p.waitForTimeout(500)
    const d = (await docs(`quickRooms/${code}/players`)).find((x) => x.fields.apodo.stringValue === quien)
    ok(entero(d.fields.correctas) === bien && entero(d.fields.falladas) === mal && d.fields.finished.booleanValue, `${quien}: contadores en Firestore = los de su pantalla`)
  }
  await A.page.getByRole('button', { name: 'Terminar ahora' }).click()
  for (const p of [A.page, B.page, C.page]) await p.getByRole('table').waitFor({ timeout: 15000 })
  await D.page.getByRole('list', { name: 'Podio' }).waitFor({ timeout: 10000 })
  await A.page.waitForTimeout(1500)
  await shot(A.page, 'resultados-pc', true)
  await shot(B.page, 'resultados-movil', true)
  await shot(D.page, 'pc-podio')
  const ganador = (await A.page.getByRole('heading', { level: 1 }).textContent()).trim()
  log(ganador)
  ok((await B.page.getByText('Tu partida:').count()) === 1, 'resumen personal con sus preguntas')
  ok((await B.page.getByText('Correcta:').count()) === rb[2].length, 'el resumen muestra cada pregunta vista')

  // ---- alguien llega tarde: no puede entrar ----
  // (se prueba al empezar la revancha)

  // ---- revancha sin bots: termina sola cuando todos terminan; Caro recarga a mitad ----
  const seed1 = entero((await documento(`quickRooms/${code}`)).seed)
  await A.page.getByRole('button', { name: 'Revancha' }).click()
  await B.page.getByText('Estás dentro.').waitFor({ timeout: 15000 })
  await C.page.getByText('Estás dentro.').waitFor({ timeout: 15000 })
  const sala2 = await documento(`quickRooms/${code}`)
  ok(entero(sala2.round) === 2 && entero(sala2.seed) !== seed1, 'revancha: ronda 2 con semilla nueva')
  const evitar = (sala2.evitar.arrayValue.values ?? []).map((v) => v.stringValue)
  ok(evitar.length >= Math.max(ra[2].length, rb[2].length), `evita las ${evitar.length} preguntas de la ronda anterior`)
  for (const nombre of ['Oráculo Ónix', 'Luna Errante']) await A.page.getByRole('button', { name: `Sacar a ${nombre}` }).click()
  await D.page.getByText('3 jugadores en la sala').waitFor({ timeout: 10000 })
  await A.page.getByRole('button', { name: 'Iniciar' }).click()

  const E = await nuevo('Eva', { width: 390, height: 844 })
  await E.page.goto(`${BASE}/rapida/${code}`, { waitUntil: 'load' })
  await perfil(E.page, 'Eva')
  await E.page.getByText('La partida ya empezó').waitFor({ timeout: 15000 })
  ok(true, 'quien llega con la partida empezada no puede entrar')

  const [r2a, r2b, r2c] = await Promise.all([
    jugar(A.page, (i) => i % 3 === 0),
    jugar(B.page, () => false),
    (async () => {
      const r = await jugar(C.page, () => true, { parar: 3 })
      await C.page.reload({ waitUntil: 'load' })
      await C.page.getByRole('heading', { name: 'Volviste a la sala' }).waitFor({ timeout: 15000 })
      await shot(C.page, 'recarga')
      return r
    })(),
  ])
  log('Ronda 2 — Ana', r2a.slice(0, 2), 'Beto', r2b.slice(0, 2), 'Caro', r2c.slice(0, 2))
  // Solo hay 30 hard: tras una ronda larga se repiten por fuerza; las normales no.
  const normales = r2a[2].slice(0, 20).filter((id) => PREGUNTAS.find((q) => q.id === id).nivel === 'normal')
  const hardLibres = PREGUNTAS.filter((q) => q.nivel === 'hard' && !evitar.includes(q.id)).length
  ok(normales.every((id) => !evitar.includes(id)), `la revancha no repite normales de la ronda 1 (quedaban ${hardLibres} hard sin usar)`)
  for (const p of [A.page, B.page, C.page]) await p.getByRole('table').waitFor({ timeout: 20000 })
  ok((await documento(`quickRooms/${code}`)).status.stringValue === 'finished', 'la sala termina sola cuando todos terminaron')
  const caro = (await docs(`quickRooms/${code}/players`)).find((d) => d.fields.apodo.stringValue === 'Caro')
  ok(caro.fields.finished.booleanValue && entero(caro.fields.round) === 2, 'Caro, que recargó, quedó terminada')
  await shot(A.page, 'resultados-ronda-2', true)

  // ---- cerrar la sala ----
  await A.page.getByRole('button', { name: 'Cerrar sala' }).click()
  await A.page.getByRole('dialog').getByRole('button', { name: 'Cerrar sala' }).click()
  await B.page.getByRole('heading', { name: 'La sala se cerró' }).waitFor({ timeout: 15000 })
  await D.page.getByRole('heading', { name: 'La sala se cerró' }).waitFor({ timeout: 15000 })
  ok((await documento(`quickRooms/${code}`)) === null && (await docs(`quickRooms/${code}/players`)).length === 0, 'cerrar borra la sala y sus jugadores')
  ok((await docs('groups')).length === 0, 'nada en groups/')

  // ---- Solo pantalla ----
  await A.page.goto(`${BASE}/rapida`, { waitUntil: 'load' })
  await A.page.getByText('Solo pantalla').click()
  await A.page.getByRole('button', { name: 'Crear sala' }).click()
  await A.page.waitForURL(/\/rapida\/[A-Z2-9]{5}$/, { timeout: 15000 })
  const code2 = A.page.url().split('/').at(-1)
  await A.page.getByText('Esperando jugadores…').waitFor({ timeout: 10000 })
  ok((await docs(`quickRooms/${code2}/players`)).length === 0, '«Solo pantalla»: el anfitrión no juega')
  await B.page.goto(`${BASE}/rapida/${code2}`, { waitUntil: 'load' })
  await B.page.getByText('Estás dentro.').waitFor({ timeout: 15000 })
  await A.page.getByText('1 jugador en la sala').waitFor({ timeout: 10000 })
  await A.page.getByRole('button', { name: 'Iniciar' }).click()
  await jugar(B.page, () => false)
  await A.page.getByRole('list', { name: 'Podio' }).waitFor({ timeout: 15000 })
  await shot(A.page, 'solo-pantalla-podio')
  await A.page.getByRole('button', { name: 'Cerrar sala' }).click()
  await A.page.getByRole('dialog').getByRole('button', { name: 'Cerrar sala' }).click()
  await A.page.waitForURL(/\/rapida$/, { timeout: 10000 })

  ok(errores.length === 0, `sin errores en consola${errores.length ? ': ' + errores.join(' | ') : ''}`)
  log('TODO OK')
} catch (e) {
  console.error(e)
  for (const [nombre, x] of [['ana', A], ['beto', B], ['caro', C], ['dani', D]]) await shot(x.page, `error-${nombre}`, true).catch(() => {})
  console.error('Errores de consola:', errores)
  process.exitCode = 1
} finally {
  await browser.close()
}
