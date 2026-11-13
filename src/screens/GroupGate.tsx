import { useState, type FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { ErrorText, Field } from '../components/ui/Field'
import { OrnateFrame } from '../components/ui/OrnateFrame'
import { AvatarIcon } from '../components/tarot/AvatarIcon'
import { CODE_LENGTH, isValidGroupCode, normalizeGroupCode } from '../game/codes'
import { NOMBRE_GRUPO_MAX, validateGroupName } from '../game/validation'
import { friendlyError } from '../services/errors'
import { claimAdmin, createGroup, joinGroup } from '../services/groups'
import { useGame } from '../state/GameContext'
import { clearPendingJoin, getPendingJoin } from '../state/pendingJoin'
import { QuickMatchBanner } from './quick/QuickMatchBanner'

/** Crear un grupo o unirse con un código (o con el enlace/QR). */
export function GroupGate() {
  const { profile, online } = useGame()
  const pendiente = getPendingJoin()
  const [codigo, setCodigo] = useState(pendiente ?? '')
  const [nombre, setNombre] = useState('')
  const [adminJuega, setAdminJuega] = useState(true)
  const [errorUnir, setErrorUnir] = useState<string | null>(null)
  const [errorCrear, setErrorCrear] = useState<string | null>(null)
  const [uniendo, setUniendo] = useState(false)
  const [creando, setCreando] = useState(false)
  const [tocadoNombre, setTocadoNombre] = useState(false)

  if (!profile) return null
  const cambiando = !!profile.grupoActual

  const unir = async (e: FormEvent) => {
    e.preventDefault()
    const code = normalizeGroupCode(codigo)
    if (!isValidGroupCode(code)) {
      setErrorUnir(`El código tiene ${CODE_LENGTH} caracteres: letras y números (sin 0, O, 1 ni I).`)
      return
    }
    setUniendo(true)
    setErrorUnir(null)
    try {
      await joinGroup(profile, code)
      clearPendingJoin()
    } catch (err) {
      setErrorUnir(friendlyError(err))
      setUniendo(false)
    }
  }

  const crear = async (e: FormEvent) => {
    e.preventDefault()
    setTocadoNombre(true)
    if (validateGroupName(nombre)) return
    setCreando(true)
    setErrorCrear(null)
    try {
      await createGroup(profile, { nombre, adminJuega })
      clearPendingJoin()
    } catch (err) {
      setErrorCrear(friendlyError(err))
      setCreando(false)
    }
  }

  const cancelarCambio = () => {
    clearPendingJoin()
    window.location.assign('/')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col justify-center gap-6 px-4 py-10">
      <header className="flex items-center gap-4">
        <AvatarIcon avatar={profile.avatar} size={56} decorative />
        <div>
          <p className="text-sm text-niebla">Hola,</p>
          <h1 className="texto-oro text-3xl font-bold">{profile.apodo}</h1>
        </div>
      </header>

      <QuickMatchBanner sinGrupo />

      {cambiando && pendiente && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <p>
            Te invitaron al grupo <strong className="text-oro-claro">{pendiente}</strong>. Al unirte saldrás de tu grupo actual (
            {profile.grupoActual}).
          </p>
          <Button variant="fantasma" onClick={cancelarCambio}>
            Quedarme donde estoy
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <OrnateFrame as="section" title="Unirme a un grupo">
          <form onSubmit={unir} className="flex flex-col gap-4" noValidate>
            <Field
              label="Código del grupo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              maxLength={CODE_LENGTH + 2}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="A7K2Q"
              className="text-center font-display text-3xl tracking-[0.4em] uppercase"
              hint="Pídeselo a quien creó el grupo, o escanea su QR."
              autoFocus={!!pendiente}
            />
            <ErrorText>{errorUnir}</ErrorText>
            <Button type="submit" size="lg" loading={uniendo} disabled={!online}>
              Unirme
            </Button>
          </form>
        </OrnateFrame>

        <OrnateFrame as="section" title="Crear un grupo">
          <form onSubmit={crear} className="flex flex-col gap-4" noValidate>
            <Field
              label="Nombre del grupo"
              value={nombre}
              maxLength={NOMBRE_GRUPO_MAX}
              placeholder="Ej.: Los Arcanos del Stand 12"
              onChange={(e) => setNombre(e.target.value)}
              onBlur={() => setTocadoNombre(true)}
              error={tocadoNombre ? validateGroupName(nombre) : null}
              hint="Serás quien administre la semana."
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-oro/20 p-3 text-sm">
              <input
                type="checkbox"
                checked={adminJuega}
                onChange={(e) => setAdminJuega(e.target.checked)}
                className="mt-0.5 size-5 accent-[#D4AF37]"
              />
              <span>
                También voy a jugar desde este dispositivo
                <span className="mt-1 block text-xs text-niebla">
                  Desmárcalo si este dispositivo será la pantalla de presentación de la exposición.
                </span>
              </span>
            </label>
            <ErrorText>{errorCrear}</ErrorText>
            <Button type="submit" size="lg" variant="violeta" loading={creando} disabled={!online}>
              Crear grupo
            </Button>
          </form>
        </OrnateFrame>
      </div>
      <AdministrarGrupo />
      {!online && <p className="text-center text-sm text-error">Necesitas conexión para crear o unirte a un grupo.</p>}
    </main>
  )
}

/** Sumarse como co-administrador (sin jugar) con el código y la clave de administración. */
function AdministrarGrupo() {
  const { profile, online } = useGame()
  const [codigo, setCodigo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  if (!profile) return null

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await claimAdmin(profile, codigo, clave)
      clearPendingJoin()
    } catch (err) {
      setError(friendlyError(err))
      setEnviando(false)
    }
  }

  return (
    <details className="panel p-5">
      <summary className="cursor-pointer font-display text-oro-claro">
        ¿Organizas un grupo que se creó en otro dispositivo? Adminístralo desde aquí
      </summary>
      <form onSubmit={enviar} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <Field
          label="Código del grupo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          maxLength={CODE_LENGTH + 2}
          autoComplete="off"
          spellCheck={false}
          className="font-display tracking-[0.3em] uppercase"
        />
        <Field
          label="Clave de administración"
          value={clave}
          onChange={(e) => setClave(e.target.value.toUpperCase())}
          maxLength={10}
          autoComplete="off"
          spellCheck={false}
          className="font-display tracking-[0.2em] uppercase"
        />
        <Button type="submit" variant="fantasma" loading={enviando} disabled={!online}>
          Administrar
        </Button>
        <p className="text-xs text-niebla sm:col-span-3">
          La clave la ve quien creó el grupo (en su panel o en la app Android). Este dispositivo administrará el grupo sin jugar:
          ideal para la PC con el modo presentación.
        </p>
        <div className="sm:col-span-3">
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </details>
  )
}
