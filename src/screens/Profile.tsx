import { useState, type FormEvent } from 'react'
import { AvatarPicker } from '../components/game/AvatarPicker'
import { GroupCodeCard } from '../components/game/GroupCodeCard'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ErrorText, Field } from '../components/ui/Field'
import { OrnateFrame } from '../components/ui/OrnateFrame'
import type { AvatarId } from '../game/avatars'
import { APODO_MAX, validateApodo } from '../game/validation'
import { friendlyError } from '../services/errors'
import { leaveGroup } from '../services/groups'
import { saveProfile } from '../services/users'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { useGame } from '../state/GameContext'

export function Profile() {
  const { profile, group, isAdmin, online } = useGame()
  const [apodo, setApodo] = useState(profile?.apodo ?? '')
  const [avatar, setAvatar] = useState<AvatarId>(profile?.avatar ?? 'estrella')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const instalacion = useInstallPrompt()

  if (!profile || !group) return null
  const cambios = apodo.trim() !== profile.apodo || avatar !== profile.avatar

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    const err = validateApodo(apodo)
    if (err) {
      setError(err)
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await saveProfile(profile.uid, { apodo, avatar }, profile.grupoActual)
      setGuardado(true)
      window.setTimeout(() => setGuardado(false), 2500)
    } catch (e2) {
      setError(friendlyError(e2))
    } finally {
      setGuardando(false)
    }
  }

  const salir = async () => {
    setSaliendo(true)
    try {
      await leaveGroup(profile)
    } catch (e) {
      setError(friendlyError(e))
      setSaliendo(false)
      setConfirmarSalida(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="texto-oro text-center text-3xl font-bold lg:text-left">Tu perfil</h1>

      <OrnateFrame as="section" title="Apodo y símbolo">
        <form onSubmit={guardar} className="flex flex-col gap-5" noValidate>
          <Field label="Apodo" value={apodo} maxLength={APODO_MAX} onChange={(e) => setApodo(e.target.value)} />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Símbolo</legend>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </fieldset>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={guardando} disabled={!cambios || !online}>
            {guardado ? '¡Guardado!' : 'Guardar cambios'}
          </Button>
        </form>
      </OrnateFrame>

      <OrnateFrame as="section" title={group.nombre}>
        <GroupCodeCard code={group.code} nombre={group.nombre} />
        <div className="mt-6 flex flex-col items-center gap-2 border-t border-oro/15 pt-5 text-center">
          {isAdmin && <p className="text-sm text-niebla">Eres quien administra este grupo.</p>}
          <Button variant="peligro" onClick={() => setConfirmarSalida(true)} disabled={!online}>
            Salir del grupo
          </Button>
        </div>
      </OrnateFrame>

      {!instalacion.instalada && (instalacion.puedeInstalar || instalacion.esIos) && (
        <OrnateFrame as="section" title="Instalar la app">
          <div className="flex flex-col items-center gap-3 text-center text-sm text-niebla">
            {instalacion.puedeInstalar ? (
              <>
                <p>Ten la Trivia del Destino en tu pantalla de inicio, como una app más.</p>
                <Button onClick={() => void instalacion.instalar()}>Instalar en este dispositivo</Button>
              </>
            ) : (
              <p>
                En iPhone o iPad: abre esta página en Safari, toca <strong className="text-pergamino">Compartir</strong> y luego{' '}
                <strong className="text-pergamino">Añadir a pantalla de inicio</strong>.
              </p>
            )}
          </div>
        </OrnateFrame>
      )}

      <ConfirmDialog
        open={confirmarSalida}
        title="¿Salir del grupo?"
        confirmLabel="Salir"
        danger
        loading={saliendo}
        onConfirm={salir}
        onCancel={() => setConfirmarSalida(false)}
      >
        Dejarás de aparecer en la clasificación de «{group.nombre}». Podrás volver con el código {group.code}, pero empezarás sin
        puntos.
        {isAdmin && ' Seguirás siendo su administrador.'}
      </ConfirmDialog>
    </div>
  )
}
