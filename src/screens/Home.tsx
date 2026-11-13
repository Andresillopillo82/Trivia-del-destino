import { Link, useNavigate } from 'react-router-dom'
import { GAME_CONFIG } from '../config/gameConfig'
import { GroupCodeCard } from '../components/game/GroupCodeCard'
import { Leaderboard } from '../components/game/Leaderboard'
import { ChallengeCard } from '../components/tarot/ChallengeCard'
import { CartasDelDia } from '../components/game/CartasDelDia'
import { Button } from '../components/ui/Button'
import { OrnateFrame } from '../components/ui/OrnateFrame'
import { canSendChallenge, sentChallenge, tipoReto } from '../game/challenges'
import { getCard } from '../game/cards'
import { msUntilNextDay } from '../game/day'
import { formatDuration } from '../lib/format'
import { useServerNow } from '../hooks/useServerNow'
import type { ChallengeEvent } from '../game/types'
import type { LiveChallenge } from '../services/types'
import { useGame } from '../state/GameContext'
import { QuickMatchBanner } from './quick/QuickMatchBanner'

export function Home() {
  const {
    group,
    profile,
    day,
    seasonOver,
    isPlayer,
    isAdmin,
    myTodayAnswers,
    canDrawCard,
    comodinDisponible,
    myPending,
    players,
    answers,
    challenges,
    standings,
    uid,
    online,
  } = useGame()
  const navigate = useNavigate()
  const now = useServerNow(30_000)
  if (!group || !profile) return null

  const faltan = formatDuration(msUntilNextDay(group.fechaInicioMs, now))
  const solo = players.filter((p) => !p.esBot).length <= 1
  const nombreDe = (id: string) => players.find((p) => p.uid === id)?.apodo ?? 'Alguien'
  const miReto = uid ? sentChallenge(uid, day, challenges) : undefined
  const enJuego = myTodayAnswers.find((a) => a.estado !== 'cerrada')
  const cerradas = myTodayAnswers.filter((a) => a.estado === 'cerrada')
  const jugadas = cerradas.length
  const ultimaJugada = cerradas.at(-1)
  const total = GAME_CONFIG.preguntasPorDia

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="dia-titulo" className="text-center lg:text-left">
        <h1 id="dia-titulo" className="texto-oro text-3xl font-bold sm:text-4xl">
          {seasonOver ? 'La temporada terminó' : `Día ${day + 1} de ${GAME_CONFIG.diasTemporada}`}
        </h1>
        <p className="mt-1 text-niebla">
          {seasonOver
            ? 'Las cartas ya hablaron.'
            : day + 1 < GAME_CONFIG.diasTemporada
              ? `El próximo día empieza en ${faltan}.`
              : `Último día: la temporada cierra en ${faltan}.`}
        </p>
        {seasonOver && (
          <Button size="lg" className="mt-4" onClick={() => navigate('/ceremonia')}>
            Ver la ceremonia
          </Button>
        )}
      </section>

      <QuickMatchBanner />

      {myPending.length > 0 && !seasonOver && (
        <OrnateFrame as="section" title="Retos pendientes" className="border-[#7A1838]/60">
          <ul className="flex flex-col gap-4">
            {myPending.map((c) => {
              const { titulo, detalle } = textoPendiente(c, nombreDe, day)
              return (
                <li key={c.id} className="flex items-center gap-4">
                  <ChallengeCard de={nombreDe(tipoReto(c) === 'devuelto' ? c.para : c.de)} className="w-20 shrink-0" />
                  <div>
                    <p className="font-semibold">{titulo}</p>
                    <p className="text-sm text-niebla">{detalle}</p>
                    <Button className="mt-3" onClick={() => navigate(`/reto/${c.id}`)} disabled={!online}>
                      {c.estado === 'abierto' ? 'Continuar el reto' : 'Responder reto'}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </OrnateFrame>
      )}

      {isPlayer && !seasonOver && (
        <OrnateFrame as="section" title="Tus cartas de hoy">
          <CartasDelDia answers={myTodayAnswers} className="mb-5" />
          <div className="flex flex-col items-center gap-3 text-center">
            {enJuego ? (
              <>
                <p>
                  {enJuego.estado === 'carta'
                    ? `Tu carta ${enJuego.n + 1} está volteada: ${getCard(enJuego.carta).nombre}. Decide si la juegas o usas el comodín.`
                    : '¡Tienes una pregunta en curso! El tiempo corre.'}
                </p>
                <Button size="lg" onClick={() => navigate('/jugar')}>
                  Continuar
                </Button>
              </>
            ) : canDrawCard ? (
              <>
                <Button size="lg" onClick={() => navigate('/jugar', { state: { revelar: true } })} disabled={!online}>
                  {!online ? 'Sin conexión' : jugadas === 0 ? 'Revelar mi destino' : `Sacar carta ${jugadas + 1} de ${total}`}
                </Button>
                <p className="text-sm text-niebla">
                  {total} cartas al día: +{GAME_CONFIG.puntosCorrecta} por acierto y +{GAME_CONFIG.bonoRapidez} si respondes en menos de{' '}
                  {GAME_CONFIG.umbralRapidezMs / 1000} s. Comodín: {comodinDisponible ? 'disponible' : 'ya usado hoy'}.
                </p>
              </>
            ) : jugadas >= total ? (
              <p className="text-niebla">Jugaste tus {total} cartas de hoy. Las próximas llegan en {faltan}.</p>
            ) : (
              <p className="text-niebla">Responde tu reto pendiente para sacar la siguiente carta.</p>
            )}
            {jugadas > 0 && (
              <Link to={`/jugar?n=${ultimaJugada?.n ?? 0}`} className="text-sm text-oro-claro underline underline-offset-4">
                Ver la última pregunta y su explicación
              </Link>
            )}
          </div>
          {!!uid && canSendChallenge(uid, day, answers) && (
            <div className="mt-5 flex flex-col items-center gap-2 border-t border-oro/15 pt-5 text-center">
              <p className="font-display text-lg text-oro-claro">¡Reto desbloqueado!</p>
              <p className="text-sm text-niebla">
                Llevas {GAME_CONFIG.aciertosParaRetar} aciertos hoy. Envía una pregunta difícil a alguien del grupo: si falla, +
                {GAME_CONFIG.puntosReto} para ti; si acierta, se los lleva.
              </p>
              <Button variant="violeta" onClick={() => navigate('/retar')}>
                Lanzar un reto
              </Button>
            </div>
          )}
          {miReto && (
            <p className="mt-5 border-t border-oro/15 pt-4 text-center text-sm text-niebla">{textoMiReto(miReto, nombreDe)}</p>
          )}
        </OrnateFrame>
      )}

      {isAdmin && !isPlayer && (
        <OrnateFrame as="section" title="Organizas este grupo">
          <p className="text-center text-niebla">
            Este dispositivo no juega: sirve para administrar el grupo y mostrar la clasificación en la pantalla de la exposición.
          </p>
        </OrnateFrame>
      )}

      {(solo || (isAdmin && !isPlayer)) && (
        <OrnateFrame as="section" title="Invita a tu grupo">
          <GroupCodeCard code={group.code} nombre={group.nombre} />
        </OrnateFrame>
      )}

      <OrnateFrame as="section" title="Clasificación" className="lg:hidden">
        <Leaderboard rows={standings} meUid={uid} limit={5} emptyText="Invita a tu grupo para empezar." />
        <Link to="/clasificacion" className="mt-4 block text-center text-sm text-oro-claro underline underline-offset-4">
          Ver clasificación completa
        </Link>
      </OrnateFrame>
    </div>
  )
}

/** Título y explicación de una pregunta de reto pendiente, según su tipo. */
function textoPendiente(c: LiveChallenge, nombreDe: (uid: string) => string, hoy: number): { titulo: string; detalle: string } {
  const cuando = c.dia < hoy ? ` (día ${c.dia + 1})` : ''
  const g = GAME_CONFIG
  switch (tipoReto(c)) {
    case 'reto':
      return {
        titulo: `${nombreDe(c.de)} te lanzó un reto${cuando}.`,
        detalle: `Es obligatorio antes de tu siguiente carta. Si aciertas +${g.puntosReto}; si fallas −${g.penalizacionReto}. También puedes devolverlo (${g.porcentajeDevolucion} % de éxito).`,
      }
    case 'devuelto':
      return {
        titulo: `${nombreDe(c.para)} te devolvió tu reto${cuando}.`,
        detalle: `Debes responderlo antes de tu siguiente carta: si aciertas no ganas nada; si fallas −${g.penalizacionReto}.`,
      }
    case 'doble':
      return {
        titulo: `Doble reto de ${nombreDe(c.de)}: pregunta 1 de 2${cuando}.`,
        detalle: `La devolución falló. +${g.puntosReto} si aciertas alguna de las dos; −${g.penalizacionReto} por cada fallo.`,
      }
    case 'extra':
      return {
        titulo: `Doble reto de ${nombreDe(c.de)}: pregunta 2 de 2${cuando}.`,
        detalle: `+${g.puntosReto} si aciertas alguna de las dos; −${g.penalizacionReto} por cada fallo.`,
      }
  }
}

/** Cómo va el reto que lancé hoy. */
function textoMiReto(c: ChallengeEvent, nombreDe: (uid: string) => string): string {
  const g = GAME_CONFIG
  const quien = nombreDe(c.para)
  switch (tipoReto(c)) {
    case 'reto':
      if (c.estado === 'devuelto') return `Retaste a ${quien} y te lo devolvió: la Rueda de la Fortuna decide…`
      if (c.estado !== 'resuelto') return `Retaste a ${quien}: aún no responde.`
      return c.correcta ? `Retaste a ${quien}: acertó y se llevó +${g.puntosReto}.` : `Retaste a ${quien}: ¡falló! Ganaste +${g.puntosReto}.`
    case 'devuelto':
      if (c.estado !== 'resuelto') return `${quien} te devolvió el reto y le salió bien: debes responderlo tú (sin premio; −${g.penalizacionReto} si fallas).`
      return c.correcta
        ? `${quien} te devolvió el reto y lo respondiste bien: nadie gana ni pierde.`
        : `${quien} te devolvió el reto y lo fallaste: −${g.penalizacionReto}.`
    default:
      return `${quien} intentó devolverte el reto y le salió mal: responde dos preguntas. Si falla las dos, ganas +${g.puntosReto}.`
  }
}
