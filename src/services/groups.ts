import {
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  runTransaction,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { generateAdminKey, generateGroupCode, isValidAdminKey, isValidGroupCode, normalizeGroupCode } from '../game/codes'
import { startOfLocalDay } from '../game/day'
import { cleanText, validateGroupName } from '../game/validation'
import { serverNow } from './clock'
import { adminKeyDoc, coAdminDoc, humanPlayerDoc, newGroupDoc, paths, readGroup, userDoc } from './docs'
import { GameError, isPermissionDenied } from './errors'
import type { Group, UserProfile } from './types'

const MAX_INTENTOS_CODIGO = 6

export function watchGroup(code: string, cb: (group: Group | null) => void, onError: (e: unknown) => void): Unsubscribe {
  return onSnapshot(
    doc(db, paths.group(code)),
    (snap) => cb(snap.exists() ? readGroup(code, snap.data({ serverTimestamps: 'estimate' })) : null),
    onError,
  )
}

/** Busca un grupo por código en el servidor (para unirse hace falta conexión). */
export async function findGroup(rawCode: string): Promise<Group | null> {
  const code = normalizeGroupCode(rawCode)
  if (!isValidGroupCode(code)) throw new GameError('El código debe tener 5 caracteres (letras y números).')
  const snap = await getDocFromServer(doc(db, paths.group(code)))
  return snap.exists() ? readGroup(code, snap.data()) : null
}

/**
 * Crea un grupo con código único. El creador es el administrador; si `adminJuega`,
 * también entra como jugador. Se hace en una transacción para no pisar un código existente.
 */
export async function createGroup(
  profile: UserProfile,
  input: { nombre: string; adminJuega: boolean },
): Promise<string> {
  const nombre = cleanText(input.nombre)
  const error = validateGroupName(nombre)
  if (error) throw new GameError(error)

  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento++) {
    const code = generateGroupCode()
    const creado = await runTransaction(db, async (tx) => {
      const groupRef = doc(db, paths.group(code))
      if ((await tx.get(groupRef)).exists()) return false
      tx.set(groupRef, newGroupDoc(profile.uid, nombre, input.adminJuega, startOfLocalDay(serverNow())))
      tx.set(doc(db, paths.adminKey(code)), adminKeyDoc(generateAdminKey()))
      if (profile.grupoActual && profile.grupoActual !== code) {
        tx.delete(doc(db, paths.player(profile.grupoActual, profile.uid)))
        tx.delete(doc(db, paths.coAdmin(profile.grupoActual, profile.uid)))
      }
      tx.set(doc(db, paths.user(profile.uid)), userDoc(profile, code), { merge: true })
      if (input.adminJuega) tx.set(doc(db, paths.player(code, profile.uid)), humanPlayerDoc(profile))
      return true
    })
    if (creado) return code
  }
  throw new GameError('No se pudo generar un código de grupo libre. Inténtalo de nuevo.')
}

/**
 * Une al jugador a un grupo. Como solo se puede estar en un grupo a la vez,
 * sale del anterior en el mismo lote.
 */
export async function joinGroup(profile: UserProfile, rawCode: string): Promise<Group> {
  const group = await findGroup(rawCode)
  if (!group) throw new GameError('No existe ningún grupo con ese código.')
  if (profile.grupoActual === group.code) return group

  const batch = writeBatch(db)
  if (profile.grupoActual) {
    batch.delete(doc(db, paths.player(profile.grupoActual, profile.uid)))
    batch.delete(doc(db, paths.coAdmin(profile.grupoActual, profile.uid)))
  }
  batch.set(doc(db, paths.user(profile.uid)), userDoc(profile, group.code), { merge: true })
  batch.set(doc(db, paths.player(group.code, profile.uid)), humanPlayerDoc(profile))
  await batch.commit()
  return group
}

/**
 * Se suma como co-administrador de un grupo con su clave (sin jugar). Sirve para administrar
 * desde la PC del stand un grupo creado en un celular. Sale del grupo anterior en el mismo lote.
 */
export async function claimAdmin(profile: UserProfile, rawCode: string, rawClave: string): Promise<Group> {
  const clave = normalizeGroupCode(rawClave)
  if (!isValidAdminKey(clave)) throw new GameError('La clave de administración tiene 8 caracteres (letras y números).')
  const group = await findGroup(rawCode)
  if (!group) throw new GameError('No existe ningún grupo con ese código.')

  const batch = writeBatch(db)
  if (profile.grupoActual && profile.grupoActual !== group.code) {
    batch.delete(doc(db, paths.player(profile.grupoActual, profile.uid)))
    batch.delete(doc(db, paths.coAdmin(profile.grupoActual, profile.uid)))
  }
  batch.set(doc(db, paths.user(profile.uid)), userDoc(profile, group.code), { merge: true })
  batch.set(doc(db, paths.coAdmin(group.code, profile.uid)), coAdminDoc(clave))
  try {
    await batch.commit()
  } catch (e) {
    if (isPermissionDenied(e)) throw new GameError('La clave de administración no es correcta.')
    throw e
  }
  return group
}

/** Clave de administración del grupo (solo la puede leer quien lo creó). */
export async function readAdminKey(code: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, paths.adminKey(code)))
    return snap.exists() ? String(snap.get('clave')) : null
  } catch (e) {
    if (isPermissionDenied(e)) return null
    throw e
  }
}

/** Observa si el usuario es co-administrador del grupo. */
export function watchCoAdmin(code: string, uid: string, cb: (esCoAdmin: boolean) => void): Unsubscribe {
  return onSnapshot(
    doc(db, paths.coAdmin(code, uid)),
    (snap) => cb(snap.exists()),
    () => cb(false),
  )
}

/** Sale del grupo actual (sus respuestas quedan, pero deja de aparecer en la clasificación). */
export async function leaveGroup(profile: UserProfile): Promise<void> {
  if (!profile.grupoActual) return
  const batch = writeBatch(db)
  batch.delete(doc(db, paths.player(profile.grupoActual, profile.uid)))
  batch.delete(doc(db, paths.coAdmin(profile.grupoActual, profile.uid)))
  batch.set(doc(db, paths.user(profile.uid)), userDoc(profile, null), { merge: true })
  await batch.commit()
}

/** Enlace para unirse (también se usa en el QR del modo presentación). */
export function joinUrl(code: string, origin: string = window.location.origin): string {
  return `${origin}/unirse/${code}`
}
