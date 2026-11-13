import { useCallback, useState } from 'react'
import { GAME_CONFIG } from '../config/gameConfig'
import { BOT_PROFILES, planBotDay } from '../game/bots'
import { offsetForDay } from '../game/day'
import { QUESTIONS } from '../game/questionBank'
import { seededRng } from '../game/rng'
import type { AnswerEvent, ChallengeEvent, PlayerInfo } from '../game/types'
import { addBots, applyBotPlan, deleteGroup, resetGroup, setDayOffset } from '../services/admin'
import { serverNow } from '../services/clock'
import { friendlyError } from '../services/errors'
import { useGame } from './GameContext'

type Accion = 'avanzar' | 'bots' | 'final' | 'reiniciar' | 'eliminar'

/** Acciones del panel de administrador, con estado de carga, error y aviso. */
export function useAdminActions() {
  const { group, profile, day, seasonOver, players, answers, challenges } = useGame()
  const [ocupado, setOcupado] = useState<Accion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const ejecutar = useCallback(
    async (accion: Accion, fn: () => Promise<string>) => {
      if (ocupado) return
      setOcupado(accion)
      setError(null)
      setAviso(null)
      try {
        setAviso(await fn())
      } catch (e) {
        setError(friendlyError(e))
      } finally {
        setOcupado(null)
      }
    },
    [ocupado],
  )

  const avanzarDia = useCallback(() => {
    if (!group || seasonOver) return
    void ejecutar('avanzar', async () => {
      await setDayOffset(group.code, group.dayOffset + 1)
      const nuevo = day + 1
      return nuevo >= GAME_CONFIG.diasTemporada
        ? 'La semana terminó: ¡que empiece la ceremonia!'
        : `Comienza el día ${nuevo + 1}. Todos los dispositivos ya lo ven.`
    })
  }, [group, seasonOver, day, ejecutar])

  const anadirBots = useCallback(() => {
    if (!group) return
    void ejecutar('bots', async () => {
      await addBots(group.code)
      return `Se unieron ${GAME_CONFIG.numBots} jugadores simulados. Responderán en unos segundos.`
    })
  }, [group, ejecutar])

  /** Los bots juegan los días que faltan y el grupo salta al final de la semana. */
  const saltarAlFinal = useCallback(() => {
    if (!group || seasonOver) return
    void ejecutar('final', async () => {
      let resp: AnswerEvent[] = [...answers]
      let retos: ChallengeEvent[] = [...challenges]
      const jugadores: PlayerInfo[] = players
      if (jugadores.some((p) => p.esBot)) {
        for (let d = day; d < GAME_CONFIG.diasTemporada; d++) {
          const plan = planBotDay({
            dia: d,
            players: jugadores,
            answers: resp,
            challenges: retos,
            questions: QUESTIONS,
            rng: seededRng(`${group.code}-${group.temporada}-${d}`),
          })
          await applyBotPlan(group.code, plan)
          resp = [...resp, ...plan.answers]
          const resueltos = new Map(plan.resolved.map((c) => [c.id, c]))
          retos = [...retos.map((c) => resueltos.get(c.id) ?? c), ...plan.newChallenges]
        }
      }
      await setDayOffset(group.code, offsetForDay(group.fechaInicioMs, serverNow(), GAME_CONFIG.diasTemporada))
      return 'Saltamos al final de la semana.'
    })
  }, [group, seasonOver, day, players, answers, challenges, ejecutar])

  const reiniciar = useCallback(() => {
    if (!group) return
    void ejecutar('reiniciar', async () => {
      await resetGroup(group)
      return 'Grupo reiniciado: nueva temporada desde hoy. Los jugadores humanos siguen en el grupo.'
    })
  }, [group, ejecutar])

  const eliminar = useCallback(() => {
    if (!group || !profile) return
    void ejecutar('eliminar', async () => {
      await deleteGroup(group, profile)
      return 'Grupo eliminado.'
    })
  }, [group, profile, ejecutar])

  const hayBots = players.some((p) => p.esBot)
  return { ocupado, error, aviso, avanzarDia, anadirBots, saltarAlFinal, reiniciar, eliminar, hayBots, totalBots: BOT_PROFILES.length }
}
