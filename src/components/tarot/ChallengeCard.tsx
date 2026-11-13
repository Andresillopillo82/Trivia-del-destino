import { CardFrame } from './CardFrame'
import { ORO, ORO_CLARO } from './palette'

const CARMESI = '#7A1838'

interface Props {
  /** Apodo de quien lanza el reto. */
  de?: string
  className?: string
}

/** Carta de Reto: fondo carmesí y espadas cruzadas, distinta del mazo normal. */
export function ChallengeCard({ de, className }: Props) {
  return (
    <CardFrame titulo={de ? `Carta de Reto de ${de}` : 'Carta de Reto'} fondo={CARMESI} className={className}>
      <text
        x={100}
        y={58}
        textAnchor="middle"
        className="font-display"
        fontWeight={700}
        fontSize={18}
        fill={ORO_CLARO}
        letterSpacing={4}
      >
        RETO
      </text>

      {/* espadas cruzadas */}
      <g fill="none" stroke={ORO} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {[-1, 1].map((s) => (
          <g key={s} transform={`rotate(${s * 38} 100 172)`}>
            <path d="M100 96L106 108V214H94V108Z" fill={ORO} fillOpacity={0.15} />
            <path d="M100 112V206" strokeWidth={0.9} />
            <path d="M80 214H120" />
            <path d="M100 216V238" strokeWidth={3.2} />
            <circle cx={100} cy={243} r={4.5} fill={ORO} />
          </g>
        ))}
      </g>

      {/* llama */}
      <path
        d="M100 132C112 148 116 160 110 172C108 162 104 160 102 158C104 170 98 178 92 180C88 170 90 154 100 132Z"
        fill={ORO_CLARO}
        fillOpacity={0.85}
      />

      <path d="M24 262H176L184 277L176 292H24L16 277Z" fill="#0B0A10" fillOpacity={0.55} stroke={ORO} strokeWidth={1.2} />
      <text
        x={100}
        y={281.5}
        textAnchor="middle"
        className="font-display"
        fontWeight={600}
        fontSize={11}
        fill={ORO_CLARO}
        letterSpacing={1}
        {...(de && de.length > 14 ? { textLength: 150, lengthAdjust: 'spacingAndGlyphs' as const } : {})}
      >
        {de ? `DE ${de.toUpperCase()}` : 'CARTA DE RETO'}
      </text>
      <text x={100} y={310} textAnchor="middle" className="font-sans" fontSize={8.5} fill={ORO} letterSpacing={1}>
        PREGUNTA DIFÍCIL
      </text>
    </CardFrame>
  )
}
