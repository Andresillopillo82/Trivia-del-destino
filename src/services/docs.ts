import { Timestamp, serverTimestamp, type DocumentData, type FieldValue } from 'firebase/firestore'
import { isAvatarId, type AvatarId } from '../game/avatars'
import type { CardId } from '../game/cards'
import type { AnswerEvent, AnswerResult, ChallengeEvent, PlayerInfo } from '../game/types'
import type { Group, GroupTitles, LiveAnswer, LiveChallenge, TitleHolder, UserProfile } from './types'

/**
 * Construcción y lectura de documentos de Firestore. Mantener en sincronía con firestore.rules:
 * las reglas validan exactamente estas formas.
 */

// ---------- rutas ----------

export const paths = {
  user: (uid: string) => `users/${uid}`,
  group: (code: string) => `groups/${code}`,
  players: (code: string) => `groups/${code}/players`,
  player: (code: string, uid: string) => `groups/${code}/players/${uid}`,
  answers: (code: string) => `groups/${code}/answers`,
  answer: (code: string, uid: string, dia: number, n: number) => `groups/${code}/answers/${uid}_${dia}_${n}`,
  challenges: (code: string) => `groups/${code}/challenges`,
  challenge: (code: string, id: string) => `groups/${code}/challenges/${id}`,
  adminKey: (code: string) => `groups/${code}/secretos/admin`,
  admins: (code: string) => `groups/${code}/admins`,
  coAdmin: (code: string, uid: string) => `groups/${code}/admins/${uid}`,
}

// ---------- escritura ----------

export function userDoc(profile: { apodo: string; avatar: AvatarId }, grupoActual: string | null) {
  return { apodo: profile.apodo, avatar: profile.avatar, grupoActual, vistoEn: serverTimestamp() }
}

export function newGroupDoc(adminUid: string, nombre: string, adminJuega: boolean, fechaInicioMs: number) {
  return {
    nombre,
    adminUid,
    adminJuega,
    fechaInicio: Timestamp.fromMillis(fechaInicioMs),
    dayOffset: 0,
    estado: 'activo',
    temporada: 1,
    campeon: null,
    titulos: null,
    creadoEn: serverTimestamp(),
  }
}

export function adminKeyDoc(clave: string) {
  return { clave }
}

export function coAdminDoc(clave: string) {
  return { clave, unidoEn: serverTimestamp() }
}

export function humanPlayerDoc(profile: { apodo: string; avatar: AvatarId }) {
  return { apodo: profile.apodo, avatar: profile.avatar, esBot: false, unidoEn: serverTimestamp() }
}

export function botPlayerDoc(bot: { apodo: string; avatar: AvatarId; habilidad: number }) {
  return { apodo: bot.apodo, avatar: bot.avatar, esBot: true, habilidad: bot.habilidad, unidoEn: serverTimestamp() }
}

/** Carta volteada: aún sin pregunta (se elige al abrirla) y con el comodín disponible. */
export function cardAnswerDoc(uid: string, dia: number, n: number, carta: CardId) {
  return {
    uid,
    dia,
    n,
    preguntaId: null,
    carta,
    comodin: false,
    estado: 'carta',
    opcion: null,
    correcta: false,
    tiempoMs: 0,
    retoPara: null,
    cartaEn: serverTimestamp(),
    reveladoEn: null,
  }
}

/** Comodín: cambia la carta antes de ver la pregunta (una vez al día). */
export function comodinPatch(carta: CardId) {
  return { carta, comodin: true }
}

/** "Ver la pregunta": fija la pregunta y la hora del servidor desde la que corre el tiempo. */
export function openAnswerPatch(preguntaId: string) {
  return { estado: 'abierta', preguntaId, reveladoEn: serverTimestamp() }
}

export function closeAnswerPatch(result: AnswerResult) {
  return {
    estado: 'cerrada',
    opcion: result.opcion,
    correcta: result.correcta,
    tiempoMs: result.tiempoMs,
    respondidoEn: serverTimestamp(),
  }
}

/** Respuesta completa (ya cerrada) de un bot: la escribe el administrador. */
export function botAnswerDoc(a: Pick<AnswerEvent, 'uid' | 'dia' | 'n' | 'preguntaId' | 'carta' | 'opcion' | 'correcta' | 'tiempoMs' | 'retoPara'>) {
  const now: FieldValue = serverTimestamp()
  return {
    uid: a.uid,
    dia: a.dia,
    n: a.n,
    preguntaId: a.preguntaId,
    carta: a.carta,
    comodin: false,
    estado: 'cerrada',
    opcion: a.opcion,
    correcta: a.correcta,
    tiempoMs: a.tiempoMs,
    retoPara: a.retoPara,
    cartaEn: now,
    reveladoEn: now,
    respondidoEn: now,
  }
}

/** Reto lanzado por un jugador; `respuestaN` es la respuesta del día que lo desbloqueó. */
export function newChallengeDoc(c: Pick<ChallengeEvent, 'de' | 'para' | 'dia' | 'preguntaId' | 'carta'>, respuestaN: number) {
  return {
    de: c.de,
    para: c.para,
    dia: c.dia,
    preguntaId: c.preguntaId,
    carta: c.carta,
    estado: 'pendiente',
    extra: false,
    devueltoEn: null,
    respuestaN,
    correcta: null,
    tiempoMs: null,
    creadoEn: serverTimestamp(),
  }
}

/** Devolver el reto: la hora del servidor decide si sale bien (ver devolucionExitosa). */
export function returnChallengePatch() {
  return { estado: 'devuelto', devueltoEn: serverTimestamp() }
}

/** Segunda pregunta del doble reto; se escribe en el mismo lote que la devolución. */
export function extraChallengeDoc(c: Pick<ChallengeEvent, 'de' | 'para' | 'dia' | 'preguntaId' | 'carta'>) {
  return {
    de: c.de,
    para: c.para,
    dia: c.dia,
    preguntaId: c.preguntaId,
    carta: c.carta,
    estado: 'pendiente',
    extra: true,
    devueltoEn: null,
    correcta: null,
    tiempoMs: null,
    creadoEn: serverTimestamp(),
  }
}

/** Reto completo de un bot o a un bot (lo escribe el administrador). */
export function botChallengeDoc(c: ChallengeEvent) {
  const now: FieldValue = serverTimestamp()
  return {
    de: c.de,
    para: c.para,
    dia: c.dia,
    preguntaId: c.preguntaId,
    carta: c.carta,
    estado: c.estado,
    extra: false,
    devueltoEn: null,
    correcta: c.correcta,
    tiempoMs: c.tiempoMs,
    creadoEn: now,
    ...(c.estado === 'resuelto' ? { resueltoEn: now } : {}),
  }
}

/** Resolución de un reto que le toca a un bot (la escribe el administrador). */
export function botResolvePatch(c: ChallengeEvent) {
  return { estado: 'resuelto', correcta: c.correcta, tiempoMs: c.tiempoMs, resueltoEn: serverTimestamp() }
}

export function openChallengePatch() {
  return { estado: 'abierto', abiertoEn: serverTimestamp() }
}

export function resolveChallengePatch(result: AnswerResult) {
  return {
    estado: 'resuelto',
    opcion: result.opcion,
    correcta: result.correcta,
    tiempoMs: result.tiempoMs,
    resueltoEn: serverTimestamp(),
  }
}

// ---------- lectura ----------

/** Milisegundos enteros, como request.time.toMillis() en firestore.rules. */
function millis(v: unknown): number | null {
  return v instanceof Timestamp ? Math.floor(v.toMillis()) : null
}

function avatarOr(v: unknown): AvatarId {
  return isAvatarId(v) ? v : 'estrella'
}

function holder(v: unknown): TitleHolder | null {
  if (!v || typeof v !== 'object') return null
  const h = v as Record<string, unknown>
  return {
    uid: String(h.uid ?? ''),
    apodo: String(h.apodo ?? ''),
    avatar: avatarOr(h.avatar),
    puntos: Number(h.puntos ?? 0),
  }
}

export function readUser(uid: string, d: DocumentData): UserProfile {
  return {
    uid,
    apodo: String(d.apodo ?? ''),
    avatar: avatarOr(d.avatar),
    grupoActual: typeof d.grupoActual === 'string' ? d.grupoActual : null,
  }
}

export function readGroup(code: string, d: DocumentData): Group {
  const t = d.titulos as Record<string, unknown> | null | undefined
  const titulos: GroupTitles | null = t
    ? { duenoDelDestino: holder(t.duenoDelDestino), vidente: holder(t.vidente), retador: holder(t.retador) }
    : null
  return {
    code,
    nombre: String(d.nombre ?? ''),
    adminUid: String(d.adminUid ?? ''),
    adminJuega: d.adminJuega !== false,
    fechaInicioMs: millis(d.fechaInicio) ?? 0,
    dayOffset: Number(d.dayOffset ?? 0),
    estado: d.estado === 'finalizado' ? 'finalizado' : 'activo',
    temporada: Number(d.temporada ?? 1),
    campeon: holder(d.campeon),
    titulos,
  }
}

export function readPlayer(uid: string, d: DocumentData): PlayerInfo {
  return {
    uid,
    apodo: String(d.apodo ?? ''),
    avatar: avatarOr(d.avatar),
    esBot: d.esBot === true,
    ...(typeof d.habilidad === 'number' ? { habilidad: d.habilidad } : {}),
  }
}

export function readAnswer(d: DocumentData): LiveAnswer {
  return {
    uid: String(d.uid),
    dia: Number(d.dia),
    n: Number(d.n ?? 0),
    preguntaId: typeof d.preguntaId === 'string' ? d.preguntaId : null,
    carta: d.carta as CardId,
    comodin: d.comodin === true,
    estado: d.estado === 'cerrada' ? 'cerrada' : d.estado === 'abierta' ? 'abierta' : 'carta',
    opcion: typeof d.opcion === 'number' ? d.opcion : null,
    correcta: d.correcta === true,
    tiempoMs: Number(d.tiempoMs ?? 0),
    retoPara: typeof d.retoPara === 'string' ? d.retoPara : null,
    reveladoEnMs: millis(d.reveladoEn),
    respondidoEnMs: millis(d.respondidoEn),
  }
}

const ESTADOS_RETO = ['pendiente', 'devuelto', 'abierto', 'resuelto'] as const

/**
 * `devueltoEn` llega aparte, leído sin estimar la hora del servidor: mientras la devolución no
 * se confirma es null, así nadie ve un resultado calculado con una hora local provisional.
 */
export function readChallenge(id: string, d: DocumentData, devueltoEn: unknown = d.devueltoEn): LiveChallenge {
  return {
    id,
    de: String(d.de),
    para: String(d.para),
    dia: Number(d.dia),
    preguntaId: String(d.preguntaId),
    carta: d.carta as CardId,
    estado: ESTADOS_RETO.find((e) => e === d.estado) ?? 'pendiente',
    extra: d.extra === true,
    devueltoEnMs: millis(devueltoEn),
    correcta: typeof d.correcta === 'boolean' ? d.correcta : null,
    tiempoMs: typeof d.tiempoMs === 'number' ? d.tiempoMs : null,
    abiertoEnMs: millis(d.abiertoEn),
    creadoEnMs: millis(d.creadoEn),
    resueltoEnMs: millis(d.resueltoEn),
  }
}
