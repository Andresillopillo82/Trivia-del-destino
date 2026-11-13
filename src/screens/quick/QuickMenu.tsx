import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ErrorText, Field } from '../../components/ui/Field'
import { OrnateFrame } from '../../components/ui/OrnateFrame'
import { GAME_CONFIG } from '../../config/gameConfig'
import { CODE_LENGTH, isValidGroupCode, normalizeGroupCode } from '../../game/codes'
import { friendlyError } from '../../services/errors'
import { createQuickRoom } from '../../services/quick'
import { useGame } from '../../state/GameContext'

/** Partida Rápida: crear una sala o unirse con un código. No hace falta estar en un grupo. */
export function QuickMenu() {
  const { uid, profile, online } = useGame()
  const navigate = useNavigate()
  const [hostPlays, setHostPlays] = useState(true)
  const [codigo, setCodigo] = useState('')
  const [errorCrear, setErrorCrear] = useState<string | null>(null)
  const [errorUnir, setErrorUnir] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const cfg = GAME_CONFIG.quickMatch

  if (!uid || !profile) return null

  const crear = async () => {
    setCreando(true)
    setErrorCrear(null)
    try {
      const code = await createQuickRoom({ uid, apodo: profile.apodo, avatar: profile.avatar }, hostPlays)
      navigate(`/rapida/${code}`)
    } catch (e) {
      setErrorCrear(friendlyError(e))
      setCreando(false)
    }
  }

  const unir = (e: FormEvent) => {
    e.preventDefault()
    const code = normalizeGroupCode(codigo)
    if (!isValidGroupCode(code)) {
      setErrorUnir(`El código tiene ${CODE_LENGTH} caracteres: letras y números (sin 0, O, 1 ni I).`)
      return
    }
    navigate(`/rapida/${code}`)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col justify-center gap-6 px-4 py-10">
      <header className="flex flex-col gap-2 text-center">
        <Link to="/" className="self-start text-sm text-niebla underline-offset-4 hover:underline">
          ← Inicio
        </Link>
        <h1 className="texto-oro text-4xl font-bold">Partida Rápida</h1>
        <p className="text-niebla">
          {cfg.startSeconds} segundos para cada uno. Acierto +{cfg.correctBonus} s, fallo −{cfg.wrongPenalty} s. Gana quien más acierte.
          Sin grupos ni clasificaciones: la sala desaparece al cerrarla.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        <OrnateFrame title="Crear sala" className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">¿Juegas tú también?</legend>
            {(
              [
                [true, 'Participo', 'Juegas desde este dispositivo.'],
                [false, 'Solo pantalla', 'Este dispositivo proyecta la sala; tú no juegas.'],
              ] as const
            ).map(([valor, titulo, texto]) => (
              <label key={titulo} className={`panel flex cursor-pointer items-start gap-3 p-3 ${hostPlays === valor ? 'ring-1 ring-oro' : ''}`}>
                <input type="radio" name="modo" checked={hostPlays === valor} onChange={() => setHostPlays(valor)} className="mt-1 accent-[#d4af37]" />
                <span>
                  <span className="block font-semibold">{titulo}</span>
                  <span className="text-sm text-niebla">{texto}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <ErrorText>{errorCrear}</ErrorText>
          <Button size="lg" onClick={crear} loading={creando} disabled={!online}>
            Crear sala
          </Button>
        </OrnateFrame>
        <OrnateFrame title="Unirme con código" className="flex flex-col gap-4">
          <form onSubmit={unir} className="flex flex-col gap-4" noValidate>
            <Field
              label="Código de la sala"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={8}
              placeholder="ABCDE"
              className="text-center font-display text-2xl tracking-[0.3em] uppercase"
              error={errorUnir}
            />
            <Button type="submit" size="lg" variant="violeta" disabled={!online}>
              Unirme
            </Button>
          </form>
          <p className="text-sm text-niebla">También puedes escanear el QR de la sala con la cámara.</p>
        </OrnateFrame>
      </div>
      {!online && <p className="text-center text-sm text-error">Sin conexión: la Partida Rápida necesita internet.</p>}
    </main>
  )
}
