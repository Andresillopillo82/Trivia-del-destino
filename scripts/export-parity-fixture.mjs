/**
 * Genera android/app/src/test/resources/paridad.json con escenarios calculados por la lógica de la web.
 * La prueba ParityTest de Android exige obtener los mismos resultados.
 *
 *   node scripts/export-parity-fixture.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: raiz, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
const { crearEscenarios } = await server.ssrLoadModule('/scripts/parity.ts')
const datos = crearEscenarios()
await server.close()

const destino = join(raiz, 'android/app/src/test/resources/paridad.json')
mkdirSync(dirname(destino), { recursive: true })
writeFileSync(destino, JSON.stringify(datos, null, 1))
console.log(`${datos.escenarios.length} escenarios y ${datos.dias.length} casos de día en ${destino}`)
