import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { GAME_CONFIG } from '../config/gameConfig'
import { AvatarIcon } from '../components/tarot/AvatarIcon'
import { ChallengeCard } from '../components/tarot/ChallengeCard'
import { Button } from '../components/ui/Button'
import { ErrorText } from '../components/ui/Field'
import { OrnateFrame } from '../components/ui/OrnateFrame'
import { canSendChallenge, eligibleTargets, pickChallengeQuestion, sentChallenge, unlockingAnswer } from '../game/challenges'
import { seenQuestionIds } from '../game/draw'
import { QUESTIONS } from '../game/questionBank'
import { sendChallenge } from '../services/challenges'
import { friendlyError } from '../services/errors'
import { useGame } from '../state/GameContext'

/** Elegir a un compañero y lanzarle una pregunta difícil (se desbloquea al acertar la del día). */
export function SendChallenge() {
  const { group, uid, day, players, answers, challenges, standings, seasonOver, online } = useGame()
  const [elegido, setElegido] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!group || !uid) return null
  const c = GAME_CONFIG

  // Reto ya lanzado hoy: confirmación.
  const reto = sentChallenge(uid, day, challenges)
  if (reto) {
    const retado = players.find((p) => p.uid === reto.para)
    return (
      <OrnateFrame className="flex flex-col items-center gap-5 py-8 text-center">
        <motion.div initial={{ y: 40, rotate: -8, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} transition={{ type: 'spring' }}>
          <ChallengeCard className="w-40" />
        </motion.div>
        <h1 className="texto-oro text-2xl font-bold">Reto lanzado a {retado?.apodo ?? 'tu compañero'}</h1>
        <p className="text-niebla">
          {reto.estado === 'resuelto'
            ? reto.correcta
              ? `${retado?.apodo} acertó y se llevó +${c.puntosReto}.`
              : `¡${retado?.apodo} falló! Te llevas +${c.puntosReto}.`
            : `Si falla, te llevas +${c.puntosReto}; si acierta, se los lleva.`}
        </p>
        <Link to="/" className="text-oro-claro underline underline-offset-4">
          Volver al inicio
        </Link>
      </OrnateFrame>
    )
  }

  const llave = unlockingAnswer(uid, day, answers)
  if (seasonOver || !llave || !canSendChallenge(uid, day, answers)) {
    return (
      <OrnateFrame className="text-center">
        <p className="mb-4">El reto del día se desbloquea al acertar {c.aciertosParaRetar} preguntas.</p>
        <Link to="/" className="text-oro-claro underline underline-offset-4">
          Volver al inicio
        </Link>
      </OrnateFrame>
    )
  }

  const dia = day
  const elegibles = new Set(eligibleTargets(uid, players, challenges, dia).map((p) => p.uid))
  const candidatos = standings.filter((r) => r.uid !== uid)

  const lanzar = async () => {
    if (!elegido) return
    const q = pickChallengeQuestion(QUESTIONS, seenQuestionIds(elegido, answers, challenges), llave.carta, Math.random)
    if (!q) {
      setError('Esa persona ya respondió todas las preguntas difíciles. Elige a otra.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await sendChallenge(group.code, uid, elegido, dia, llave.n, q)
    } catch (e) {
      setError(friendlyError(e))
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center lg:text-left">
        <h1 className="texto-oro text-3xl font-bold">Lanza tu reto</h1>
        <p className="mt-1 text-niebla">
          Elige a quién enviarle una pregunta difícil. Si falla, +{c.puntosReto} para ti; si acierta, se los lleva.
        </p>
      </header>

      <OrnateFrame as="section">
        {candidatos.length === 0 ? (
          <p className="py-4 text-center text-niebla">Todavía no hay compañeros en el grupo. ¡Invita a alguien!</p>
        ) : (
          <div role="radiogroup" aria-label="Compañero a retar" className="flex flex-col gap-2">
            {candidatos.map((r) => {
              const disponible = elegibles.has(r.uid)
              const activo = elegido === r.uid
              return (
                <button
                  key={r.uid}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  disabled={!disponible}
                  onClick={() => setElegido(r.uid)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    activo ? 'border-oro bg-violeta/40 shadow-dorado' : 'border-oro/15 bg-noche-2/70 hover:border-oro/50'
                  }`}
                >
                  <AvatarIcon avatar={r.avatar} size={38} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {r.apodo}
                      {r.esBot && <span className="ml-2 rounded bg-noche-3 px-1.5 py-0.5 text-xs text-niebla">bot</span>}
                    </span>
                    <span className="text-xs text-niebla">
                      {disponible ? `${r.posicion}.º · ${r.puntos} pts` : 'Ya recibió su reto de hoy'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <div className="mt-5 flex flex-col gap-3">
          <ErrorText>{error}</ErrorText>
          <Button size="lg" onClick={lanzar} loading={enviando} disabled={!elegido || !online}>
            {elegido ? `Retar a ${players.find((p) => p.uid === elegido)?.apodo ?? ''}` : 'Elige a alguien'}
          </Button>
        </div>
      </OrnateFrame>
    </div>
  )
}
