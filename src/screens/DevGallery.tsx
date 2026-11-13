import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CARDS, type CardId } from '../game/cards'
import { AVATARS } from '../game/avatars'
import { TarotCard } from '../components/tarot/TarotCard'
import { CardBack } from '../components/tarot/CardBack'
import { ChallengeCard } from '../components/tarot/ChallengeCard'
import { FlipCard } from '../components/tarot/FlipCard'
import { Deck } from '../components/tarot/Deck'
import { AvatarIcon } from '../components/tarot/AvatarIcon'
import { Button } from '../components/ui/Button'
import { OrnateFrame, OrnateTitle } from '../components/ui/OrnateFrame'

type Fase = 'mazo' | 'barajando' | 'revelada'

/**
 * Galería temporal de la fase (a) para revisar el tema visual.
 * Se reemplaza por el flujo real en la fase (d).
 */
export function DevGallery() {
  const [fase, setFase] = useState<Fase>('mazo')
  const [carta, setCarta] = useState<CardId>('loco')

  const revelar = () => {
    const elegida = CARDS[Math.floor(Math.random() * CARDS.length)]!.id
    setCarta(elegida)
    setFase('barajando')
    window.setTimeout(() => setFase('revelada'), 1600)
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10 text-center">
        <p className="mb-2 text-xs tracking-[0.35em] text-niebla uppercase">Galería del tema · fase (a)</p>
        <h1 className="texto-oro text-4xl font-bold sm:text-6xl">Trivia del Destino</h1>
        <p className="mt-3 text-niebla">Revela tu carta. Responde. Conviértete en Dueño del Destino.</p>
      </header>

      <OrnateFrame as="section" className="mb-10" title="Revelar mi destino">
        <div className="flex flex-col items-center gap-6">
          <div className="relative h-80 w-48 sm:h-96 sm:w-56">
            <AnimatePresence mode="wait">
              {fase === 'revelada' ? (
                <motion.div
                  key="carta"
                  className="absolute inset-0"
                  initial={{ y: -20, scale: 0.92 }}
                  animate={{ y: 0, scale: 1 }}
                >
                  <FlipCard
                    className="h-full w-full"
                    revealed
                    back={<CardBack className="h-full w-full" />}
                    front={<TarotCard card={carta} className="h-full w-full" />}
                  />
                </motion.div>
              ) : (
                <motion.div key="mazo" className="absolute inset-0" exit={{ opacity: 0, scale: 0.95 }}>
                  <Deck shuffling={fase === 'barajando'} className="h-full" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div aria-live="polite" className="sr-only">
            {fase === 'revelada' ? `Carta revelada: ${CARDS.find((c) => c.id === carta)?.nombre}` : ''}
          </div>
          {fase === 'revelada' ? (
            <Button variant="fantasma" onClick={() => setFase('mazo')}>
              Volver al mazo
            </Button>
          ) : (
            <Button size="lg" onClick={revelar} loading={fase === 'barajando'}>
              Revelar mi destino
            </Button>
          )}
        </div>
      </OrnateFrame>

      <OrnateTitle>Los diez arcanos</OrnateTitle>
      <ul className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {CARDS.map((c) => (
          <li key={c.id}>
            <TarotCard card={c.id} className="w-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]" />
          </li>
        ))}
      </ul>

      <div className="mb-12 grid gap-6 sm:grid-cols-2">
        <OrnateFrame title="Reverso y Carta de Reto">
          <div className="flex justify-center gap-4">
            <CardBack className="w-36" />
            <ChallengeCard de="Luna Errante" className="w-36" />
          </div>
        </OrnateFrame>
        <OrnateFrame title="Avatares">
          <ul className="grid grid-cols-5 gap-3">
            {AVATARS.map((a) => (
              <li key={a.id} className="flex flex-col items-center gap-1 text-xs text-niebla">
                <AvatarIcon avatar={a.id} size={52} decorative />
                {a.nombre}
              </li>
            ))}
          </ul>
        </OrnateFrame>
      </div>

      <OrnateFrame title="Botones y estados">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button>Primario</Button>
          <Button variant="violeta">Secundario</Button>
          <Button variant="fantasma">Fantasma</Button>
          <Button variant="peligro">Reiniciar grupo</Button>
          <Button loading>Cargando</Button>
          <Button disabled>Deshabilitado</Button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <p className="rounded-xl border border-acierto/50 bg-acierto/10 p-3 text-acierto">¡Correcto! +10 puntos</p>
          <p className="rounded-xl border border-error/50 bg-error/10 p-3 text-error">Incorrecto. La respuesta era…</p>
        </div>
      </OrnateFrame>
    </main>
  )
}
