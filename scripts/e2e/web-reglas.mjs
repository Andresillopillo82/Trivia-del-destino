/**
 * Prueba de punta a punta de las reglas del juego en la web, contra el emulador local de Firebase.
 * Ana (PC, admin) juega sus 3 cartas con comodín y reta a Beto (móvil); Beto devuelve el reto;
 * se sigue la rama que decida la hora del servidor. Al final, bots, cambio de día y ceremonia.
 *
 * Uso (desde la raíz del repositorio, con Java en el PATH):
 *   npx firebase emulators:start --only firestore,auth --project trivia-59073
 *   VITE_FIREBASE_EMULATOR=true npx vite --port 5175
 *   node scripts/e2e/web-reglas.mjs [carpeta-capturas]
 */
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5175'
const OUT = process.argv[2] ?? 'capturas-e2e'
mkdirSync(OUT, { recursive: true })
const PREGUNTAS = JSON.parse(readFileSync(process.argv[3] ?? 'src/data/questions.json', 'utf8'))
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

async function nuevo(nombre, viewport) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(`[${nombre}] ${m.text()}`)
  })
  page.on('pageerror', (e) => errores.push(`[${nombre}] pageerror: ${e.message}`))
  return { ctx, page }
}

async function correcta(page) {
  const texto = (await page.locator('main h2').filter({ hasText: '?' }).first().textContent()).trim()
  const q = PREGUNTAS.find((p) => p.pregunta.trim() === texto)
  if (!q) throw new Error('Pregunta no encontrada: ' + texto)
  return q.respuestaCorrecta
}

async function responder(page, acertar) {
  await page.getByRole('timer').waitFor({ timeout: 15000 })
  const idx = await correcta(page)
  await page.keyboard.press(String((acertar ? idx : (idx + 1) % 4) + 1))
}

const nombreCarta = (page) => page.locator('main span.font-display.text-2xl').first().textContent()

async function puntosEnClasificacion(page, apodo) {
  await page.goto(`${BASE}/clasificacion`, { waitUntil: 'load' })
  const fila = page.getByRole('list', { name: 'Clasificación' }).first().locator('li').filter({ hasText: apodo }).first()
  await fila.waitFor({ timeout: 10000 })
  await page.waitForTimeout(800)
  return Number((await fila.locator('span.text-oro-claro.tabular-nums').last().textContent()).replace('pts', '').trim())
}

async function docs(ruta) {
  const r = await fetch(`${EMU}/${ruta}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } })
  return (await r.json()).documents ?? []
}

const A = await nuevo('Ana', { width: 1440, height: 900 })
const B = await nuevo('Beto', { width: 390, height: 844 })
let ana = 0
let beto = 0

try {
  // ---- preparación ----
  await A.page.goto(BASE, { waitUntil: 'load' })
  await A.page.getByLabel('Tu apodo').fill('Ana')
  await A.page.getByRole('button', { name: 'Entrar' }).click()
  await A.page.getByLabel('Nombre del grupo').fill('Prueba reglas v2')
  await A.page.getByRole('button', { name: 'Crear grupo' }).click()
  await A.page.getByRole('heading', { name: 'Día 1 de 7' }).waitFor({ timeout: 15000 })
  const code = (await A.page.locator('p.texto-oro.font-display').first().textContent()).trim()
  await B.page.goto(`${BASE}/unirse/${code}`, { waitUntil: 'load' })
  await B.page.getByLabel('Tu apodo').fill('Beto')
  await B.page.getByRole('button', { name: 'Entrar' }).click()
  await B.page.getByRole('button', { name: 'Unirme' }).click()
  await B.page.getByRole('heading', { name: 'Día 1 de 7' }).waitFor({ timeout: 15000 })
  log('Grupo', code)
  await shot(A.page, 'ana-inicio-3-cartas')

  // ---- Ana, carta 1: comodín y acierto ----
  await A.page.getByRole('button', { name: 'Revelar mi destino' }).click()
  await A.page.getByRole('button', { name: 'Ver la pregunta' }).waitFor({ timeout: 15000 })
  const antes = (await nombreCarta(A.page)).trim()
  await A.page.waitForTimeout(1200)
  await shot(A.page, 'ana-carta-1-volteada')
  await A.page.getByRole('button', { name: 'Usar comodín' }).click()
  await A.page.waitForFunction((c) => document.querySelector('main span.font-display.text-2xl')?.textContent?.trim() !== c, antes, { timeout: 10000 })
  const despues = (await nombreCarta(A.page)).trim()
  ok(antes !== despues, `el comodín cambió ${antes} por ${despues}`)
  ok(!(await A.page.getByRole('button', { name: 'Usar comodín' }).isVisible()), 'tras usarlo, ya no se ofrece el comodín')
  await A.page.waitForTimeout(1200)
  await shot(A.page, 'ana-carta-1-tras-comodin')
  await A.page.getByRole('button', { name: 'Ver la pregunta' }).click()
  await A.page.getByText('Concéntrate…').waitFor({ timeout: 10000 })
  await A.page.waitForTimeout(700)
  await shot(A.page, 'ana-cuenta-atras')
  await responder(A.page, true)
  await A.page.getByRole('heading', { name: '¡El destino te sonríe!' }).waitFor({ timeout: 10000 })
  ana += 7
  ok(!(await A.page.getByText('¡Reto desbloqueado!').isVisible()), 'con 1 acierto el reto sigue bloqueado')
  await shot(A.page, 'ana-resultado-1', true)

  // ---- carta 2: sin comodín, acierto → reto desbloqueado ----
  await A.page.getByRole('button', { name: /Siguiente carta \(2 de 3\)/ }).click()
  await A.page.getByRole('button', { name: 'Ver la pregunta' }).waitFor({ timeout: 15000 })
  ok(!(await A.page.getByRole('button', { name: 'Usar comodín' }).isVisible()), 'la carta 2 no ofrece comodín (ya usado hoy)')
  await A.page.getByRole('button', { name: 'Ver la pregunta' }).click()
  await responder(A.page, true)
  await A.page.getByRole('heading', { name: '¡El destino te sonríe!' }).waitFor({ timeout: 10000 })
  ana += 7
  await A.page.getByText('¡Reto desbloqueado!').waitFor({ timeout: 5000 })
  log('OK con 2 aciertos se desbloquea el reto')
  await shot(A.page, 'ana-resultado-2-reto', true)
  await A.page.getByRole('link', { name: 'Lanzar un reto' }).click()
  await A.page.getByRole('heading', { name: 'Lanza tu reto' }).waitFor()
  await A.page.getByRole('radio', { name: /^Beto/ }).click()
  await A.page.getByRole('button', { name: 'Retar a Beto' }).click()
  await A.page.getByRole('heading', { name: 'Reto lanzado a Beto' }).waitFor({ timeout: 15000 })
  log('OK Ana lanzó un reto a Beto (sin puntos por lanzarlo)')

  // ---- carta 3: fallo; no hay más cartas ----
  await A.page.goto(`${BASE}/`, { waitUntil: 'load' })
  await A.page.getByRole('button', { name: 'Sacar carta 3 de 3' }).click()
  await A.page.getByRole('button', { name: 'Ver la pregunta' }).waitFor({ timeout: 15000 })
  await A.page.getByRole('button', { name: 'Ver la pregunta' }).click()
  await responder(A.page, false)
  await A.page.getByRole('heading', { name: 'Las cartas no estaban de tu lado' }).waitFor({ timeout: 10000 })
  await A.page.getByText(/Jugaste tus 3 cartas de hoy/).waitFor({ timeout: 5000 })
  ok(!(await A.page.getByRole('button', { name: /Siguiente carta/ }).isVisible()), 'tras 3 cartas no hay siguiente')
  ok(!(await A.page.getByText('¡Reto desbloqueado!').isVisible()), 'el reto no se vuelve a ofrecer')

  // ---- Beto: reto obligatorio, lo devuelve ----
  await B.page.goto(`${BASE}/`, { waitUntil: 'load' })
  await B.page.getByRole('link', { name: /Ana.*te lanzó un reto/ }).waitFor({ timeout: 10000 })
  ok(!(await B.page.getByRole('button', { name: 'Revelar mi destino' }).isVisible()) && (await B.page.getByText('Responde tu reto pendiente para sacar la siguiente carta.').isVisible()), 'Beto no puede sacar carta con el reto pendiente')
  await shot(B.page, 'beto-reto-pendiente', true)
  await B.page.getByRole('link', { name: /te lanzó un reto/ }).click()
  await B.page.getByRole('button', { name: 'Devolver el reto' }).waitFor()
  await shot(B.page, 'beto-reto-intro', true)
  await B.page.getByRole('button', { name: 'Devolver el reto' }).click()
  await B.page.getByText('La Rueda de la Fortuna decide…').waitFor({ timeout: 5000 })
  await shot(B.page, 'beto-rueda-girando')
  const veredicto = B.page.getByRole('heading', { name: /La fortuna te sonríe|La fortuna te da la espalda/ })
  await veredicto.waitFor({ timeout: 15000 })
  const exito = (await veredicto.textContent()).includes('sonríe')
  await B.page.waitForTimeout(1500)
  await shot(B.page, `beto-rueda-${exito ? 'exito' : 'fallo'}`)
  log(`La devolución ${exito ? 'SALIÓ BIEN' : 'SALIÓ MAL'}`)
  // El resultado de la interfaz coincide con la hora guardada en el servidor.
  const reto = (await docs(`groups/${code}/challenges`)).find((d) => !d.name.endsWith('_2') && d.fields.extra?.booleanValue === false)
  const ms = Math.floor(Date.parse(reto.fields.devueltoEn.timestampValue))
  ok((ms % 100 < 30) === exito, `la pantalla coincide con la hora del servidor (${ms % 100} ms)`)

  if (exito) {
    await B.page.getByRole('button', { name: 'Volver al inicio' }).click()
    await B.page.getByRole('button', { name: 'Revelar mi destino' }).waitFor({ timeout: 10000 })
    log('OK Beto queda libre para jugar')
    await A.page.goto(`${BASE}/`, { waitUntil: 'load' })
    await A.page.getByRole('link', { name: /Beto.*te devolvió tu reto/ }).waitFor({ timeout: 10000 })
    await A.page.getByRole('link', { name: /te devolvió tu reto/ }).click()
    await A.page.getByRole('button', { name: 'Ver la pregunta' }).click()
    await responder(A.page, false)
    await A.page.getByText(/Pierdes 5 puntos/).waitFor({ timeout: 10000 })
    ana -= 5
    log('OK Ana respondió mal el reto devuelto: −5')
    await A.page.goto(`${BASE}/`, { waitUntil: 'load' })
    await A.page.getByText(/te devolvió el reto y lo fallaste/).waitFor({ timeout: 10000 })
    log('OK el inicio de Ana dice que falló el reto devuelto')
  } else {
    await B.page.getByRole('button', { name: 'Empezar el doble reto' }).click()
    await B.page.getByRole('heading', { name: 'Doble reto: pregunta 1 de 2' }).waitFor()
    await B.page.getByRole('button', { name: 'Ver la pregunta' }).click()
    await responder(B.page, true)
    await B.page.getByRole('heading', { name: '¡Venciste el reto!' }).waitFor({ timeout: 10000 })
    await shot(B.page, 'beto-doble-1', true)
    await B.page.getByRole('link', { name: 'Siguiente pregunta' }).click()
    await B.page.getByRole('heading', { name: 'Doble reto: pregunta 2 de 2' }).waitFor()
    await B.page.getByRole('button', { name: 'Ver la pregunta' }).click()
    await responder(B.page, false)
    await B.page.getByText(/Doble reto terminado: \+5 puntos para ti/).waitFor({ timeout: 10000 })
    await shot(B.page, 'beto-doble-final', true)
    beto += 10 - 5
    log('OK doble reto: +10 una vez y −5 por el fallo')
  }

  // ---- Beto juega su carta ----
  await B.page.goto(`${BASE}/`, { waitUntil: 'load' })
  await B.page.getByRole('button', { name: 'Revelar mi destino' }).click()
  await B.page.getByRole('button', { name: 'Ver la pregunta' }).waitFor({ timeout: 15000 })
  await B.page.getByRole('button', { name: 'Ver la pregunta' }).click()
  await responder(B.page, true)
  await B.page.getByRole('heading', { name: '¡El destino te sonríe!' }).waitFor({ timeout: 10000 })
  beto += 7
  await shot(B.page, 'beto-carta-1', true)

  // ---- clasificación en ambos ----
  for (const [X, quien] of [[A, 'Ana'], [B, 'Beto']]) {
    const pa = await puntosEnClasificacion(X.page, 'Ana')
    const pb = await puntosEnClasificacion(X.page, 'Beto')
    ok(pa === ana && pb === beto, `${quien} ve Ana ${pa} (esperado ${ana}) y Beto ${pb} (esperado ${beto})`)
  }
  await shot(A.page, 'ana-clasificacion', true)

  // ---- bots: 3 cartas cada uno ----
  await A.page.getByRole('link', { name: 'Admin' }).click()
  await A.page.getByRole('button', { name: 'Añadir jugadores simulados (bots)' }).click()
  await A.page.getByRole('button', { name: 'Bots en juego' }).waitFor({ timeout: 15000 })
  await A.page.waitForTimeout(8000)
  const respuestas = await docs(`groups/${code}/answers`)
  const porBot = {}
  for (const d of respuestas) {
    const uid = d.fields.uid.stringValue
    if (uid.startsWith('bot-')) porBot[uid] = (porBot[uid] ?? 0) + 1
  }
  ok(Object.keys(porBot).length === 6 && Object.values(porBot).every((v) => v === 3), `cada bot respondió 3 cartas: ${JSON.stringify(porBot)}`)
  await A.page.goto(`${BASE}/`, { waitUntil: 'load' })
  await A.page.waitForTimeout(1500)
  await shot(A.page, 'ana-inicio-con-bots', true)

  // ---- día 2: cartas nuevas y comodín otra vez disponible ----
  await A.page.getByRole('link', { name: 'Admin' }).click()
  await A.page.getByRole('button', { name: 'Avanzar día' }).click()
  await B.page.goto(`${BASE}/`, { waitUntil: 'load' })
  await B.page.getByRole('heading', { name: 'Día 2 de 7' }).waitFor({ timeout: 15000 })
  await B.page.getByRole('button', { name: 'Revelar mi destino' }).waitFor({ timeout: 10000 })
  ok(await B.page.getByText(/Comodín: disponible/).isVisible(), 'el día 2 empieza con 3 cartas nuevas y el comodín disponible')

  // ---- saltar al final: ceremonia ----
  await A.page.getByRole('link', { name: 'Admin' }).click()
  await A.page.getByRole('button', { name: 'Saltar al final de la semana' }).click()
  await A.page.getByRole('button', { name: 'Saltar al final', exact: true }).click()
  await B.page.getByText('Temporada terminada').first().waitFor({ timeout: 30000 })
  await B.page.waitForTimeout(2500)
  await shot(B.page, 'beto-ceremonia', true)
  const total = (await docs(`groups/${code}/answers`)).filter((d) => d.fields.uid.stringValue.startsWith('bot-')).length
  ok(total === 6 * 3 * 7, `los bots jugaron 3 cartas los 7 días (${total} respuestas)`)
} catch (e) {
  console.log('ERROR', e.message)
  await shot(A.page, 'error-ana', true).catch(() => {})
  await shot(B.page, 'error-beto', true).catch(() => {})
  process.exitCode = 1
} finally {
  console.log('Errores de consola:', errores.length ? errores : 'ninguno')
  await browser.close()
}
