import { collection, doc, onSnapshot, updateDoc, writeBatch, type Unsubscribe } from 'firebase/firestore'
import { db } from '../config/firebase'
import { challengeId, extraChallengeId } from '../game/challenges'
import { cardIdOf } from '../game/questions'
import type { AnswerResult, ChallengeEvent, Question } from '../game/types'
import {
  extraChallengeDoc,
  newChallengeDoc,
  openChallengePatch,
  paths,
  readChallenge,
  resolveChallengePatch,
  returnChallengePatch,
} from './docs'
import { GameError, isPermissionDenied, withTimeout } from './errors'
import type { LiveChallenge } from './types'
import { serverTimeOf } from './answers'

const TIMEOUT_MS = 12_000

/** Retos del grupo en tiempo real (para la Carta de Reto y la clasificación). */
export function watchChallenges(
  code: string,
  cb: (challenges: LiveChallenge[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, paths.challenges(code)),
    (snap) =>
      cb(
        snap.docs.map((d) =>
          // devueltoEn sin estimar: hasta que el servidor confirma la devolución, su resultado no se conoce.
          readChallenge(d.id, d.data({ serverTimestamps: 'estimate' }), d.get('devueltoEn', { serverTimestamps: 'none' })),
        ),
      ),
    onError,
  )
}

/**
 * Lanza un reto: marca la respuesta que lo desbloqueó (el 2.º acierto del día, número `respuestaN`)
 * y crea el reto en el mismo lote (las reglas exigen ambas cosas a la vez).
 */
export async function sendChallenge(
  code: string,
  de: string,
  para: string,
  dia: number,
  respuestaN: number,
  question: Question,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, paths.answer(code, de, dia, respuestaN)), { retoPara: para })
  batch.set(
    doc(db, paths.challenge(code, challengeId(para, dia))),
    newChallengeDoc({ de, para, dia, preguntaId: question.id, carta: cardIdOf(question) }, respuestaN),
  )
  try {
    await withTimeout(batch.commit(), TIMEOUT_MS, 'No hay conexión con el servidor. Inténtalo de nuevo.')
  } catch (e) {
    if (isPermissionDenied(e)) {
      throw new GameError('No se pudo lanzar el reto: esa persona ya recibió uno hoy o ya usaste tu reto.')
    }
    throw e
  }
}

/**
 * Devuelve un reto recibido. En el mismo lote crea la pregunta extra, que solo cuenta si la devolución
 * falla. Devuelve la hora del servidor de la devolución, que decide el resultado (devolucionExitosa).
 */
export async function returnChallenge(code: string, reto: ChallengeEvent, extra: Question): Promise<number> {
  const ref = doc(db, paths.challenge(code, reto.id))
  const batch = writeBatch(db)
  batch.update(ref, returnChallengePatch())
  batch.set(
    doc(db, paths.challenge(code, extraChallengeId(reto.para, reto.dia))),
    extraChallengeDoc({ de: reto.de, para: reto.para, dia: reto.dia, preguntaId: extra.id, carta: cardIdOf(extra) }),
  )
  const inicio = Date.now()
  try {
    await withTimeout(batch.commit(), TIMEOUT_MS, 'No hay conexión con el servidor. Necesitas internet para devolver el reto.')
  } catch (e) {
    if (isPermissionDenied(e)) throw new GameError('Este reto ya no se puede devolver.')
    throw e
  }
  return serverTimeOf(ref, 'devueltoEn', inicio)
}

/**
 * Quien debe responder abre la pregunta del reto: el temporizador corre desde la hora del servidor de apertura
 * (más la pausa de la animación). Requiere conexión.
 */
export async function openChallenge(code: string, id: string): Promise<number> {
  const ref = doc(db, paths.challenge(code, id))
  const inicio = Date.now()
  await withTimeout(
    updateDoc(ref, openChallengePatch()),
    TIMEOUT_MS,
    'No hay conexión con el servidor. Necesitas internet para abrir el reto.',
  )
  return serverTimeOf(ref, 'abiertoEn', inicio)
}

export function resolveChallenge(code: string, id: string, result: AnswerResult): Promise<void> {
  return updateDoc(doc(db, paths.challenge(code, id)), resolveChallengePatch(result))
}
