import { getCard, type CardId } from '../../game/cards'
import { CardFrame } from './CardFrame'
import { ORO, ORO_CLARO } from './palette'
import { CARD_SYMBOLS } from './symbols'

interface Props {
  card: CardId
  className?: string
}

/** Cara de un arcano: numeral romano arriba, símbolo al centro y nombre abajo. */
export function TarotCard({ card, className }: Props) {
  const def = getCard(card)
  const Symbol = CARD_SYMBOLS[card]
  const nombre = def.nombre.toUpperCase()
  const largo = nombre.length > 16

  return (
    <CardFrame titulo={`${def.nombre}: ${def.categoria}`} className={className}>
      {/* numeral */}
      <path d="M62 52H84M116 52H138" stroke={ORO} strokeWidth={0.8} />
      <circle cx={60} cy={52} r={1.5} fill={ORO} />
      <circle cx={140} cy={52} r={1.5} fill={ORO} />
      <text
        x={100}
        y={58}
        textAnchor="middle"
        className="font-display"
        fontWeight={700}
        fontSize={20}
        fill={ORO_CLARO}
        letterSpacing={2}
      >
        {def.numeral}
      </text>

      {/* símbolo central */}
      <g transform="translate(40 110) scale(1.2)">
        <Symbol />
      </g>

      {/* cartela con el nombre */}
      <path d="M24 262H176L184 277L176 292H24L16 277Z" fill="#0B0A10" fillOpacity={0.55} stroke={ORO} strokeWidth={1.2} />
      <text
        x={100}
        y={281.5}
        textAnchor="middle"
        className="font-display"
        fontWeight={600}
        fontSize={largo ? 10 : 13}
        fill={ORO_CLARO}
        letterSpacing={largo ? 0.4 : 1.5}
        {...(largo ? { textLength: 150, lengthAdjust: 'spacingAndGlyphs' as const } : {})}
      >
        {nombre}
      </text>
      <text
        x={100}
        y={310}
        textAnchor="middle"
        className="font-sans"
        fontSize={8}
        fill={ORO}
        fillOpacity={0.85}
        letterSpacing={1}
        {...(def.categoria.length > 18 ? { textLength: 116, lengthAdjust: 'spacingAndGlyphs' as const } : {})}
      >
        {def.categoria.toUpperCase()}
      </text>
    </CardFrame>
  )
}
