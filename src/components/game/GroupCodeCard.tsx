import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { joinUrl } from '../../services/groups'
import { Button } from '../ui/Button'

interface Props {
  code: string
  nombre: string
  /** Muestra el QR (para que otros escaneen). */
  showQr?: boolean
  large?: boolean
}

/** Código del grupo con QR y botones para copiar o compartir el enlace. */
export function GroupCodeCard({ code, nombre, showQr = true, large = false }: Props) {
  const url = joinUrl(code)
  const [qr, setQr] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!showQr) return
    QRCode.toDataURL(url, { margin: 1, width: large ? 480 : 240, color: { dark: '#0B0A10', light: '#F1D77A' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [url, showQr, large])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  const compartir = () => {
    void navigator.share?.({ title: 'Trivia del Destino', text: `Únete a «${nombre}» con el código ${code}`, url }).catch(() => {})
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-xs tracking-[0.3em] text-niebla uppercase">Código del grupo</p>
      <p
        className={`texto-oro font-display font-bold tracking-[0.25em] ${large ? 'text-7xl' : 'text-5xl'}`}
        aria-label={`Código: ${code.split('').join(' ')}`}
      >
        {code}
      </p>
      {showQr && qr && (
        <img
          src={qr}
          alt={`Código QR para unirse al grupo ${nombre}`}
          className={`rounded-xl ring-2 ring-oro/60 ${large ? 'size-64' : 'size-40'}`}
        />
      )}
      {!large && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="fantasma" onClick={copiar}>
            {copiado ? '¡Enlace copiado!' : 'Copiar enlace'}
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button variant="fantasma" onClick={compartir}>
              Compartir
            </Button>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {copiado ? 'Enlace copiado al portapapeles' : ''}
      </span>
    </div>
  )
}
