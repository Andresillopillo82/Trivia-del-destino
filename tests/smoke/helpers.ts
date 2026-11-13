/**
 * Módulo auxiliar para la prueba de humo en navegador: expone los servicios reales de la app
 * para manejarlos desde Playwright (lo sirve el servidor de desarrollo de Vite). No se empaqueta.
 */
import { deleteUser } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore'
import { auth, db } from '../../src/config/firebase'
import { QUESTIONS } from '../../src/game/questionBank'
import { drawQuestion } from '../../src/game/draw'
import { evaluateAnswer } from '../../src/game/scoring'
import { ensureAnonymousUser } from '../../src/services/auth'
import { saveProfile, watchProfile } from '../../src/services/users'
import { createGroup, joinGroup, watchGroup } from '../../src/services/groups'
import { watchPlayers } from '../../src/services/players'
import { closeDaily, drawDailyCard, openDailyQuestion, watchAnswers } from '../../src/services/answers'
import { paths } from '../../src/services/docs'
import type { UserProfile } from '../../src/services/types'

export { ensureAnonymousUser, saveProfile, createGroup, joinGroup, watchGroup, watchPlayers, watchAnswers }

export function profileOnce(uid: string): Promise<UserProfile | null> {
  return new Promise((resolve, reject) => {
    const un = watchProfile(
      uid,
      (p) => {
        un()
        resolve(p)
      },
      reject,
    )
  })
}

/** Saca la carta `n` del día 0, ve su pregunta y la responde bien. */
export async function playToday(code: string, uid: string, n = 0): Promise<string> {
  const draw = drawQuestion(QUESTIONS, new Set(), Math.random)!
  await drawDailyCard(code, uid, 0, n, draw.card)
  await openDailyQuestion(code, uid, 0, n, draw.question.id)
  const result = evaluateAnswer(draw.question, draw.question.respuestaCorrecta, 3_000)
  await closeDaily(code, uid, 0, n, result)
  return draw.question.id
}

/** Limpieza (como administrador): borra el grupo de prueba completo. */
export async function purgeGroup(code: string): Promise<void> {
  for (const sub of ['answers', 'challenges', 'players']) {
    const snap = await getDocs(collection(db, `groups/${code}/${sub}`))
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
  }
  await deleteDoc(doc(db, paths.group(code)))
}

export async function deleteMe(): Promise<void> {
  if (auth.currentUser) await deleteUser(auth.currentUser)
}

