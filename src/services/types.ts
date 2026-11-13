import type { AvatarId } from '../game/avatars'
import type { AnswerEvent, ChallengeEvent } from '../game/types'

export interface UserProfile {
  uid: string
  apodo: string
  avatar: AvatarId
  grupoActual: string | null
}

export interface TitleHolder {
  uid: string
  apodo: string
  avatar: AvatarId
  puntos: number
}

export interface GroupTitles {
  duenoDelDestino: TitleHolder | null
  vidente: TitleHolder | null
  retador: TitleHolder | null
}

export type GroupState = 'activo' | 'finalizado'

export interface Group {
  code: string
  nombre: string
  adminUid: string
  /** Si el administrador también juega (si no, solo organiza y presenta). */
  adminJuega: boolean
  fechaInicioMs: number
  dayOffset: number
  estado: GroupState
  temporada: number
  campeon: TitleHolder | null
  titulos: GroupTitles | null
}

/** Respuesta con la hora del servidor en que se reveló la carta. */
export interface LiveAnswer extends AnswerEvent {
  reveladoEnMs: number | null
  respondidoEnMs: number | null
}

/** Reto con la hora del servidor en que el retado lo abrió. */
export interface LiveChallenge extends ChallengeEvent {
  abiertoEnMs: number | null
  creadoEnMs: number | null
  resueltoEnMs: number | null
}
