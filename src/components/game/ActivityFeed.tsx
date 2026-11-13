import { AnimatePresence, motion } from 'framer-motion'
import { GAME_CONFIG } from '../../config/gameConfig'
import { getCard } from '../../game/cards'
import { devolucionExitosa, extraChallengeId, responsable, scoreChallenge, tipoReto } from '../../game/challenges'
import { dailyPoints } from '../../game/scoring'
import type { PlayerInfo } from '../../game/types'
import type { LiveAnswer, LiveChallenge } from '../../services/types'

interface Evento {
  id: string
  ms: number
  texto: string
  tono: 'oro' | 'acierto' | 'error' | 'reto'
}

/** Eventos recientes del grupo, derivados de respuestas y retos. */
export function buildFeed(players: PlayerInfo[], answers: LiveAnswer[], challenges: LiveChallenge[], max = 6): Evento[] {
  const nombre = (uid: string) => players.find((p) => p.uid === uid)?.apodo ?? 'Alguien'
  const eventos: Evento[] = []
  for (const a of answers) {
    if (a.estado !== 'cerrada' || a.respondidoEnMs === null) continue
    const carta = getCard(a.carta).nombre
    eventos.push(
      a.correcta
        ? { id: `a-${a.uid}-${a.dia}-${a.n}`, ms: a.respondidoEnMs, texto: `${nombre(a.uid)} acertó con ${carta} (+${dailyPoints(a)})`, tono: 'acierto' }
        : { id: `a-${a.uid}-${a.dia}-${a.n}`, ms: a.respondidoEnMs, texto: `${nombre(a.uid)} falló con ${carta}`, tono: 'error' },
    )
  }
  const porId = new Map(challenges.map((c) => [c.id, c]))
  for (const c of challenges) {
    if (!c.extra && c.creadoEnMs !== null) {
      eventos.push({ id: `c-${c.id}`, ms: c.creadoEnMs, texto: `${nombre(c.de)} retó a ${nombre(c.para)}`, tono: 'reto' })
    }
    if (!c.extra && c.devueltoEnMs !== null) {
      eventos.push({
        id: `d-${c.id}`,
        ms: c.devueltoEnMs,
        texto: devolucionExitosa(c.devueltoEnMs)
          ? `${nombre(c.para)} le devolvió el reto a ${nombre(c.de)} y la fortuna le sonrió`
          : `${nombre(c.para)} intentó devolver el reto y le tocó un doble reto`,
        tono: 'reto',
      })
    }
    if (c.estado === 'resuelto' && c.resueltoEnMs !== null) {
      const quien = nombre(responsable(c))
      if (!c.correcta) {
        eventos.push({ id: `r-${c.id}`, ms: c.resueltoEnMs, texto: `${quien} falló su reto (−${GAME_CONFIG.penalizacionReto})`, tono: 'error' })
      } else if (tipoReto(c) === 'devuelto') {
        eventos.push({ id: `r-${c.id}`, ms: c.resueltoEnMs, texto: `${quien} respondió bien el reto que le devolvieron`, tono: 'acierto' })
      }
    }
    // Quién se llevó el premio del reto (una vez por reto, cuando queda decidido).
    if (!c.extra) {
      const extra = porId.get(extraChallengeId(c.para, c.dia))
      const fin = Math.max(c.resueltoEnMs ?? 0, extra?.resueltoEnMs ?? 0)
      for (const s of scoreChallenge(c, extra, false)) {
        if (s.gano && fin > 0) {
          eventos.push({ id: `g-${c.id}`, ms: fin + 1, texto: `${nombre(s.uid)} ganó el reto (+${GAME_CONFIG.puntosReto})`, tono: 'oro' })
        }
      }
    }
  }
  return eventos.sort((a, b) => b.ms - a.ms).slice(0, max)
}

const TONOS = {
  oro: 'border-oro/50 text-oro-claro',
  acierto: 'border-acierto/40 text-acierto',
  error: 'border-error/30 text-niebla',
  reto: 'border-[#7A1838] text-pergamino',
}

export function ActivityFeed({ eventos, large = false }: { eventos: Evento[]; large?: boolean }) {
  if (eventos.length === 0) return <p className="text-niebla">Aquí aparecerá lo que pase en el grupo.</p>
  return (
    <ul className={`flex flex-col gap-2 ${large ? 'text-lg' : 'text-sm'}`} aria-live="polite">
      <AnimatePresence initial={false}>
        {eventos.map((e) => (
          <motion.li
            key={e.id}
            layout
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-lg border-l-4 bg-noche-2/70 px-3 py-2 ${TONOS[e.tono]}`}
          >
            {e.texto}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
