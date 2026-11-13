import {
  collection,
  doc,
  getDocs,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { GAME_CONFIG } from '../config/gameConfig'
import { BOT_PROFILES, isBotUid, type BotDayPlan } from '../game/bots'
import { startOfLocalDay } from '../game/day'
import type { ChallengeEvent, StandingRow, Titles } from '../game/types'
import { serverNow } from './clock'
import { botAnswerDoc, botChallengeDoc, botPlayerDoc, botResolvePatch, paths, userDoc } from './docs'
import type { Group, TitleHolder, UserProfile } from './types'

/**
 * Operaciones del administrador del grupo (modo demo). Las reglas solo se las permiten a él.
 */

/** Crea los bots del modo demo (los que ya existan se actualizan). */
export async function addBots(code: string): Promise<void> {
  const batch = writeBatch(db)
  for (const b of BOT_PROFILES.slice(0, GAME_CONFIG.numBots)) {
    batch.set(doc(db, paths.player(code, b.uid)), botPlayerDoc(b))
  }
  await batch.commit()
}

// Las escrituras de bots (automatización, "saltar al final" y retos a bots) van en fila: si sus
// transacciones corrieran a la vez sobre los mismos documentos, Firestore las abortaría (409)
// y tendría que reintentarlas.
let fila: Promise<unknown> = Promise.resolve()
function enFila<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = fila.then(tarea, tarea)
  fila = resultado.catch(() => {})
  return resultado
}

/**
 * Escribe lo que hicieron los bots (respuestas, retos nuevos y retos resueltos) en una transacción:
 * primero comprueba qué existe para no pisar nada (p. ej., un reto que un humano lanzó al mismo
 * jugador un instante antes).
 */
export function applyBotPlan(code: string, plan: BotDayPlan): Promise<void> {
  return enFila(() => escribirPlan(code, plan))
}

async function escribirPlan(code: string, plan: BotDayPlan): Promise<void> {
  const answerRefs = plan.answers.map((a) => doc(db, paths.answer(code, a.uid, a.dia, a.n)))
  const newRefs = plan.newChallenges.map((c) => doc(db, paths.challenge(code, c.id)))
  const resolvedRefs = plan.resolved.map((c) => doc(db, paths.challenge(code, c.id)))
  if (answerRefs.length + newRefs.length + resolvedRefs.length === 0) return

  await runTransaction(db, async (tx) => {
    const leer = (refs: DocumentReference[]) => Promise.all(refs.map((r) => tx.get(r)))
    const [answerSnaps, newSnaps, resolvedSnaps] = await Promise.all([leer(answerRefs), leer(newRefs), leer(resolvedRefs)])

    // Retos que ya no se pueden crear (el retado recibió otro): el bot no reta ese día.
    const descartados = new Set(plan.newChallenges.filter((_, i) => newSnaps[i]!.exists()).map((c) => c.de))

    plan.answers.forEach((a, i) => {
      if (answerSnaps[i]!.exists()) return
      tx.set(answerRefs[i]!, botAnswerDoc({ ...a, retoPara: descartados.has(a.uid) ? null : a.retoPara }))
    })
    plan.newChallenges.forEach((c, i) => {
      // Si la respuesta que desbloqueó el reto ya existía, otro cliente ya jugó por el bot: no se reta.
      const llave = plan.answers.findIndex((a) => a.uid === c.de && a.retoPara === c.para)
      if (newSnaps[i]!.exists() || answerSnaps[llave]?.exists()) return
      tx.set(newRefs[i]!, botChallengeDoc(c))
    })
    plan.resolved.forEach((c, i) => {
      const snap = resolvedSnaps[i]!
      if (snap.exists() && snap.get('estado') !== 'resuelto') tx.update(resolvedRefs[i]!, botResolvePatch(c))
    })
  })
}

/** Resuelve una pregunta de reto que le toca a un bot: recibida de un humano o devuelta (si nadie la resolvió antes). */
export function resolveBotChallengeDoc(code: string, resolved: ChallengeEvent): Promise<void> {
  const ref = doc(db, paths.challenge(code, resolved.id))
  return enFila(() =>
    runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      if (snap.exists() && snap.get('estado') !== 'resuelto') tx.update(ref, botResolvePatch(resolved))
    }),
  )
}

export async function setDayOffset(code: string, dayOffset: number): Promise<void> {
  await updateDoc(doc(db, paths.group(code)), { dayOffset })
}

function holder(r: StandingRow | null): TitleHolder | null {
  return r ? { uid: r.uid, apodo: r.apodo, avatar: r.avatar, puntos: r.puntos } : null
}

/** Cierra la temporada y deja registrados el campeón y los títulos. */
export async function finalizeSeason(code: string, titles: Titles): Promise<void> {
  await updateDoc(doc(db, paths.group(code)), {
    estado: 'finalizado',
    campeon: holder(titles.duenoDelDestino),
    titulos: {
      duenoDelDestino: holder(titles.duenoDelDestino),
      vidente: holder(titles.vidente),
      retador: holder(titles.retador),
    },
  })
}

/** Borra documentos en lotes de 400 (el límite de Firestore es 500 operaciones por lote). */
async function borrarEnLotes(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db)
    refs.slice(i, i + 400).forEach((r) => batch.delete(r))
    await batch.commit()
  }
}

async function refsDe(ruta: string, filtro: (id: string) => boolean = () => true): Promise<DocumentReference[]> {
  const snap = await getDocs(collection(db, ruta))
  return snap.docs.filter((d) => filtro(d.id)).map((d) => d.ref)
}

/**
 * Reinicia el grupo: borra respuestas, retos y bots, y empieza una temporada nueva hoy.
 * Los jugadores humanos se quedan.
 */
export async function resetGroup(group: Group): Promise<void> {
  const code = group.code
  await borrarEnLotes([
    ...(await refsDe(paths.answers(code))),
    ...(await refsDe(paths.challenges(code))),
    ...(await refsDe(paths.players(code), isBotUid)),
  ])

  await updateDoc(doc(db, paths.group(code)), {
    fechaInicio: Timestamp.fromMillis(startOfLocalDay(serverNow())),
    dayOffset: 0,
    estado: 'activo',
    temporada: group.temporada + 1,
    campeon: null,
    titulos: null,
  })
}

/**
 * Elimina el grupo por completo (para limpiar después de la exposición). Los demás miembros
 * verán "Este grupo ya no existe" y podrán elegir otro.
 */
export async function deleteGroup(group: Group, admin: UserProfile): Promise<void> {
  const code = group.code
  // Lo propio va al final (ficha y marca de co-administrador): mientras exista, sigue pudiendo borrar.
  await borrarEnLotes([
    ...(await refsDe(paths.answers(code))),
    ...(await refsDe(paths.challenges(code))),
    ...(await refsDe(paths.players(code), (id) => id !== admin.uid)),
    ...(await refsDe(paths.admins(code), (id) => id !== admin.uid)),
    doc(db, paths.adminKey(code)),
  ])
  await borrarEnLotes([doc(db, paths.player(code, admin.uid)), doc(db, paths.coAdmin(code, admin.uid)), doc(db, paths.group(code))])
  await setDoc(doc(db, paths.user(admin.uid)), userDoc(admin, null), { merge: true })
}
