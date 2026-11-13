import { useEffect, useRef } from 'react'
import { GAME_CONFIG } from '../config/gameConfig'
import { planBotDay, resolveBotChallenge } from '../game/bots'
import { isRequired, responsable } from '../game/challenges'
import { QUESTIONS, QUESTIONS_BY_ID } from '../game/questionBank'
import { seededRng } from '../game/rng'
import { awardTitles } from '../game/titles'
import { applyBotPlan, finalizeSeason, resolveBotChallengeDoc } from '../services/admin'
import { useGame } from './GameContext'

/** Retraso para que los bots "piensen" antes de jugar o responder un reto. */
const PAUSA_BOTS_MS = 1_500

/**
 * Tareas que ejecuta solo el cliente del administrador mientras está abierto:
 * - los bots juegan sus cartas del día (también al añadirlos o al avanzar el día);
 * - los bots responden los retos que les tocan: los que les lanzan y los que les devuelven;
 * - al terminar la semana, se registran el campeón y los títulos.
 * Todo es idempotente: si se repite, las transacciones no duplican nada.
 */
export function AdminAutomation() {
  const { group, players, answers, challenges, day, seasonOver, standings, online, groupLoaded } = useGame()
  const jugado = useRef(new Set<string>())
  const resolviendo = useRef(new Set<string>())
  const finalizando = useRef<string | null>(null)

  const code = group?.code
  const temporada = group?.temporada

  // Bots: cartas del día.
  useEffect(() => {
    if (!code || !groupLoaded || !online || seasonOver) return
    const bots = players.filter((p) => p.esBot)
    if (bots.length === 0) return
    const faltan = bots.some((b) => answers.filter((a) => a.uid === b.uid && a.dia === day).length < GAME_CONFIG.preguntasPorDia)
    const clave = `${code}-${temporada}-${day}-${bots.length}`
    if (!faltan || jugado.current.has(clave)) return
    const t = window.setTimeout(() => {
      jugado.current.add(clave)
      const plan = planBotDay({
        dia: day,
        players,
        answers,
        challenges,
        questions: QUESTIONS,
        rng: seededRng(`${code}-${temporada}-${day}`),
      })
      applyBotPlan(code, plan).catch((e: unknown) => {
        jugado.current.delete(clave)
        console.warn('Los bots no pudieron jugar', e)
      })
    }, PAUSA_BOTS_MS)
    return () => window.clearTimeout(t)
  }, [code, temporada, day, players, answers, challenges, seasonOver, online, groupLoaded])

  // Bots: preguntas de reto que les tocan (recibidas o devueltas). Los temporizadores solo se cancelan al desmontar
  // (si se cancelaran en cada cambio de datos, el reto quedaría marcado y nunca se respondería).
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  useEffect(() => {
    if (!code || !online) return
    for (const c of challenges) {
      const bot = players.find((p) => p.uid === responsable(c) && p.esBot)
      if (!bot || c.estado === 'resuelto' || !isRequired(c, challenges) || resolviendo.current.has(c.id)) continue
      resolviendo.current.add(c.id)
      const espera = PAUSA_BOTS_MS + Math.random() * 3_000
      timers.current.push(
        window.setTimeout(() => {
          const resuelto = resolveBotChallenge(c, bot, QUESTIONS_BY_ID, seededRng(`${code}-reto-${c.id}`))
          resolveBotChallengeDoc(code, resuelto).catch((e: unknown) => {
            resolviendo.current.delete(c.id)
            console.warn('Un bot no pudo responder su reto', e)
          })
        }, espera),
      )
    }
  }, [code, challenges, players, online])

  // Cierre de temporada.
  useEffect(() => {
    if (!code || !group || !groupLoaded || !seasonOver || group.estado !== 'activo') return
    const clave = `${code}-${temporada}`
    if (finalizando.current === clave) return
    finalizando.current = clave
    finalizeSeason(code, awardTitles(standings)).catch((e: unknown) => {
      finalizando.current = null
      console.warn('No se pudo cerrar la temporada', e)
    })
  }, [code, group, temporada, seasonOver, standings, groupLoaded])

  return null
}
