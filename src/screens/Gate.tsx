import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { ErrorText } from '../components/ui/Field'
import { LoadingScreen, StatusScreen } from '../components/ui/StatusScreen'
import { friendlyError } from '../services/errors'
import { leaveGroup } from '../services/groups'
import { AdminAutomation } from '../state/AdminAutomation'
import { useGame } from '../state/GameContext'
import { clearPendingJoin, getPendingJoin } from '../state/pendingJoin'
import { GroupGate } from './GroupGate'
import { Welcome } from './Welcome'

/**
 * Sesión sin grupo: la usa la Partida Rápida (independiente de los grupos). Con `requireProfile`
 * pide antes apodo y avatar; la pantalla de sala para PC solo necesita la sesión anónima.
 */
export function SessionGate({ requireProfile = true }: { requireProfile?: boolean }) {
  const { profile } = useGame()
  const pantalla = useSessionScreen()
  if (pantalla) return pantalla
  if (requireProfile && profile === undefined) return <LoadingScreen />
  if (requireProfile && !profile) return <Welcome />
  return <Outlet />
}

function useSessionScreen() {
  const { status, sessionError, retrySession } = useGame()
  if (status === 'sin-configurar') {
    return (
      <StatusScreen title="Falta configurar Firebase">
        <p className="text-niebla">
          Copia <code className="text-oro-claro">.env.example</code> como <code className="text-oro-claro">.env</code>, rellénalo con
          la configuración de tu proyecto de Firebase y reinicia el servidor. Los pasos están en el README.
        </p>
      </StatusScreen>
    )
  }
  if (status === 'error') {
    return (
      <StatusScreen title="No pudimos conectar">
        <ErrorText>{sessionError}</ErrorText>
        <Button onClick={retrySession}>Reintentar</Button>
      </StatusScreen>
    )
  }
  if (status === 'conectando') return <LoadingScreen />
  return null
}

/** Decide qué mostrar según el estado de la sesión: perfil, grupo o la app (Modo Destino). */
export function Gate() {
  const { profile, group, groupError, groupLoaded, isAdmin } = useGame()
  const pantalla = useSessionScreen()
  if (pantalla) return pantalla
  if (profile === undefined) return <LoadingScreen />
  if (!profile) return <Welcome />

  const pendiente = getPendingJoin()
  if (pendiente && pendiente === profile.grupoActual) clearPendingJoin()
  if (!profile.grupoActual || (pendiente && pendiente !== profile.grupoActual)) return <GroupGate />
  if (groupError) return <GroupGone message={groupError} />
  if (!group || !groupLoaded) return <LoadingScreen text="Barajando el mazo…" />
  return (
    <>
      <Outlet />
      {isAdmin && <AdminAutomation />}
    </>
  )
}

function GroupGone({ message }: { message: string }) {
  const { profile } = useGame()
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const salir = async () => {
    if (!profile) return
    setCargando(true)
    try {
      await leaveGroup(profile)
    } catch (e) {
      // Si la ficha ya no existe, basta con limpiar el perfil.
      setError(friendlyError(e))
    } finally {
      setCargando(false)
    }
  }

  return (
    <StatusScreen title="El grupo no está disponible">
      <p className="text-niebla">{message}</p>
      <ErrorText>{error}</ErrorText>
      <Button onClick={salir} loading={cargando}>
        Elegir otro grupo
      </Button>
    </StatusScreen>
  )
}
