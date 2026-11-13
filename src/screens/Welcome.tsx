import { useState, type FormEvent } from 'react'
import { AvatarPicker } from '../components/game/AvatarPicker'
import { CardBack } from '../components/tarot/CardBack'
import { TarotCard } from '../components/tarot/TarotCard'
import { Button } from '../components/ui/Button'
import { ErrorText, Field } from '../components/ui/Field'
import { OrnateFrame } from '../components/ui/OrnateFrame'
import type { AvatarId } from '../game/avatars'
import { APODO_MAX, validateApodo } from '../game/validation'
import { friendlyError } from '../services/errors'
import { saveProfile } from '../services/users'
import { useGame } from '../state/GameContext'

/** Bienvenida: sin registro, solo apodo y avatar. */
export function Welcome() {
  const { uid, online } = useGame()
  const [apodo, setApodo] = useState('')
  const [avatar, setAvatar] = useState<AvatarId>('estrella')
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const errorApodo = tocado ? validateApodo(apodo) : null

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setTocado(true)
    if (!uid || validateApodo(apodo)) return
    setEnviando(true)
    setError(null)
    try {
      await saveProfile(uid, { apodo, avatar }, null)
    } catch (err) {
      setError(friendlyError(err))
      setEnviando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-8 px-4 py-10 lg:flex-row lg:gap-16">
      <div className="flex flex-col items-center text-center lg:flex-1">
        <div className="relative mb-6 h-44 w-56" aria-hidden>
          <CardBack className="absolute left-0 h-44 -rotate-12" />
          <TarotCard card="mundo" className="absolute left-1/2 h-44 -translate-x-1/2 drop-shadow-[0_10px_30px_rgba(212,175,55,0.25)]" />
          <CardBack className="absolute right-0 h-44 rotate-12" />
        </div>
        <h1 className="texto-oro text-4xl font-bold sm:text-5xl">Trivia del Destino</h1>
        <p className="mt-3 max-w-sm text-niebla">
          Cada día una carta del tarot elige tu pregunta. Acierta, reta a tus compañeros y conviértete en el{' '}
          <span className="text-oro-claro">Dueño del Destino</span>.
        </p>
      </div>

      <OrnateFrame as="section" className="w-full max-w-md lg:flex-1" title="¿Quién consulta las cartas?">
        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <Field
            label="Tu apodo"
            value={apodo}
            maxLength={APODO_MAX}
            autoComplete="nickname"
            placeholder="Ej.: Luna Errante"
            onChange={(e) => setApodo(e.target.value)}
            onBlur={() => setTocado(true)}
            error={errorApodo}
            hint="Así te verán en la clasificación. Sin registro ni contraseña."
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Tu símbolo</legend>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </fieldset>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" size="lg" loading={enviando} disabled={!online}>
            {online ? 'Entrar' : 'Sin conexión'}
          </Button>
        </form>
      </OrnateFrame>
    </main>
  )
}
