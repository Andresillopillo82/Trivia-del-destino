import {
  collection,
  doc,
  getDocFromServer,
  onSnapshot,
  setDoc,
  updateDoc,
  type DocumentReference,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { serverNow, syncClock } from './clock'
import type { CardId } from '../game/cards'
import type { AnswerResult } from '../game/types'
import { cardAnswerDoc, closeAnswerPatch, comodinPatch, openAnswerPatch, paths, readAnswer } from './docs'
import { GameError, isPermissionDenied, withTimeout } from './errors'
import type { LiveAnswer } from './types'

const TIMEOUT_MS = 12_000

/** Respuestas del grupo en tiempo real (incluye las escrituras locales pendientes). */
export function watchAnswers(
  code: string,
  cb: (answers: LiveAnswer[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, paths.answers(code)),
    (snap) => cb(snap.docs.map((d) => readAnswer(d.data({ serverTimestamps: 'estimate' })))),
    onError,
  )
}

/**
 * Voltea la carta `n` del día (aún sin pregunta). La clave {uid}_{dia}_{n} impide sacarla dos veces
 * y las reglas exigen haber respondido la anterior. Requiere conexión: espera al servidor.
 */
export async function drawDailyCard(code: string, uid: string, dia: number, n: number, carta: CardId): Promise<void> {
  try {
    await withTimeout(
      setDoc(doc(db, paths.answer(code, uid, dia, n)), cardAnswerDoc(uid, dia, n, carta)),
      TIMEOUT_MS,
      'No hay conexión con el servidor. Necesitas internet para sacar tu carta.',
    )
  } catch (e) {
    if (isPermissionDenied(e)) {
      throw new GameError('Ya sacaste esta carta, o el día cambió. Recarga la página.')
    }
    throw e
  }
}

/** Comodín del día: cambia la carta volteada antes de ver la pregunta. */
export async function swapCardWithComodin(code: string, uid: string, dia: number, n: number, carta: CardId): Promise<void> {
  try {
    await withTimeout(
      updateDoc(doc(db, paths.answer(code, uid, dia, n)), comodinPatch(carta)),
      TIMEOUT_MS,
      'No hay conexión con el servidor. Inténtalo de nuevo.',
    )
  } catch (e) {
    if (isPermissionDenied(e)) throw new GameError('Ya usaste tu comodín de hoy.')
    throw e
  }
}

/**
 * "Ver la pregunta": la fija y registra la hora del servidor desde la que corre el tiempo.
 * Devuelve esa hora (y sincroniza el reloj local con ella).
 */
export async function openDailyQuestion(code: string, uid: string, dia: number, n: number, preguntaId: string): Promise<number> {
  const ref = doc(db, paths.answer(code, uid, dia, n))
  const inicio = Date.now()
  await withTimeout(
    updateDoc(ref, openAnswerPatch(preguntaId)),
    TIMEOUT_MS,
    'No hay conexión con el servidor. Necesitas internet para ver la pregunta.',
  )
  return serverTimeOf(ref, 'reveladoEn', inicio)
}

/**
 * Lee del servidor la marca de tiempo recién escrita y sincroniza el reloj local con ella.
 * El temporizador se calcula a partir de esa hora del servidor.
 */
export async function serverTimeOf(ref: DocumentReference, campo: string, inicio: number): Promise<number> {
  const fin = Date.now()
  try {
    const snap = await withTimeout(getDocFromServer(ref), TIMEOUT_MS, 'Sin respuesta del servidor')
    const ts = snap.get(campo) as Timestamp | undefined
    if (ts) {
      syncClock(ts.toMillis(), inicio, fin)
      return ts.toMillis()
    }
  } catch {
    // Si no se puede leer, se usa la estimación local.
  }
  return serverNow()
}

/**
 * Cierra la respuesta. No espera al servidor: la caché local la muestra al instante
 * y Firestore la sincroniza en cuanto haya conexión.
 */
export function closeDaily(code: string, uid: string, dia: number, n: number, result: AnswerResult): Promise<void> {
  return updateDoc(doc(db, paths.answer(code, uid, dia, n)), closeAnswerPatch(result))
}
