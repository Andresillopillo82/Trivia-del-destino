import { CardFrame } from './CardFrame'
import { ORO, ORO_CLARO, VIOLETA, VIOLETA_CLARO } from './palette'

/** Reverso del mazo: mandala dorado con un ojo central. */
export function CardBack({ className }: { className?: string }) {
  const puntas = 8
  const estrella = Array.from({ length: puntas * 2 }, (_, i) => {
    const a = (i / (puntas * 2)) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? 46 : 20
    return `${100 + Math.cos(a) * r},${170 + Math.sin(a) * r}`
  }).join(' ')

  return (
    <CardFrame titulo="Carta boca abajo" fondo={VIOLETA} className={className}>
      {/* celosía de rombos */}
      <g stroke={ORO} strokeOpacity={0.14} strokeWidth={0.7}>
        {Array.from({ length: 13 }, (_, i) => (
          <path key={`a${i}`} d={`M${-80 + i * 30} 20L${120 + i * 30} 320`} />
        ))}
        {Array.from({ length: 13 }, (_, i) => (
          <path key={`b${i}`} d={`M${280 - i * 30} 20L${80 - i * 30} 320`} />
        ))}
      </g>
      <rect x={20} y={20} width={160} height={300} rx={4} fill="none" stroke={ORO} strokeOpacity={0.4} strokeWidth={0.8} />

      {/* mandala */}
      <circle cx={100} cy={170} r={70} fill={VIOLETA} fillOpacity={0.6} stroke={ORO} strokeWidth={1.6} />
      <circle cx={100} cy={170} r={62} fill="none" stroke={ORO} strokeOpacity={0.6} strokeWidth={0.8} strokeDasharray="1 4" />
      <polygon points={estrella} fill={ORO} fillOpacity={0.12} stroke={ORO} strokeWidth={1.3} strokeLinejoin="round" />
      <circle cx={100} cy={170} r={22} fill="#0B0A10" stroke={ORO} strokeWidth={1.4} />

      {/* ojo */}
      <path d="M84 170Q100 156 116 170Q100 184 84 170Z" fill="none" stroke={ORO_CLARO} strokeWidth={1.4} />
      <circle cx={100} cy={170} r={5.5} fill={VIOLETA_CLARO} stroke={ORO_CLARO} strokeWidth={1} />
      <circle cx={100} cy={170} r={2} fill="#0B0A10" />

      {/* lunas arriba y abajo */}
      {[60, 280].map((y) => (
        <g key={y}>
          <circle cx={100} cy={y} r={9} fill="none" stroke={ORO} strokeWidth={1.2} />
          <path d={`M88 ${y}A12 12 0 0 1 76 ${y}`} fill="none" stroke={ORO} strokeWidth={1} />
          <path d={`M112 ${y}A12 12 0 0 0 124 ${y}`} fill="none" stroke={ORO} strokeWidth={1} />
          <circle cx={100} cy={y} r={2.5} fill={ORO_CLARO} />
        </g>
      ))}
    </CardFrame>
  )
}
