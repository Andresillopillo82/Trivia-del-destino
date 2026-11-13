import { CardFrame } from './CardFrame'
import { NOCHE, ORO_CLARO } from './palette'

interface Props {
  /** Apodo del campeón. */
  nombre: string
  className?: string
}

/** Carta dorada del "Dueño del Destino" para la ceremonia final. */
export function DestinyCard({ nombre, className }: Props) {
  const rayos = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2
    const r1 = 40
    const r2 = i % 2 === 0 ? 74 : 60
    return { x1: 100 + Math.cos(a) * r1, y1: 165 + Math.sin(a) * r1, x2: 100 + Math.cos(a) * r2, y2: 165 + Math.sin(a) * r2 }
  })
  const largo = nombre.length > 14

  return (
    <CardFrame titulo={`Dueño del Destino: ${nombre}`} fondo="#9C7C1F" className={className}>
      <text
        x={100}
        y={56}
        textAnchor="middle"
        className="font-display"
        fontWeight={700}
        fontSize={11}
        fill={ORO_CLARO}
        textLength={128}
        lengthAdjust="spacingAndGlyphs"
      >
        DUEÑO DEL DESTINO
      </text>
      <g stroke={ORO_CLARO} strokeWidth={2} strokeLinecap="round">
        {rayos.map((r, i) => (
          <line key={i} {...r} opacity={i % 2 === 0 ? 1 : 0.6} />
        ))}
      </g>
      <circle cx={100} cy={165} r={36} fill={NOCHE} fillOpacity={0.5} stroke={ORO_CLARO} strokeWidth={2} />
      {/* corona */}
      <path
        d="M76 178L80 148L91 162L100 140L109 162L120 148L124 178Z"
        fill={ORO_CLARO}
        stroke="#9C7C1F"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <rect x={76} y={178} width={48} height={7} rx={1.5} fill={ORO_CLARO} />
      {[80, 100, 120].map((x, i) => (
        <circle key={x} cx={x} cy={i === 1 ? 138 : 146} r={3} fill="#FFF6D6" />
      ))}
      <path d="M24 262H176L184 277L176 292H24L16 277Z" fill={NOCHE} fillOpacity={0.6} stroke={ORO_CLARO} strokeWidth={1.2} />
      <text
        x={100}
        y={281.5}
        textAnchor="middle"
        className="font-display"
        fontWeight={700}
        fontSize={largo ? 11 : 14}
        fill={ORO_CLARO}
        letterSpacing={1}
        {...(largo ? { textLength: 150, lengthAdjust: 'spacingAndGlyphs' as const } : {})}
      >
        {nombre.toUpperCase()}
      </text>
      <text x={100} y={310} textAnchor="middle" className="font-sans" fontSize={8} fill={ORO_CLARO} letterSpacing={1.5}>
        CAMPEÓN DE LA SEMANA
      </text>
    </CardFrame>
  )
}
