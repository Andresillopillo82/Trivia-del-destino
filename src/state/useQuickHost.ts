import { useEffect, useMemo, useRef } from 'react'
import { BOT_PROFILES } from '../game/bots'
import { QUESTIONS } from '../game/questionBank'
import { botProgress, simulateQuickBot } from '../game/quick/bots'
import { playersOfRound, shouldFinish, type QuickPlayer, type QuickRoom } from '../game/quick/room'
import { serverNow } from '../services/clock'
import { finishQuickRoom, resetQuickPlayer, syncQuickProgress } from '../services/quick'

/** Los bots empiezan tras la misma cuenta atrás 3-2-1 que los jugadores. */
const CUENTA_MS = 3000

/**
 * Tareas del anfitrión (su dispositivo debe seguir abierto): simular los bots, cerrar la partida
 * cuando todos terminaron o se alcanzó el límite global, y reiniciar los bots en la revancha.
 */
export function useQuickHost(room: QuickRoom | null | undefined, players: QuickPlayer[], isHost: boolean) {
  const bots = useMemo(() => players.filter((p) => p.esBot), [players])
  const enviado = useRef(new Map<string, string>())
  const cerrando = useRef<string | null>(null)
  const ultimoEnvio = useRef(0)

  const playing = isHost && room?.status === 'playing' && room.startedAtMs !== null
  const clave = room ? `${room.code}:${room.round}` : ''

  // Partidas de los bots: deterministas con la semilla de la ronda.
  const runs = useMemo(() => {
    if (!playing || !room) return []
    return playersOfRound(room, bots).map((b) => {
      const perfil = BOT_PROFILES.find((p) => p.uid === b.uid)
      return perfil ? simulateQuickBot(perfil, room.seed, QUESTIONS, room.config, room.evitar) : null
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, clave, bots.map((b) => `${b.uid}:${b.round}`).join(',')])

  const roomRef = useRef(room)
  roomRef.current = room
  const playersRef = useRef(players)
  playersRef.current = players

  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => {
      const r = roomRef.current
      if (!r || r.status !== 'playing' || r.startedAtMs === null) return
      const ahora = serverNow()
      const elapsed = ahora - r.startedAtMs - CUENTA_MS
      const forzar = ahora - ultimoEnvio.current >= r.config.syncEveryMs
      for (const run of runs) {
        if (!run) continue
        const p = botProgress(run, elapsed)
        const firma = `${r.round}:${p.correctas}:${p.falladas}:${p.finished}`
        const antes = enviado.current.get(run.uid)
        // Igual que un jugador: como mucho cada syncEveryMs, y siempre al terminar.
        if (antes === firma || (!forzar && !(p.finished && !antes?.endsWith('true')))) continue
        enviado.current.set(run.uid, firma)
        void syncQuickProgress(r.code, run.uid, r.round, p).catch(() => enviado.current.delete(run.uid))
      }
      if (forzar) ultimoEnvio.current = ahora
      if (cerrando.current !== `${r.code}:${r.round}` && shouldFinish(r, playersRef.current, ahora)) {
        cerrando.current = `${r.code}:${r.round}`
        void finishQuickRoom(r.code).catch(() => {
          cerrando.current = null
        })
      }
    }, 500)
    return () => window.clearInterval(t)
  }, [playing, runs])

  // Revancha: los bots vuelven a cero en la ronda nueva.
  useEffect(() => {
    if (!isHost || !room || room.status !== 'lobby') return
    for (const b of bots) if (b.round !== room.round) void resetQuickPlayer(room.code, b.uid, room.round).catch(() => {})
  }, [isHost, room, bots])
}
