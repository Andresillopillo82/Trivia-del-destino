/**
 * firestore.rules de la Partida Rápida (quickRooms/**). Mismo uso que rules.int.test.ts:
 *   npm run test:rules:emu  (emulador)   ·   npm run test:rules  (proyecto real)
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { deleteApp, FirebaseError, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, deleteUser, getAuth, signInAnonymously } from 'firebase/auth'
import {
  Timestamp,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  terminate,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { GAME_CONFIG } from '../../src/config/gameConfig'
import { generateGroupCode } from '../../src/game/codes'
import { quickPaths, quickPlayerDoc, quickProgressPatch, quickRoomDoc } from '../../src/services/quickDocs'

const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}
const emuFirestore = process.env.FIRESTORE_EMULATOR_HOST
const emuAuth = process.env.FIREBASE_AUTH_EMULATOR_HOST

interface Actor {
  app: FirebaseApp
  db: Firestore
  uid: string
}

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
  return { app, db, uid: cred.user.uid }
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

const CFG = GAME_CONFIG.quickMatch
const yo = (a: string) => ({ apodo: a, avatar: 'luna' as const, esBot: false })
const BOT = 'bot-onix'

let host: Actor
let ana: Actor
let beto: Actor
let code: string
const room = (a: Actor) => doc(a.db, quickPaths.room(code))
const player = (a: Actor, uid: string) => doc(a.db, quickPaths.player(code, uid))

beforeAll(async () => {
  if (!config.apiKey) throw new Error('Falta .env con la configuración de Firebase')
  ;[host, ana, beto] = await Promise.all([actor('Host'), actor('Ana'), actor('Beto')])
  code = generateGroupCode()
}, 30_000)

afterAll(async () => {
  if (host && code) {
    const snap = await getDocs(collection(host.db, quickPaths.players(code))).catch(() => null)
    await Promise.all(snap?.docs.map((d) => deleteDoc(d.ref)) ?? [])
    await deleteDoc(room(host)).catch(() => {})
  }
  for (const a of [host, ana, beto]) {
    if (!a) continue
    const user = getAuth(a.app).currentUser
    if (user) await deleteUser(user).catch(() => {})
    await terminate(a.db)
    await deleteApp(a.app)
  }
}, 60_000)

describe('Partida Rápida', () => {
  test('crear: solo como anfitrión, en lobby y con caducidad de 6 h', async () => {
    const ahora = Date.now()
    await denegado(setDoc(room(ana), { ...quickRoomDoc(host.uid, true, 1, CFG, ahora) }))
    await denegado(setDoc(room(host), { ...quickRoomDoc(host.uid, true, 1, CFG, ahora), status: 'playing' }))
    await denegado(setDoc(room(host), quickRoomDoc(host.uid, true, 1, CFG, ahora + 24 * 3600_000)))
    await denegado(setDoc(doc(host.db, 'quickRooms/abcde'), quickRoomDoc(host.uid, true, 1, CFG, ahora)))
    // Sala y jugador anfitrión en la misma transacción (como createQuickRoom).
    await permitido(
      runTransaction(host.db, async (tx) => {
        expect((await tx.get(room(host))).exists()).toBe(false)
        tx.set(room(host), quickRoomDoc(host.uid, true, 1234, CFG, Date.now()))
        tx.set(player(host, host.uid), quickPlayerDoc(yo('Host'), 1))
      }),
    )
  })

  test('se lee por código, pero no se pueden listar salas', async () => {
    await permitido(getDoc(room(ana)))
    await denegado(getDocs(collection(ana.db, 'quickRooms')))
  })

  test('unirse: solo uno mismo, sin hacerse pasar por bot y con la ronda de la sala', async () => {
    await denegado(setDoc(player(ana, beto.uid), quickPlayerDoc(yo('Ana'), 1)))
    await denegado(setDoc(player(ana, ana.uid), quickPlayerDoc({ ...yo('Ana'), esBot: true }, 1)))
    await denegado(setDoc(player(ana, ana.uid), quickPlayerDoc(yo('Ana'), 2)))
    await denegado(setDoc(player(ana, ana.uid), { ...quickPlayerDoc(yo('Ana'), 1), grupo: 'X' }))
    await permitido(setDoc(player(ana, ana.uid), quickPlayerDoc(yo('Ana'), 1)))
    await permitido(setDoc(player(beto, beto.uid), quickPlayerDoc(yo('Beto'), 1)))
    await permitido(getDocs(collection(beto.db, quickPaths.players(code))))
  })

  test('bots: solo el anfitrión, con uid bot-…', async () => {
    await denegado(setDoc(player(ana, BOT), quickPlayerDoc({ ...yo('Oráculo'), esBot: true }, 1)))
    await denegado(setDoc(player(host, 'bot-falso'), quickPlayerDoc(yo('Falso'), 1)))
    await permitido(setDoc(player(host, BOT), quickPlayerDoc({ ...yo('Oráculo'), esBot: true }, 1)))
  })

  test('solo el anfitrión cambia la sala, y solo con las transiciones válidas', async () => {
    await denegado(updateDoc(room(ana), { status: 'playing', startedAt: serverTimestamp() }))
    await denegado(updateDoc(room(host), { status: 'finished' }))
    await denegado(updateDoc(room(host), { status: 'playing', startedAt: Timestamp.fromMillis(Date.now() - 60_000) }))
    await denegado(updateDoc(room(host), { hostUid: ana.uid }))
    await permitido(updateDoc(room(host), { status: 'playing', startedAt: serverTimestamp() }))
  })

  test('en juego: cada uno sube sus contadores; nadie entra tarde', async () => {
    const carlos = await actor('Carlos')
    await denegado(setDoc(doc(carlos.db, quickPaths.player(code, carlos.uid)), quickPlayerDoc(yo('Carlos'), 1)))
    await deleteUser(getAuth(carlos.app).currentUser!).catch(() => {})
    await terminate(carlos.db)
    await deleteApp(carlos.app)

    await permitido(updateDoc(player(ana, ana.uid), quickProgressPatch({ correctas: 3, falladas: 1, finished: false }, 1)))
    await denegado(updateDoc(player(ana, beto.uid), quickProgressPatch({ correctas: 99, falladas: 0, finished: true }, 1)))
    await denegado(updateDoc(player(ana, ana.uid), { ...quickProgressPatch({ correctas: 3, falladas: 1, finished: false }, 1), esBot: true }))
    await denegado(updateDoc(player(ana, ana.uid), quickProgressPatch({ correctas: -1, falladas: 0, finished: false }, 1)))
    await permitido(updateDoc(player(host, BOT), quickProgressPatch({ correctas: 2, falladas: 0, finished: true }, 1)))
    await permitido(updateDoc(player(beto, beto.uid), quickProgressPatch({ correctas: 1, falladas: 2, finished: true }, 1)))
  })

  test('terminada: ya no se aceptan contadores', async () => {
    await permitido(updateDoc(room(host), { status: 'finished' }))
    await denegado(updateDoc(player(ana, ana.uid), quickProgressPatch({ correctas: 9, falladas: 1, finished: true }, 1)))
  })

  test('revancha: ronda + 1 en el lobby; los jugadores se reinician', async () => {
    await denegado(updateDoc(room(host), { status: 'lobby', round: 3, seed: 5, evitar: [], startedAt: null }))
    await permitido(updateDoc(room(host), { status: 'lobby', round: 2, seed: 99, evitar: ['loco-1'], startedAt: null }))
    await denegado(updateDoc(player(ana, ana.uid), { round: 1, correctas: 0, falladas: 0, finished: false, updatedAt: serverTimestamp() }))
    await permitido(updateDoc(player(ana, ana.uid), { round: 2, correctas: 0, falladas: 0, finished: false, updatedAt: serverTimestamp() }))
    // Una escritura atrasada de la ronda 1 no pisa los contadores de la revancha.
    await permitido(updateDoc(room(host), { status: 'playing', startedAt: serverTimestamp() }))
    await denegado(updateDoc(player(ana, ana.uid), quickProgressPatch({ correctas: 9, falladas: 17, finished: true }, 1)))
    await permitido(updateDoc(player(ana, ana.uid), quickProgressPatch({ correctas: 1, falladas: 0, finished: false }, 2)))
    await permitido(updateDoc(room(host), { status: 'finished' }))
  })

  test('borrar: uno sale solo; el anfitrión cierra la sala con todos sus jugadores', async () => {
    await denegado(deleteDoc(player(ana, beto.uid)))
    await denegado(deleteDoc(room(ana)))
    await permitido(deleteDoc(player(beto, beto.uid)))
    const jugadores = await getDocs(collection(host.db, quickPaths.players(code)))
    const b = writeBatch(host.db)
    for (const d of jugadores.docs) b.delete(d.ref)
    b.delete(room(host))
    await permitido(b.commit())
    expect((await getDoc(room(host))).exists()).toBe(false)
  })

  test('una sala caducada no admite jugadores', async () => {
    // No se puede crear ya caducada; se comprueba que no se puede entrar a una sala inexistente.
    await denegado(setDoc(player(ana, ana.uid), quickPlayerDoc(yo('Ana'), 1)))
  })

  test('nada de groups/', async () => {
    await denegado(getDocs(collection(ana.db, 'groups')))
  })
})
