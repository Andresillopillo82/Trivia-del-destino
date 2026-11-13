/**
 * Renderiza las ilustraciones de la web (componentes React) a SVG estático para convertirlas
 * en VectorDrawable de Android. Las usa scripts/export-android-art.mjs.
 *
 * VectorDrawable no admite <text>: se quita aquí y la app Android dibuja los textos
 * (numeral, nombre, categoría) con Compose y las mismas tipografías.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { AVATARS } from '../src/game/avatars'
import { CARDS } from '../src/game/cards'
import { AvatarIcon } from '../src/components/tarot/AvatarIcon'
import { CardBack } from '../src/components/tarot/CardBack'
import { ChallengeCard } from '../src/components/tarot/ChallengeCard'
import { DestinyCard } from '../src/components/tarot/DestinyCard'
import { TarotCard } from '../src/components/tarot/TarotCard'

function limpiar(svg: string): string {
  return svg
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<text[\s\S]*?<\/text>/g, '')
    .replace(/ (role|aria-label|aria-hidden|class)="[^"]*"/g, '')
}

function svg(el: ReactElement): string {
  return limpiar(renderToStaticMarkup(el))
}

/** Nombre de archivo (recurso Android) → SVG sin texto. */
export function exportarArte(): Record<string, string> {
  const arte: Record<string, string> = {
    carta_reverso: svg(<CardBack />),
    carta_reto: svg(<ChallengeCard />),
    carta_destino: svg(<DestinyCard nombre="" />),
  }
  for (const c of CARDS) arte[`carta_${c.id}`] = svg(<TarotCard card={c.id} />)
  for (const a of AVATARS) arte[`avatar_${a.id}`] = svg(<AvatarIcon avatar={a.id} />)
  return arte
}
