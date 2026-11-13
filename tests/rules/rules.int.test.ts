/**
 * Prueba de integración de firestore.rules contra el proyecto real de Firebase.
 * Crea un grupo temporal con tres usuarios anónimos, verifica qué se permite y qué se rechaza,
 * y al final borra todo (documentos y usuarios anónimos).
 *
 * Uso: npm run test:rules:emu  (emulador local de Firebase; necesita Java, p. ej. el JDK de Android Studio)
 *      npm run test:rules      (contra el proyecto real; requiere .env y las reglas desplegadas)
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, deleteUser, getAuth, signInAnonymously } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  terminate,
  updateDoc,
  writeBatch,
  connectFirestoreEmulator,
  type Firestore,
  type Timestamp,
  getFirestore,
} from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { generateAdminKey, generateGroupCode } from '../../src/game/codes'
import type { CardId } from '../../src/game/cards'
import { devolucionExitosa } from '../../src/game/challenges'
import type { ChallengeEvent } from '../../src/game/types'
import { startOfLocalDay } from '../../src/game/day'
import {
  adminKeyDoc,
  botAnswerDoc,
  botChallengeDoc,
  botPlayerDoc,
  botResolvePatch,
  cardAnswerDoc,
  closeAnswerPatch,
  comodinPatch,
  extraChallengeDoc,
  humanPlayerDoc,
  newChallengeDoc,
  newGroupDoc,
  openAnswerPatch,
  openChallengePatch,
  paths,
  resolveChallengePatch,
  returnChallengePatch,
  coAdminDoc,
  userDoc,
} from '../../src/services/docs'

const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

interface Actor {
  nombre: string
  app: FirebaseApp
  db: Firestore
  uid: string
}

// Con `npm run test:rules:emu`, firebase emulators:exec define estas variables y todo va al emulador local.
const emuFirestore = process.env.FIRESTORE_EMULATOR_HOST
const emuAuth = process.env.FIREBASE_AUTH_EMULATOR_HOST

async function actor(nombre: string): Promise<Actor> {
  const app = initializeApp(config, `${nombre}-${Date.now()}`)
  const auth = getAuth(app)
  const db = getFirestore(app)
  if (emuAuth) connectAuthEmulator(auth, `http://${emuAuth}`, { disableWarnings: true })
  if (emuFirestore) {
    const [host, port] = emuFirestore.split(':')
    connectFirestoreEmulator(db, host!, Number(port))
  }
  const cred = await signInAnonymously(auth)
  return { nombre, app, db, uid: cred.user.uid }
}

async function permitido(p: Promise<unknown>) {
  await expect(p).resolves.not.toThrow()
}

async function denegado(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(FirebaseError)
    expect((e as FirebaseError).code).toBe('permission-denied')
    return
  }
  throw new Error('Se esperaba permission-denied, pero la operación fue permitida')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function retoEvento(de: string, para: string, dia: number): ChallengeEvent {
  return { id: `${para}_${dia}`, de, para, dia, preguntaId: 'rueda-h1', carta: 'rueda', estado: 'pendiente', extra: false, devueltoEnMs: null, correcta: null, tiempoMs: null }
}

const retoDeBot = (para: string, dia: number) => botChallengeDoc(retoEvento(BOT, para, dia))

let ana: Actor // administradora (juega)
let beto: Actor // jugador
let caro: Actor // externa, luego jugadora
let dani: Actor // organizadora en la PC: co-administra con la clave, sin jugar
let clave: string
let code: string
const DIA = 0
const BOT = 'bot-prueba'

const perfil = (n: string) => ({ apodo: n, avatar: 'sol' as const })

beforeAll(async () => {
  if (!config.apiKey) throw new Error('Falta .env con la configuración de Firebase')
  ;[ana, beto, caro, dani] = await Promise.all([actor('Ana'), actor('Beto'), actor('Caro'), actor('Dani')])
  code = generateGroupCode()
  clave = generateAdminKey()
}, 30_000)

afterAll(async () => {
  // Limpieza con la administradora: todo lo creado en el grupo de prueba.
  if (ana && code) {
    for (const sub of ['answers', 'challenges', 'players', 'admins'] as const) {
      const snap = await getDocs(collection(ana.db, `groups/${code}/${sub}`)).catch(() => null)
      await Promise.all(snap?.docs.map((d) => deleteDoc(d.ref)) ?? [])
    }
    await deleteDoc(doc(ana.db, paths.adminKey(code))).catch(() => {})
    await deleteDoc(doc(ana.db, paths.group(code))).catch(() => {})
  }
  for (const a of [ana, beto, caro, dani]) {
    if (!a) continue
    const user = getAuth(a.app).currentUser
    if (user) await deleteUser(user).catch(() => {})
    await terminate(a.db)
    await deleteApp(a.app)
  }
}, 60_000)

describe('perfiles (users)', () => {
  test('cada uno escribe y lee solo su perfil', async () => {
    await permitido(setDoc(doc(ana.db, paths.user(ana.uid)), userDoc(perfil('Ana'), null)))
    await permitido(setDoc(doc(beto.db, paths.user(beto.uid)), userDoc(perfil('Beto'), null)))
    await permitido(setDoc(doc(caro.db, paths.user(caro.uid)), userDoc(perfil('Caro'), null)))
    await denegado(getDoc(doc(beto.db, paths.user(ana.uid))))
    await denegado(setDoc(doc(beto.db, paths.user(ana.uid)), userDoc(perfil('Hack'), null)))
    await denegado(setDoc(doc(beto.db, paths.user(beto.uid)), userDoc({ apodo: 'B', avatar: 'sol' }, null)))
  })
})

describe('grupos', () => {
  test('crear con datos inválidos se rechaza', async () => {
    const inicio = startOfLocalDay(Date.now())
    await denegado(setDoc(doc(ana.db, paths.group(code)), newGroupDoc(beto.uid, 'Prueba', true, inicio)))
    await denegado(setDoc(doc(ana.db, paths.group(code)), { ...newGroupDoc(ana.uid, 'Prueba', true, inicio), dayOffset: 5 }))
    await denegado(setDoc(doc(ana.db, paths.group('abc')), newGroupDoc(ana.uid, 'Prueba', true, inicio)))
  })

  test('la administradora crea el grupo, su perfil y su ficha en una transacción', async () => {
    await permitido(
      runTransaction(ana.db, async (tx) => {
        const ref = doc(ana.db, paths.group(code))
        expect((await tx.get(ref)).exists()).toBe(false)
        tx.set(ref, newGroupDoc(ana.uid, 'Grupo de prueba', true, startOfLocalDay(Date.now())))
        tx.set(doc(ana.db, paths.adminKey(code)), adminKeyDoc(clave))
        tx.set(doc(ana.db, paths.user(ana.uid)), userDoc(perfil('Ana'), code), { merge: true })
        tx.set(doc(ana.db, paths.player(code, ana.uid)), humanPlayerDoc(perfil('Ana')))
      }),
    )
  })

  test('cualquiera autenticado puede consultar el grupo por código, pero no listar grupos', async () => {
    await permitido(getDoc(doc(caro.db, paths.group(code))))
    await denegado(getDocs(collection(caro.db, 'groups')))
  })

  test('quien no es miembro no ve jugadores, respuestas ni retos', async () => {
    await denegado(getDocs(collection(caro.db, paths.players(code))))
    await denegado(getDocs(collection(caro.db, paths.answers(code))))
    await denegado(getDocs(collection(caro.db, paths.challenges(code))))
  })

  test('unirse exige apuntar el perfil al grupo en el mismo lote', async () => {
    await denegado(setDoc(doc(caro.db, paths.player(code, caro.uid)), humanPlayerDoc(perfil('Caro'))))
    const b = writeBatch(beto.db)
    b.set(doc(beto.db, paths.user(beto.uid)), userDoc(perfil('Beto'), code), { merge: true })
    b.set(doc(beto.db, paths.player(code, beto.uid)), humanPlayerDoc(perfil('Beto')))
    await permitido(b.commit())
    await permitido(getDocs(collection(beto.db, paths.players(code))))
  })

  test('nadie crea fichas de otros ni se marca como bot', async () => {
    await denegado(setDoc(doc(beto.db, paths.player(code, caro.uid)), humanPlayerDoc(perfil('Caro'))))
    await denegado(updateDoc(doc(beto.db, paths.player(code, beto.uid)), { esBot: true }))
    await denegado(updateDoc(doc(beto.db, paths.player(code, ana.uid)), { apodo: 'Hack' }))
    await permitido(updateDoc(doc(beto.db, paths.player(code, beto.uid)), { apodo: 'Beto II', avatar: 'luna' }))
  })

  test('solo la administradora cambia la configuración (dayOffset)', async () => {
    const ref = (a: Actor) => doc(a.db, paths.group(code))
    await denegado(updateDoc(ref(beto), { dayOffset: 3 }))
    await denegado(updateDoc(ref(beto), { nombre: 'Hackeado' }))
    await denegado(updateDoc(ref(ana), { adminUid: beto.uid }))
    await permitido(updateDoc(ref(ana), { dayOffset: 2 }))
    await permitido(updateDoc(ref(ana), { dayOffset: 0 }))
  })
})

describe('respuestas diarias', () => {
  const cartaRef = (a: Actor, uid: string, n: number, dia = DIA) => doc(a.db, paths.answer(code, uid, dia, n))

  test('no se escribe la carta de otro jugador', async () => {
    await denegado(setDoc(cartaRef(beto, ana.uid, 0), cardAnswerDoc(ana.uid, DIA, 0, 'loco')))
  })

  test('no se puede jugar otro día que el actual', async () => {
    await denegado(setDoc(cartaRef(beto, beto.uid, 0, 3), cardAnswerDoc(beto.uid, 3, 0, 'loco')))
  })

  test('voltear crea la carta sin pregunta; no se voltea dos veces', async () => {
    await permitido(setDoc(cartaRef(beto, beto.uid, 0), cardAnswerDoc(beto.uid, DIA, 0, 'loco')))
    await denegado(setDoc(cartaRef(beto, beto.uid, 0), cardAnswerDoc(beto.uid, DIA, 0, 'mago')))
  })

  test('no se crea ya abierta, cerrada, con pregunta ni con el número cambiado', async () => {
    const base = cardAnswerDoc(caro.uid, DIA, 0, 'loco')
    await denegado(setDoc(cartaRef(caro, caro.uid, 0), { ...base, estado: 'abierta' }))
    await denegado(setDoc(cartaRef(caro, caro.uid, 0), { ...base, estado: 'cerrada', correcta: true }))
    await denegado(setDoc(cartaRef(caro, caro.uid, 0), { ...base, preguntaId: 'loco-n1' }))
    await denegado(setDoc(cartaRef(caro, caro.uid, 0), { ...base, comodin: true }))
    await denegado(setDoc(cartaRef(caro, caro.uid, 0), { ...base, n: 1 }))
  })

  test('la siguiente carta exige haber respondido la anterior', async () => {
    await denegado(setDoc(cartaRef(beto, beto.uid, 1), cardAnswerDoc(beto.uid, DIA, 1, 'mago')))
    await denegado(setDoc(cartaRef(beto, beto.uid, 3), cardAnswerDoc(beto.uid, DIA, 3, 'mago')))
  })

  test('el comodín cambia la carta una vez al día, solo por otra y antes de ver la pregunta', async () => {
    await denegado(updateDoc(cartaRef(beto, beto.uid, 0), comodinPatch('loco')))
    await denegado(updateDoc(cartaRef(ana, beto.uid, 0), comodinPatch('mago')))
    await permitido(updateDoc(cartaRef(beto, beto.uid, 0), comodinPatch('mago')))
    await denegado(updateDoc(cartaRef(beto, beto.uid, 0), comodinPatch('carro')))
  })

  test('ver la pregunta la fija; no se cierra antes de abrirla', async () => {
    await denegado(updateDoc(cartaRef(beto, beto.uid, 0), closeAnswerPatch({ opcion: 1, correcta: true, tiempoMs: 1500 })))
    await denegado(updateDoc(cartaRef(beto, beto.uid, 0), { ...openAnswerPatch('mago-n1'), carta: 'carro' }))
    await permitido(updateDoc(cartaRef(beto, beto.uid, 0), openAnswerPatch('mago-n1')))
    await denegado(updateDoc(cartaRef(beto, beto.uid, 0), openAnswerPatch('mago-n2')))
  })

  test('cerrar una sola vez y sin cambiar la pregunta', async () => {
    await denegado(updateDoc(cartaRef(beto, beto.uid, 0), { ...closeAnswerPatch({ opcion: 1, correcta: true, tiempoMs: 3000 }), preguntaId: 'otra' }))
    await permitido(updateDoc(cartaRef(beto, beto.uid, 0), closeAnswerPatch({ opcion: 1, correcta: true, tiempoMs: 1500 })))
    await denegado(updateDoc(cartaRef(beto, beto.uid, 0), closeAnswerPatch({ opcion: 2, correcta: false, tiempoMs: 1500 })))
  })

  test('el comodín ya usado en otra carta del día no se repite', async () => {
    await permitido(setDoc(cartaRef(beto, beto.uid, 1), cardAnswerDoc(beto.uid, DIA, 1, 'mundo')))
    await denegado(updateDoc(cartaRef(beto, beto.uid, 1), comodinPatch('rueda')))
  })

  test('el tiempo declarado no puede ser mucho menor que el real', async () => {
    // Pausa de la cuenta atrás (3 s) + margen (5 s): tras 10 s reales no se puede declarar 0,5 s.
    await permitido(setDoc(cartaRef(ana, ana.uid, 0), cardAnswerDoc(ana.uid, DIA, 0, 'mundo')))
    await permitido(updateDoc(cartaRef(ana, ana.uid, 0), openAnswerPatch('mundo-n1')))
    await sleep(10_000)
    await denegado(updateDoc(cartaRef(ana, ana.uid, 0), closeAnswerPatch({ opcion: 0, correcta: true, tiempoMs: 500 })))
    await permitido(updateDoc(cartaRef(ana, ana.uid, 0), closeAnswerPatch({ opcion: 0, correcta: true, tiempoMs: 7_000 })))
  }, 25_000)

  test('nadie modifica respuestas ajenas', async () => {
    await denegado(updateDoc(cartaRef(beto, ana.uid, 0), { correcta: false }))
  })
})

/** Voltea, abre y cierra una carta del día. */
async function jugar(a: Actor, n: number, carta: CardId, correcta: boolean) {
  const ref = doc(a.db, paths.answer(code, a.uid, DIA, n))
  await permitido(setDoc(ref, cardAnswerDoc(a.uid, DIA, n, carta)))
  await permitido(updateDoc(ref, openAnswerPatch(`${carta}-n${n + 1}`)))
  await permitido(updateDoc(ref, closeAnswerPatch(correcta ? { opcion: 0, correcta: true, tiempoMs: 2000 } : { opcion: null, correcta: false, tiempoMs: 20_000 })))
}

/** Lote "lanzar reto": marca la respuesta que lo desbloqueó y crea el reto. */
function lanzarReto(a: Actor, para: string, n: number, preguntaId: string) {
  const b = writeBatch(a.db)
  b.update(doc(a.db, paths.answer(code, a.uid, DIA, n)), { retoPara: para })
  b.set(doc(a.db, paths.challenge(code, `${para}_${DIA}`)), newChallengeDoc({ de: a.uid, para, dia: DIA, preguntaId, carta: 'loco' }, n))
  return b.commit()
}

/** Lote "devolver": marca el reto de `para` como devuelto y crea la pregunta extra (lo escribe `a`). */
function devolver(a: Actor, dia: number, de: string, preguntaExtra = 'emperador-h1', para = a.uid) {
  const b = writeBatch(a.db)
  b.update(doc(a.db, paths.challenge(code, `${para}_${dia}`)), returnChallengePatch())
  b.set(doc(a.db, paths.challenge(code, `${para}_${dia}_2`)), extraChallengeDoc({ de, para, dia, preguntaId: preguntaExtra, carta: 'emperador' }))
  return b.commit()
}

/** ¿Salió bien la devolución? Se calcula con la hora del servidor, igual que en las reglas. */
async function devolucionSalioBien(a: Actor, dia: number): Promise<boolean> {
  const ts = (await getDoc(doc(a.db, paths.challenge(code, `${a.uid}_${dia}`)))).get('devueltoEn') as Timestamp
  return devolucionExitosa(ts.toMillis())
}

describe('retos', () => {
  const retoRef = (a: Actor, para: string, dia = DIA) => doc(a.db, paths.challenge(code, `${para}_${dia}`))

  test('sin acertar no se puede retar', async () => {
    const b = writeBatch(caro.db)
    b.set(doc(caro.db, paths.user(caro.uid)), userDoc(perfil('Caro'), code), { merge: true })
    b.set(doc(caro.db, paths.player(code, caro.uid)), humanPlayerDoc(perfil('Caro')))
    await permitido(b.commit())
    await jugar(caro, 0, 'carro', false)
    await permitido(setDoc(doc(ana.db, paths.player(code, BOT)), botPlayerDoc({ apodo: 'Bot', avatar: 'ojo', habilidad: 0.5 })))
    await denegado(lanzarReto(caro, BOT, 0, 'loco-h2'))
  })

  test('con un solo acierto no se puede retar', async () => {
    // Beto acertó la 1.ª carta (respuestas diarias); con la 2.ª fallada sigue con un acierto.
    await permitido(updateDoc(doc(beto.db, paths.answer(code, beto.uid, DIA, 1)), openAnswerPatch('mundo-n2')))
    await permitido(
      updateDoc(doc(beto.db, paths.answer(code, beto.uid, DIA, 1)), closeAnswerPatch({ opcion: null, correcta: false, tiempoMs: 20_000 })),
    )
    await denegado(lanzarReto(beto, ana.uid, 0, 'loco-h1'))
    await denegado(lanzarReto(beto, ana.uid, 1, 'loco-h1'))
  })

  test('el 2.º acierto del día desbloquea el reto, en el mismo lote y una sola vez', async () => {
    await jugar(beto, 2, 'carro', true)
    await denegado(setDoc(retoRef(beto, ana.uid), newChallengeDoc({ de: beto.uid, para: ana.uid, dia: DIA, preguntaId: 'loco-h1', carta: 'loco' }, 2)))
    await permitido(lanzarReto(beto, ana.uid, 2, 'loco-h1'))
  })

  test('el 3.er acierto no da otro reto y nadie pisa un reto ya recibido', async () => {
    await jugar(ana, 1, 'mago', true)
    await permitido(lanzarReto(ana, beto.uid, 1, 'mago-h1'))
    await jugar(ana, 2, 'rueda', true)
    await denegado(lanzarReto(ana, caro.uid, 2, 'mago-h2'))
    // Ana ya recibió el reto de Beto hoy: no se puede reemplazar.
    await denegado(lanzarReto(beto, ana.uid, 2, 'carro-h2'))
  })

  test('solo el retado devuelve, antes de abrirlo y junto con la pregunta extra', async () => {
    await denegado(updateDoc(retoRef(ana, ana.uid), returnChallengePatch()))
    await denegado(devolver(beto, DIA, beto.uid, 'emperador-h1', ana.uid)) // Beto no devuelve el reto de Ana
    await denegado(devolver(ana, DIA, beto.uid, 'loco-h1')) // la extra no puede repetir la pregunta
    await permitido(devolver(ana, DIA, beto.uid))
    await denegado(devolver(ana, DIA, beto.uid, 'carro-h1'))
    await denegado(updateDoc(retoRef(ana, ana.uid), returnChallengePatch()))
  })

  test('la pregunta extra no existe sin devolver', async () => {
    await denegado(
      setDoc(doc(beto.db, paths.challenge(code, `${beto.uid}_${DIA}_2`)), extraChallengeDoc({ de: ana.uid, para: beto.uid, dia: DIA, preguntaId: 'rueda-h1', carta: 'rueda' })),
    )
  })

  test('tras devolver responde quien dice la hora del servidor, una vez', async () => {
    const extraRef = (a: Actor) => doc(a.db, paths.challenge(code, `${ana.uid}_${DIA}_2`))
    if (await devolucionSalioBien(ana, DIA)) {
      // Le toca a Beto (sin premio); Ana queda libre y la extra no cuenta.
      await denegado(updateDoc(retoRef(ana, ana.uid), openChallengePatch()))
      await denegado(updateDoc(extraRef(ana), openChallengePatch()))
      await permitido(updateDoc(retoRef(beto, ana.uid), openChallengePatch()))
      await permitido(updateDoc(retoRef(beto, ana.uid), resolveChallengePatch({ opcion: 1, correcta: true, tiempoMs: 1000 })))
      await denegado(updateDoc(retoRef(beto, ana.uid), resolveChallengePatch({ opcion: 1, correcta: false, tiempoMs: 1000 })))
    } else {
      // Doble reto: Ana responde las dos; Beto no puede tocarlas.
      await denegado(updateDoc(retoRef(beto, ana.uid), openChallengePatch()))
      await permitido(updateDoc(retoRef(ana, ana.uid), openChallengePatch()))
      await permitido(updateDoc(extraRef(ana), openChallengePatch()))
      await permitido(updateDoc(retoRef(ana, ana.uid), resolveChallengePatch({ opcion: 1, correcta: true, tiempoMs: 1000 })))
      await permitido(updateDoc(extraRef(ana), resolveChallengePatch({ opcion: 0, correcta: false, tiempoMs: 1500 })))
      await denegado(updateDoc(extraRef(ana), resolveChallengePatch({ opcion: 1, correcta: true, tiempoMs: 1500 })))
    }
  })

  test('un reto abierto ya no se devuelve', async () => {
    await permitido(updateDoc(retoRef(beto, beto.uid), openChallengePatch()))
    await denegado(devolver(beto, DIA, ana.uid))
    await denegado(updateDoc(retoRef(ana, beto.uid), resolveChallengePatch({ opcion: 0, correcta: false, tiempoMs: 2000 })))
    await permitido(updateDoc(retoRef(beto, beto.uid), resolveChallengePatch({ opcion: 1, correcta: true, tiempoMs: 1000 })))
  })
})

describe('co-administración con clave', () => {
  const sumarse = (claveUsada: string) => {
    const b = writeBatch(dani.db)
    b.set(doc(dani.db, paths.user(dani.uid)), userDoc(perfil('Dani'), code), { merge: true })
    b.set(doc(dani.db, paths.coAdmin(code, dani.uid)), coAdminDoc(claveUsada))
    return b.commit()
  }

  test('la clave solo la lee quien creó el grupo, y no se puede reemplazar', async () => {
    await denegado(getDoc(doc(beto.db, paths.adminKey(code))))
    await denegado(getDoc(doc(dani.db, paths.adminKey(code))))
    const snap = await getDoc(doc(ana.db, paths.adminKey(code)))
    expect(snap.get('clave')).toBe(clave)
    await denegado(setDoc(doc(ana.db, paths.adminKey(code)), adminKeyDoc('AAAAAAAA')))
  })

  test('con una clave incorrecta no se administra', async () => {
    await denegado(sumarse(clave === 'AAAAAAAA' ? 'BBBBBBBB' : 'AAAAAAAA'))
  })

  test('con la clave correcta se co-administra sin jugar', async () => {
    await permitido(setDoc(doc(dani.db, paths.user(dani.uid)), userDoc(perfil('Dani'), null)))
    await permitido(sumarse(clave))
    // Ve el grupo y controla el día…
    await permitido(getDocs(collection(dani.db, paths.answers(code))))
    await permitido(updateDoc(doc(dani.db, paths.group(code)), { dayOffset: 1 }))
    await permitido(updateDoc(doc(dani.db, paths.group(code)), { dayOffset: 0 }))
    // …pero no juega, no lee la clave y su documento de co-admin no lo ven los jugadores.
    expect((await getDoc(doc(dani.db, paths.player(code, dani.uid)))).exists()).toBe(false)
    await denegado(getDoc(doc(dani.db, paths.adminKey(code))))
    await denegado(getDoc(doc(beto.db, paths.coAdmin(code, dani.uid))))
    // Y no puede quedarse con el grupo.
    await denegado(updateDoc(doc(dani.db, paths.group(code)), { adminUid: dani.uid }))
  })
})

describe('bots y administración', () => {
  const respuestaBot = (n: number, preguntaId: string, correcta: boolean) => ({
    uid: BOT,
    dia: DIA,
    n,
    preguntaId,
    carta: 'rueda' as const,
    opcion: correcta ? 1 : 0,
    correcta,
    tiempoMs: 5000,
    retoPara: null,
  })

  test('solo la administradora gestiona bots y sus respuestas', async () => {
    await denegado(setDoc(doc(beto.db, paths.player(code, 'bot-falso')), botPlayerDoc({ apodo: 'Falso', avatar: 'ojo', habilidad: 1 })))
    await denegado(setDoc(doc(beto.db, paths.answer(code, BOT, DIA, 0)), botAnswerDoc(respuestaBot(0, 'rueda-n1', true))))
    await permitido(setDoc(doc(ana.db, paths.answer(code, BOT, DIA, 0)), botAnswerDoc(respuestaBot(0, 'rueda-n1', true))))
    await permitido(setDoc(doc(ana.db, paths.answer(code, BOT, DIA, 1)), botAnswerDoc(respuestaBot(1, 'rueda-n2', false))))
    // Un número de pregunta que no coincide con el id se rechaza.
    await denegado(setDoc(doc(ana.db, paths.answer(code, BOT, DIA, 2)), botAnswerDoc(respuestaBot(1, 'rueda-n3', true))))
  })

  test('la respuesta de un bot no se puede sobrescribir', async () => {
    await denegado(setDoc(doc(ana.db, paths.answer(code, BOT, DIA, 0)), botAnswerDoc(respuestaBot(0, 'mundo-n2', false))))
  })

  test('los retos de bots solo se crean: no pisan un reto existente', async () => {
    // Ana ya recibió el reto de Beto hoy: la administradora no puede reemplazarlo con uno de bot.
    await denegado(setDoc(doc(ana.db, paths.challenge(code, `${ana.uid}_${DIA}`)), retoDeBot(ana.uid, DIA)))
    // Caro aún no recibió reto hoy: sí.
    await permitido(setDoc(doc(ana.db, paths.challenge(code, `${caro.uid}_${DIA}`)), retoDeBot(caro.uid, DIA)))
    // Y la administradora no puede resolver un reto que debe responder un humano.
    await denegado(
      updateDoc(doc(ana.db, paths.challenge(code, `${caro.uid}_${DIA}`)), botResolvePatch({ ...retoEvento(BOT, caro.uid, DIA), correcta: true, tiempoMs: 1000 })),
    )
  })

  test('la administradora resuelve una sola vez los retos que recibe un bot', async () => {
    const ref = doc(ana.db, paths.challenge(code, `${BOT}_${DIA}`))
    await permitido(setDoc(ref, botChallengeDoc(retoEvento('bot-otro', BOT, DIA))))
    await denegado(updateDoc(doc(beto.db, paths.challenge(code, `${BOT}_${DIA}`)), botResolvePatch({ ...retoEvento('bot-otro', BOT, DIA), correcta: true, tiempoMs: 1000 })))
    await permitido(updateDoc(ref, botResolvePatch({ ...retoEvento('bot-otro', BOT, DIA), correcta: false, tiempoMs: 4000 })))
    await denegado(updateDoc(ref, botResolvePatch({ ...retoEvento('bot-otro', BOT, DIA), correcta: true, tiempoMs: 4000 })))
  })

  test('la devolución sale bien o mal según la hora del servidor, y las reglas coinciden con el juego', async () => {
    // Un bot reta a Caro, Ana y Beto en varios días y lo devuelven siempre, hasta ver ambos resultados
    // (30 % / 70 %: con 18 intentos, que no aparezcan los dos tiene una probabilidad de ~0,2 %).
    const vistos = new Set<boolean>()
    const resultados: number[] = []
    const dias = [1, 2, 3, 4, 5, 6]
    for (const jugadora of [caro, ana, beto]) {
      for (const dia of dias) {
        if (vistos.size === 2) break
        await permitido(setDoc(doc(ana.db, paths.challenge(code, `${jugadora.uid}_${dia}`)), retoDeBot(jugadora.uid, dia)))
        await permitido(devolver(jugadora, dia, BOT))
        const exito = await devolucionSalioBien(jugadora, dia)
        resultados.push(exito ? 1 : 0)
        vistos.add(exito)
        const base = doc(jugadora.db, paths.challenge(code, `${jugadora.uid}_${dia}`))
        const extra = doc(jugadora.db, paths.challenge(code, `${jugadora.uid}_${dia}_2`))
        const resolverComoBot = () =>
          updateDoc(
            doc(ana.db, paths.challenge(code, `${jugadora.uid}_${dia}`)),
            botResolvePatch({ ...retoEvento(BOT, jugadora.uid, dia), correcta: false, tiempoMs: 3000 }),
          )
        if (exito) {
          // Le toca al bot (lo resuelve la administradora); la jugadora no abre ninguna de las dos.
          await denegado(updateDoc(base, openChallengePatch()))
          await denegado(updateDoc(extra, openChallengePatch()))
          await permitido(resolverComoBot())
        } else {
          // Doble reto: la jugadora abre las dos; la administradora no puede responder por ella.
          await denegado(resolverComoBot())
          await permitido(updateDoc(base, openChallengePatch()))
          await permitido(updateDoc(extra, openChallengePatch()))
        }
      }
    }
    expect(vistos, `resultados (1 = éxito): ${resultados.join('')}`).toEqual(new Set([true, false]))
  }, 60_000)

  test('solo la administradora borra datos del grupo', async () => {
    await denegado(deleteDoc(doc(beto.db, paths.answer(code, ana.uid, DIA, 0))))
    await denegado(deleteDoc(doc(beto.db, paths.group(code))))
  })

  test('un jugador puede salir del grupo y deja de verlo', async () => {
    const b = writeBatch(beto.db)
    b.delete(doc(beto.db, paths.player(code, beto.uid)))
    b.set(doc(beto.db, paths.user(beto.uid)), userDoc(perfil('Beto'), null), { merge: true })
    await permitido(b.commit())
    await denegado(getDocs(collection(beto.db, paths.answers(code))))
  })
})
