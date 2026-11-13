/** Valores de puntuación y tiempos del juego. Cambiarlos aquí afecta a toda la app. */
export interface GameConfig {
  /** Preguntas (cartas) que cada jugador responde por día. */
  preguntasPorDia: number
  /** Puntos por acertar una pregunta del día. */
  puntosCorrecta: number
  /** Bonus por acertar en menos de `umbralRapidezMs`. */
  bonoRapidez: number
  umbralRapidezMs: number
  /** Tiempo máximo para responder una pregunta (diaria o reto). */
  tiempoPreguntaMs: number
  /**
   * Pausa entre el registro de la pregunta en el servidor y el inicio del temporizador
   * (cuenta atrás de la carta). Debe coincidir con el margen de firestore.rules.
   */
  pausaRevelacionMs: number
  /** Comodines por día para cambiar la carta antes de ver la pregunta. */
  comodinesPorDia: number
  /** Aciertos del día necesarios para desbloquear el reto (uno por día). */
  aciertosParaRetar: number
  /** Puntos para quien gana un reto (el retado si acierta, el retador si el retado falla). */
  puntosReto: number
  /** Puntos que pierde quien falla una pregunta de reto (sin excepción). */
  penalizacionReto: number
  /**
   * Probabilidad (en %) de que devolver un reto salga bien. Se decide con los milisegundos de la
   * hora del servidor al devolver: `ms % 100 < porcentajeDevolucion`. firestore.rules usa el mismo valor.
   */
  porcentajeDevolucion: number
  /** Duración de la temporada en días. */
  diasTemporada: number
  /** Retos que un jugador puede recibir por día. */
  maxRetosRecibidosPorDia: number
  /** Bots que crea el modo demo. */
  numBots: number
  /** Partida Rápida (salas temporales por código, independientes de los grupos). */
  quickMatch: QuickMatchConfig
}

/** Tramo de dificultad: desde la pregunta `desde` (1-based), esta proporción es de nivel hard. */
export interface QuickDifficultyStep {
  desde: number
  hard: number
}

export interface QuickMatchConfig {
  /** Segundos iniciales del reloj de cada jugador. */
  startSeconds: number
  /** Segundos que suma un acierto. */
  correctBonus: number
  /** Segundos que resta un fallo. */
  wrongPenalty: number
  /** Techo del reloj (segundos restantes); `null` = sin techo. */
  maxSeconds: number | null
  /** Límite global desde el inicio: pasado este tiempo la partida termina aunque falte alguien. */
  hardTimeoutMs: number
  maxPlayers: number
  /** Bots que el anfitrión puede añadir. */
  maxBots: number
  /** Duración máxima del aviso de acierto/fallo (el reloj no se pausa). */
  feedbackMs: number
  /** Cada cuánto, como mucho, un jugador sube sus contadores durante la partida. */
  syncEveryMs: number
  /** La sala caduca a las 6 h de crearse (`expiresAt`). firestore.rules usa el mismo valor. */
  roomTtlMs: number
  /** Dificultad progresiva por número de pregunta (ordenada por `desde`, el primero con desde 1). */
  difficulty: readonly QuickDifficultyStep[]
}

export const GAME_CONFIG: GameConfig = {
  preguntasPorDia: 3,
  puntosCorrecta: 5,
  bonoRapidez: 2,
  umbralRapidezMs: 8_000,
  tiempoPreguntaMs: 20_000,
  pausaRevelacionMs: 3_000,
  comodinesPorDia: 1,
  aciertosParaRetar: 2,
  puntosReto: 10,
  penalizacionReto: 5,
  porcentajeDevolucion: 30,
  diasTemporada: 7,
  maxRetosRecibidosPorDia: 1,
  numBots: 6,
  quickMatch: {
    startSeconds: 45,
    correctBonus: 2,
    wrongPenalty: 2,
    maxSeconds: 60,
    hardTimeoutMs: 300_000,
    maxPlayers: 20,
    maxBots: 6,
    feedbackMs: 250,
    syncEveryMs: 5_000,
    roomTtlMs: 6 * 60 * 60 * 1000,
    difficulty: [
      { desde: 1, hard: 0 },
      { desde: 6, hard: 0.25 },
      { desde: 11, hard: 0.5 },
      { desde: 16, hard: 0.75 },
      { desde: 21, hard: 1 },
    ],
  },
}
