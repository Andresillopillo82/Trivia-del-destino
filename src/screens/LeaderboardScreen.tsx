import { GAME_CONFIG } from '../config/gameConfig'
import { Leaderboard } from '../components/game/Leaderboard'
import { OrnateFrame } from '../components/ui/OrnateFrame'
import { useGame } from '../state/GameContext'

/** Clasificación completa del grupo, en tiempo real. */
export function LeaderboardScreen() {
  const { standings, uid, group, seasonOver } = useGame()
  const c = GAME_CONFIG

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center lg:text-left">
        <h1 className="texto-oro text-3xl font-bold sm:text-4xl">Clasificación</h1>
        <p className="mt-1 text-niebla">
          {group?.nombre} · {seasonOver ? 'resultado final' : 'en vivo'}
        </p>
      </header>

      <OrnateFrame as="section">
        <Leaderboard rows={standings} meUid={uid} detailed emptyText="Todavía no hay jugadores en el grupo." />
      </OrnateFrame>

      <OrnateFrame as="section" title="Cómo se puntúa">
        <ul className="grid gap-2 text-sm text-niebla sm:grid-cols-2">
          <li>
            <strong className="text-pergamino">{c.preguntasPorDia} cartas al día</strong>: +{c.puntosCorrecta} por cada acierto
          </li>
          <li>
            <strong className="text-pergamino">+{c.bonoRapidez}</strong> extra si respondes en menos de {c.umbralRapidezMs / 1000} s
          </li>
          <li>
            <strong className="text-pergamino">Un comodín al día</strong> para cambiar la carta antes de ver la pregunta
          </li>
          <li>
            Con <strong className="text-pergamino">{c.aciertosParaRetar} aciertos</strong> en el día desbloqueas un reto (lanzarlo no da puntos)
          </li>
          <li>
            <strong className="text-pergamino">+{c.puntosReto}</strong> para quien gana el reto (el retado si acierta, el retador si falla)
          </li>
          <li>
            <strong className="text-pergamino">−{c.penalizacionReto}</strong> por cada pregunta de reto fallada, sin excepción
          </li>
          <li className="sm:col-span-2">
            Si te retan puedes <strong className="text-pergamino">devolverlo</strong>: {c.porcentajeDevolucion} % de éxito (lo responde quien
            te retó, sin premio). Si falla, respondes dos preguntas: +{c.puntosReto} si aciertas alguna y −{c.penalizacionReto} por cada fallo.
          </li>
        </ul>
        <p className="mt-4 text-xs text-niebla">
          Desempate: más aciertos y, después, menor tiempo promedio de respuesta. Al cerrar la semana, el primero recibe el título de{' '}
          <span className="text-oro-claro">Dueño del Destino</span>.
        </p>
      </OrnateFrame>
    </div>
  )
}
