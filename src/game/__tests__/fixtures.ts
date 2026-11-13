import { CARDS } from '../cards'
import type { AnswerEvent, ChallengeEvent, PlayerInfo, Question } from '../types'

/** Banco sintético solo para pruebas: `normales` y `hards` preguntas por carta. */
export function makeQuestions(normales = 3, hards = 2): Question[] {
  const qs: Question[] = []
  for (const c of CARDS) {
    for (let i = 1; i <= normales + hards; i++) {
      const nivel = i <= normales ? 'normal' : 'hard'
      qs.push({
        id: `${c.id}-${nivel === 'normal' ? 'n' : 'h'}${i}`,
        categoria: c.categoria,
        carta: c.nombre,
        nivel,
        pregunta: `Pregunta de prueba ${i} de ${c.nombre}`,
        opciones: ['A', 'B', 'C', 'D'],
        respuestaCorrecta: i % 4,
        explicacion: 'Explicación de prueba',
      })
    }
  }
  return qs
}

export function player(uid: string, extra: Partial<PlayerInfo> = {}): PlayerInfo {
  return { uid, apodo: uid, avatar: 'sol', esBot: false, ...extra }
}

export function answer(uid: string, dia: number, extra: Partial<AnswerEvent> = {}): AnswerEvent {
  return {
    uid,
    dia,
    n: 0,
    preguntaId: `q-${uid}-${dia}-${extra.n ?? 0}`,
    carta: 'loco',
    comodin: false,
    estado: 'cerrada',
    opcion: 0,
    correcta: true,
    tiempoMs: 10_000,
    retoPara: null,
    ...extra,
  }
}

export function challenge(de: string, para: string, dia: number, extra: Partial<ChallengeEvent> = {}): ChallengeEvent {
  return {
    id: `${para}_${dia}`,
    de,
    para,
    dia,
    preguntaId: `h-${para}-${dia}`,
    carta: 'mago',
    estado: 'pendiente',
    extra: false,
    devueltoEnMs: null,
    correcta: null,
    tiempoMs: null,
    ...extra,
  }
}

/** Horas del servidor de ejemplo: ms % 100 < 30 sale bien la devolución; si no, falla. */
export const DEVUELTO_BIEN_MS = 1_760_000_000_012
export const DEVUELTO_MAL_MS = 1_760_000_000_077

/** Pregunta extra del doble reto de `para` ese día. */
export function extraChallenge(de: string, para: string, dia: number, extra: Partial<ChallengeEvent> = {}): ChallengeEvent {
  return challenge(de, para, dia, { id: `${para}_${dia}_2`, preguntaId: `h2-${para}-${dia}`, extra: true, ...extra })
}
