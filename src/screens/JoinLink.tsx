import { Navigate, useParams } from 'react-router-dom'
import { isValidGroupCode, normalizeGroupCode } from '../game/codes'
import { setPendingJoin } from '../state/pendingJoin'

/** /unirse/:code (enlace o QR): guarda el código y sigue el flujo normal (perfil → unirse). */
export function JoinLink() {
  const { code = '' } = useParams()
  const limpio = normalizeGroupCode(code)
  // Se guarda antes de redirigir para que la guardia lo vea en el primer render (es idempotente).
  if (isValidGroupCode(limpio)) setPendingJoin(limpio)
  return <Navigate to="/" replace />
}
