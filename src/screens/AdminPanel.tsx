import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GAME_CONFIG } from '../config/gameConfig'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ErrorText } from '../components/ui/Field'
import { OrnateFrame } from '../components/ui/OrnateFrame'
import { useHotkey } from '../hooks/useHotkey'
import { plural } from '../lib/format'
import { useGame } from '../state/GameContext'
import { useAdminActions } from '../state/useAdminActions'
import { readAdminKey } from '../services/groups'

/** Panel del administrador del grupo: control del día y modo demo. */
export function AdminPanel() {
  const { group, isAdmin, day, seasonOver, players, online } = useGame()
  const a = useAdminActions()
  const [confirmar, setConfirmar] = useState<'final' | 'reiniciar' | 'eliminar' | null>(null)

  useHotkey('n', a.avanzarDia, isAdmin && !seasonOver && online)

  // Solo quien creó el grupo puede leer la clave (los co-administradores no la ven).
  const [claveAdmin, setClaveAdmin] = useState<string | null>(null)
  const codigoGrupo = group?.code
  useEffect(() => {
    if (!codigoGrupo || !isAdmin) return
    readAdminKey(codigoGrupo).then(setClaveAdmin, () => setClaveAdmin(null))
  }, [codigoGrupo, isAdmin])

  if (!group) return null
  if (!isAdmin) {
    return (
      <OrnateFrame className="text-center">
        <p>Solo quien creó el grupo puede usar el panel de administrador.</p>
      </OrnateFrame>
    )
  }

  const humanos = players.filter((p) => !p.esBot).length
  const bots = players.length - humanos

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center lg:text-left">
        <h1 className="texto-oro text-3xl font-bold sm:text-4xl">Panel del administrador</h1>
        <p className="mt-1 text-niebla">{group.nombre}</p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Día', seasonOver ? 'Final' : `${day + 1} de ${GAME_CONFIG.diasTemporada}`],
          ['Desfase demo', `${group.dayOffset >= 0 ? '+' : ''}${plural(group.dayOffset, 'día')}`],
          ['Jugadores', String(humanos)],
          ['Bots', String(bots)],
        ].map(([k, v]) => (
          <div key={k} className="panel p-4 text-center">
            <dt className="text-xs tracking-widest text-niebla uppercase">{k}</dt>
            <dd className="mt-1 text-2xl font-semibold text-oro-claro">{v}</dd>
          </div>
        ))}
      </dl>

      <div aria-live="polite">
        {a.aviso && <p className="rounded-xl border border-acierto/50 bg-acierto/10 p-3 text-sm text-acierto">{a.aviso}</p>}
        <ErrorText>{a.error}</ErrorText>
      </div>

      <OrnateFrame as="section" title="Control del tiempo">
        <div className="flex flex-col items-center gap-3 text-center">
          <Button size="lg" onClick={a.avanzarDia} loading={a.ocupado === 'avanzar'} disabled={seasonOver || !online}>
            Avanzar día
          </Button>
          <p className="text-sm text-niebla">
            Atajo: tecla <kbd className="rounded border border-oro/40 px-1.5 py-0.5 font-mono text-oro-claro">N</kbd> (aquí y en el modo
            presentación). Todos los dispositivos ven el nuevo día al instante.
          </p>
          <Button variant="fantasma" onClick={() => setConfirmar('final')} loading={a.ocupado === 'final'} disabled={seasonOver || !online}>
            Saltar al final de la semana
          </Button>
        </div>
      </OrnateFrame>

      <OrnateFrame as="section" title="Jugadores simulados">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-niebla">
            {GAME_CONFIG.numBots} bots con distinta habilidad responden cada día, lanzan retos y responden los que reciben. Ideal para
            que la clasificación se vea viva aunque haya pocas personas.
          </p>
          <Button variant="violeta" onClick={a.anadirBots} loading={a.ocupado === 'bots'} disabled={a.hayBots || seasonOver || !online}>
            {a.hayBots ? 'Bots en juego' : 'Añadir jugadores simulados (bots)'}
          </Button>
        </div>
      </OrnateFrame>

      <OrnateFrame as="section" title="Pantalla de la exposición">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-niebla">Clasificación en vivo a pantalla completa, con el código y el QR para que la gente se una.</p>
          <Link
            to="/presentacion"
            className="inline-flex min-h-11 items-center rounded-xl bg-gradient-to-b from-oro-claro via-oro to-oro-oscuro px-5 font-display text-sm font-semibold tracking-wider text-noche uppercase"
          >
            Abrir modo presentación
          </Link>
        </div>
      </OrnateFrame>

      {claveAdmin && (
        <OrnateFrame as="section" title="Clave de administración">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="font-display text-3xl tracking-[0.3em] text-oro-claro">{claveAdmin}</p>
            <p className="text-sm text-niebla">
              Compártela solo con otros organizadores. Con el código {group.code} y esta clave, en «Administrar un grupo» podrán
              administrarlo desde otro dispositivo (por ejemplo, la PC del stand) sin jugar.
            </p>
          </div>
        </OrnateFrame>
      )}

      <OrnateFrame as="section" title="Zona peligrosa">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-niebla">Borra todas las respuestas, retos y bots, y empieza una temporada nueva desde hoy.</p>
          <Button variant="peligro" onClick={() => setConfirmar('reiniciar')} loading={a.ocupado === 'reiniciar'} disabled={!online}>
            Reiniciar grupo
          </Button>
          <p className="mt-3 text-sm text-niebla">Al terminar la exposición puedes eliminar el grupo y todos sus datos.</p>
          <Button variant="peligro" onClick={() => setConfirmar('eliminar')} loading={a.ocupado === 'eliminar'} disabled={!online}>
            Eliminar grupo
          </Button>
        </div>
      </OrnateFrame>

      <ConfirmDialog
        open={confirmar === 'final'}
        title="¿Saltar al final de la semana?"
        confirmLabel="Saltar al final"
        onConfirm={() => {
          setConfirmar(null)
          a.saltarAlFinal()
        }}
        onCancel={() => setConfirmar(null)}
      >
        Los bots jugarán los días que faltan y la temporada terminará. Los retos sin responder contarán como fallados. Todos verán la
        ceremonia del Dueño del Destino.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmar === 'reiniciar'}
        title="¿Reiniciar el grupo?"
        confirmLabel="Sí, reiniciar"
        danger
        onConfirm={() => {
          setConfirmar(null)
          a.reiniciar()
        }}
        onCancel={() => setConfirmar(null)}
      >
        Se borrarán todos los puntos, respuestas, retos y bots de «{group.nombre}». Los jugadores humanos seguirán en el grupo. Esta
        acción no se puede deshacer.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmar === 'eliminar'}
        title="¿Eliminar el grupo?"
        confirmLabel="Sí, eliminar"
        danger
        onConfirm={() => {
          setConfirmar(null)
          a.eliminar()
        }}
        onCancel={() => setConfirmar(null)}
      >
        Se borrará «{group.nombre}» con todos sus jugadores, respuestas y retos. El código {group.code} dejará de funcionar. Esta acción
        no se puede deshacer.
      </ConfirmDialog>
    </div>
  )
}
