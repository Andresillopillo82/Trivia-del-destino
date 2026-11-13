import { Link } from 'react-router-dom'
import { CeremonyView } from '../components/game/CeremonyView'
import { OrnateFrame } from '../components/ui/OrnateFrame'
import { awardTitles } from '../game/titles'
import { useGame } from '../state/GameContext'

/** Pantalla de la ceremonia final (solo cuando la semana terminó). */
export function Ceremony() {
  const { group, seasonOver, standings } = useGame()
  if (!group) return null

  if (!seasonOver) {
    return (
      <OrnateFrame className="text-center">
        <p className="mb-4">La ceremonia llega al terminar la semana. ¡Las cartas siguen hablando!</p>
        <Link to="/" className="text-oro-claro underline underline-offset-4">
          Volver al inicio
        </Link>
      </OrnateFrame>
    )
  }

  return (
    <div className="flex flex-col gap-8 py-4">
      <CeremonyView titles={awardTitles(standings)} standings={standings} nombreGrupo={group.nombre} />
      <Link to="/clasificacion" className="self-center text-oro-claro underline underline-offset-4">
        Ver la clasificación final
      </Link>
    </div>
  )
}
