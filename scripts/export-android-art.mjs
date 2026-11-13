/**
 * Exporta las cartas y avatares de la web como VectorDrawable para la app Android.
 *
 *   node scripts/export-android-art.mjs
 *
 * 1. Renderiza los componentes React a SVG (sin texto) con el modo SSR de Vite.
 * 2. Los convierte con Svg2Vector, el mismo conversor que usa Android Studio ("Vector Asset").
 *
 * Requiere Android Studio instalado (usa su JDK y su sdk-common.jar). Si está en otra ruta,
 * defínela con la variable ANDROID_STUDIO.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const studio = process.env.ANDROID_STUDIO ?? 'C:/Program Files/Android/Android Studio'
const java = join(studio, 'jbr/bin/java')
const dirSvg = join(raiz, 'android/arte/svg')
const dirXml = join(raiz, 'android/app/src/main/res/drawable')

// 1. SVG desde los componentes
const server = await createServer({ root: raiz, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
const { exportarArte } = await server.ssrLoadModule('/scripts/android-art.tsx')
const arte = exportarArte()
await server.close()

rmSync(dirSvg, { recursive: true, force: true })
mkdirSync(dirSvg, { recursive: true })
mkdirSync(dirXml, { recursive: true })
for (const [nombre, contenido] of Object.entries(arte)) writeFileSync(join(dirSvg, `${nombre}.svg`), contenido)
// SVG escritos a mano solo para Android (ícono adaptativo).
const dirFuente = join(raiz, 'android/arte/fuente')
for (const f of readdirSync(dirFuente)) copyFileSync(join(dirFuente, f), join(dirSvg, f))
console.log(`${readdirSync(dirSvg).length} SVG en android/arte/svg`)

// 2. Conversión con Svg2Vector (classpath: los jar de Android Studio)
const sep = process.platform === 'win32' ? ';' : ':'
const classpath = [join(studio, 'plugins/android/lib/*'), join(studio, 'lib/*')].join(sep)
const pares = readdirSync(dirSvg).flatMap((f) => [join(dirSvg, f), join(dirXml, f.replace(/\.svg$/, '.xml'))])
const salida = execFileSync(java, ['-cp', classpath, join(raiz, 'scripts/Svg2VectorCli.java'), ...pares], { encoding: 'utf8' })
if (salida.trim()) console.log(salida.trim())
console.log('VectorDrawable en android/app/src/main/res/drawable')
