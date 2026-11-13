import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface Props {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Diálogo modal nativo (<dialog>): atrapa el foco y se cierra con Escape. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-oro/40 bg-noche-2 p-6 text-pergamino backdrop:bg-noche/80 backdrop:backdrop-blur-sm"
    >
      <h2 id="confirm-title" className="mb-3 text-xl text-oro-claro">
        {title}
      </h2>
      <div className="mb-6 text-sm text-niebla">{children}</div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="fantasma" onClick={onCancel} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'peligro' : 'oro'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
