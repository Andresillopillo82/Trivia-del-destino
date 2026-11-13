import type { ReactElement } from 'react'
import type { CardId } from '../../game/cards'
import { ORO, ORO_CLARO, VIOLETA_CLARO } from './palette'

/**
 * Símbolos centrales de cada arcano, dibujados en una caja de 100×100.
 * Son composiciones geométricas originales (no reproducen ningún mazo existente).
 */

const trazo = {
  fill: 'none',
  stroke: ORO,
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const fino = { ...trazo, strokeWidth: 1.2 } as const

function Destello({ x, y, r = 3 }: { x: number; y: number; r?: number }) {
  return (
    <path
      d={`M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z`}
      fill={ORO_CLARO}
    />
  )
}

function Rayos({ cx, cy, r1, r2, n }: { cx: number; cy: number; r1: number; r2: number; n: number }) {
  return (
    <g {...fino}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * r1}
            y1={cy + Math.sin(a) * r1}
            x2={cx + Math.cos(a) * r2}
            y2={cy + Math.sin(a) * r2}
          />
        )
      })}
    </g>
  )
}

/** Hojas a lo largo de un arco (para laureles y espigas). */
function Hojas({
  cx,
  cy,
  rx,
  ry,
  desde,
  hasta,
  n,
  largo = 7,
}: {
  cx: number
  cy: number
  rx: number
  ry: number
  desde: number
  hasta: number
  n: number
  largo?: number
}) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const t = desde + ((hasta - desde) * i) / (n - 1)
        const x = cx + Math.cos(t) * rx
        const y = cy + Math.sin(t) * ry
        const ang = (t * 180) / Math.PI + (hasta > desde ? 90 : -90) + 25
        return (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx={largo / 2}
            ry={largo / 5}
            transform={`rotate(${ang} ${x} ${y})`}
            fill={ORO}
            opacity={0.9}
          />
        )
      })}
    </g>
  )
}

function Corazon({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <path
      d={`M${x} ${y + s * 0.9}C${x - s * 1.4} ${y} ${x - s * 0.9} ${y - s} ${x} ${y - s * 0.35}C${x + s * 0.9} ${y - s} ${x + s * 1.4} ${y} ${x} ${y + s * 0.9}Z`}
      {...trazo}
    />
  )
}

function Loco() {
  return (
    <g>
      {/* sol naciente */}
      <circle cx={70} cy={24} r={9} {...trazo} fill={ORO} fillOpacity={0.25} />
      <Rayos cx={70} cy={24} r1={13} r2={19} n={12} />
      {/* precipicio */}
      <path d="M6 94V72H42L50 94" {...trazo} />
      <path d="M14 80h8M28 86h10" {...fino} />
      {/* bastón con hatillo */}
      <path d="M26 72L52 30" {...trazo} />
      <circle cx={55} cy={27} r={6.5} {...trazo} fill={ORO} fillOpacity={0.2} />
      <path d="M50 24l10 6" {...fino} />
      {/* símbolos que flotan: el número como aventura */}
      <path d="M78 52v10M73 57h10" {...fino} />
      <path d="M84 74l7 7M91 74l-7 7" {...fino} />
      <circle cx={70} cy={88} r={1.3} fill={ORO} />
      <circle cx={70} cy={80} r={1.3} fill={ORO} />
      <path d="M65 84h10" {...fino} />
      <Destello x={14} y={20} />
      <Destello x={34} y={10} r={2} />
    </g>
  )
}

function Mago() {
  return (
    <g>
      {/* lemniscata */}
      <path
        d="M34 14C34 6 46 6 50 14C54 22 66 22 66 14C66 6 54 6 50 14C46 22 34 22 34 14Z"
        {...trazo}
      />
      {/* varita */}
      <path d="M50 28V92" {...trazo} strokeWidth={3} />
      <circle cx={50} cy={28} r={3.5} fill={ORO_CLARO} />
      <circle cx={50} cy={92} r={3} fill={ORO} />
      {/* órbitas atómicas */}
      <g {...fino} stroke={ORO_CLARO}>
        <ellipse cx={50} cy={58} rx={30} ry={10} />
        <ellipse cx={50} cy={58} rx={30} ry={10} transform="rotate(60 50 58)" />
        <ellipse cx={50} cy={58} rx={30} ry={10} transform="rotate(-60 50 58)" />
      </g>
      <circle cx={50} cy={58} r={5} fill={VIOLETA_CLARO} stroke={ORO} strokeWidth={1.5} />
      <circle cx={80} cy={58} r={2} fill={ORO_CLARO} />
      <circle cx={35} cy={32} r={2} fill={ORO_CLARO} />
      <Destello x={12} y={84} />
      <Destello x={88} y={30} r={2.5} />
    </g>
  )
}

function Sacerdotisa() {
  return (
    <g>
      {/* columnas */}
      {[10, 80].map((x) => (
        <g key={x}>
          <rect x={x} y={26} width={10} height={64} {...trazo} />
          <path d={`M${x - 3} 26h16M${x - 3} 90h16`} {...trazo} />
          <path d={`M${x + 5} 32v52`} {...fino} />
        </g>
      ))}
      {/* luna creciente */}
      <path d="M58 10A15 15 0 1 0 58 38A11 11 0 1 1 58 10Z" {...trazo} fill={ORO} fillOpacity={0.3} />
      {/* libro abierto */}
      <path d="M28 70Q39 64 50 70Q61 64 72 70V88Q61 82 50 88Q39 82 28 88Z" {...trazo} />
      <path d="M50 70V88" {...fino} />
      <path d="M33 74q7-3 13 0M33 79q7-3 13 0M54 74q7-3 13 0M54 79q7-3 13 0" {...fino} />
      {/* velo */}
      <path d="M26 46Q50 56 74 46" {...fino} strokeDasharray="2 3" />
      <Destello x={50} y={52} r={2.5} />
    </g>
  )
}

function Emperatriz() {
  return (
    <g>
      {/* símbolo de Venus */}
      <circle cx={50} cy={34} r={15} {...trazo} fill={ORO} fillOpacity={0.15} />
      <path d="M50 49V82M39 66H61" {...trazo} strokeWidth={3} />
      {/* espigas */}
      <path d="M18 94Q24 62 20 30" {...trazo} />
      <path d="M82 94Q76 62 80 30" {...trazo} />
      {[34, 44, 54, 64, 74].map((y, i) => (
        <g key={y}>
          <ellipse cx={15} cy={y} rx={4.5} ry={1.8} transform={`rotate(-35 15 ${y})`} fill={ORO} />
          <ellipse cx={26} cy={y + 2} rx={4.5} ry={1.8} transform={`rotate(35 26 ${y + 2})`} fill={ORO} opacity={i === 4 ? 0.6 : 1} />
          <ellipse cx={85} cy={y} rx={4.5} ry={1.8} transform={`rotate(35 85 ${y})`} fill={ORO} />
          <ellipse cx={74} cy={y + 2} rx={4.5} ry={1.8} transform={`rotate(-35 74 ${y + 2})`} fill={ORO} opacity={i === 4 ? 0.6 : 1} />
        </g>
      ))}
      {/* brote */}
      <path d="M50 94V86M50 88Q42 84 40 78Q48 78 50 86M50 88Q58 84 60 78Q52 78 50 86" {...fino} />
      <circle cx={50} cy={34} r={3} fill={ORO_CLARO} />
    </g>
  )
}

function Emperador() {
  return (
    <g>
      {/* corona */}
      <path d="M28 34L32 14L42 25L50 8L58 25L68 14L72 34Z" {...trazo} fill={ORO} fillOpacity={0.25} />
      <path d="M28 34H72" {...trazo} />
      <circle cx={50} cy={8} r={2} fill={ORO_CLARO} />
      {/* trono */}
      <path d="M26 44H74V94H26Z" {...trazo} />
      <path d="M32 50H68V88H32Z" {...fino} />
      {/* volutas de carnero */}
      <path d="M26 44c-8 0-10-10-3-11c5 0 5 6 1 6" {...fino} />
      <path d="M74 44c8 0 10-10 3-11c-5 0-5 6-1 6" {...fino} />
      {/* orbe */}
      <circle cx={50} cy={72} r={9} {...trazo} fill={VIOLETA_CLARO} fillOpacity={0.35} />
      <path d="M50 63V55M46 58H54" {...trazo} />
      <path d="M41 72H59" {...fino} />
    </g>
  )
}

function Enamorados() {
  return (
    <g>
      {/* resplandor superior */}
      <circle cx={50} cy={18} r={8} {...trazo} fill={ORO} fillOpacity={0.3} />
      <Rayos cx={50} cy={18} r1={12} r2={18} n={16} />
      {/* corazones entrelazados */}
      <Corazon x={40} y={60} s={16} />
      <Corazon x={60} y={60} s={16} />
      {/* nota musical y cinta de cine */}
      <path d="M14 84V70l10-3v14" {...fino} />
      <ellipse cx={12} cy={84} rx={3} ry={2.2} fill={ORO} />
      <ellipse cx={22} cy={81} rx={3} ry={2.2} fill={ORO} />
      <rect x={72} y={68} width={18} height={20} rx={1.5} {...fino} />
      <path d="M75 68v20M87 68v20M75 78h12" {...fino} />
      <Destello x={50} y={84} r={2.5} />
    </g>
  )
}

function Carro() {
  return (
    <g>
      {/* dosel estrellado */}
      <path d="M22 36Q50 12 78 36" {...trazo} />
      <path d="M26 36V58M74 36V58" {...trazo} />
      <Destello x={50} y={27} r={4} />
      <Destello x={38} y={31} r={2} />
      <Destello x={62} y={31} r={2} />
      {/* caja del carro */}
      <path d="M20 54H80V74H20Z" {...trazo} fill={VIOLETA_CLARO} fillOpacity={0.2} />
      <path d="M40 64H60" {...fino} />
      <path d="M50 58V70" {...fino} />
      {/* ruedas */}
      {[30, 70].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={82} r={11} {...trazo} />
          <circle cx={cx} cy={82} r={2.5} fill={ORO} />
          <Rayos cx={cx} cy={82} r1={3} r2={11} n={8} />
        </g>
      ))}
      {/* laurel de victoria */}
      <Hojas cx={50} cy={50} rx={46} ry={46} desde={Math.PI * 0.62} hasta={Math.PI * 0.92} n={4} />
      <Hojas cx={50} cy={50} rx={46} ry={46} desde={Math.PI * 0.38} hasta={Math.PI * 0.08} n={4} />
    </g>
  )
}

function Ermitano() {
  return (
    <g>
      {/* montañas */}
      <path d="M4 94L26 72L38 82L58 62L96 94" {...trazo} />
      <path d="M58 62L52 72L60 70L66 76" {...fino} />
      {/* bastón */}
      <path d="M78 14V94" {...trazo} strokeWidth={3} />
      <path d="M78 22H62V30" {...trazo} />
      {/* farol */}
      <circle cx={62} cy={46} r={18} fill={ORO} fillOpacity={0.12} />
      <path d="M54 30H70L68 34H56Z" {...trazo} />
      <path d="M55 34L52 56H72L69 34" {...trazo} />
      <path d="M52 56H72L70 60H54Z" {...trazo} />
      {/* estrella de seis puntas */}
      <path d="M62 38L67 47H57Z" fill={ORO_CLARO} />
      <path d="M62 50L57 41H67Z" fill={ORO_CLARO} opacity={0.85} />
      <Destello x={20} y={26} r={2.5} />
      <Destello x={34} y={14} r={1.8} />
      <Destello x={12} y={48} r={1.5} />
    </g>
  )
}

function Rueda() {
  return (
    <g>
      <circle cx={50} cy={52} r={36} {...trazo} />
      <circle cx={50} cy={52} r={28} {...fino} />
      <circle cx={50} cy={52} r={13} {...trazo} fill={VIOLETA_CLARO} fillOpacity={0.25} />
      <Rayos cx={50} cy={52} r1={13} r2={36} n={8} />
      <circle cx={50} cy={52} r={4} fill={ORO_CLARO} />
      {/* marcas del borde: cruceta, botones, estrella, corazón */}
      <path d="M50 18v8M46 22h8" {...fino} />
      <circle cx={80} cy={50} r={1.6} fill={ORO} />
      <circle cx={84} cy={54} r={1.6} fill={ORO} />
      <Destello x={50} y={84} r={3} />
      <path d="M18 49l2-2 2 2-2 4z" fill={ORO} />
      {[45, 135, 225, 315].map((deg) => {
        const a = (deg * Math.PI) / 180
        return <circle key={deg} cx={50 + Math.cos(a) * 32} cy={52 + Math.sin(a) * 32} r={1.6} fill={ORO_CLARO} />
      })}
    </g>
  )
}

function Mundo() {
  return (
    <g>
      {/* corona de laurel */}
      <Hojas cx={50} cy={52} rx={34} ry={42} desde={Math.PI * 0.55} hasta={Math.PI * 1.45} n={10} largo={9} />
      <Hojas cx={50} cy={52} rx={34} ry={42} desde={Math.PI * 0.45} hasta={-Math.PI * 0.45} n={10} largo={9} />
      {/* cintas */}
      <path d="M45 6l10 8M55 6l-10 8" {...fino} />
      <path d="M45 90l10 8M55 90l-10 8" {...fino} />
      {/* globo terráqueo */}
      <circle cx={50} cy={52} r={20} {...trazo} fill={VIOLETA_CLARO} fillOpacity={0.2} />
      <g {...fino}>
        <ellipse cx={50} cy={52} rx={9} ry={20} />
        <path d="M30 52H70M33 42H67M33 62H67M50 32V72" />
      </g>
      <Destello x={10} y={10} r={2.5} />
      <Destello x={90} y={10} r={2.5} />
      <Destello x={10} y={94} r={2.5} />
      <Destello x={90} y={94} r={2.5} />
    </g>
  )
}

export const CARD_SYMBOLS: Record<CardId, () => ReactElement> = {
  loco: Loco,
  mago: Mago,
  sacerdotisa: Sacerdotisa,
  emperatriz: Emperatriz,
  emperador: Emperador,
  enamorados: Enamorados,
  carro: Carro,
  ermitano: Ermitano,
  rueda: Rueda,
  mundo: Mundo,
}
