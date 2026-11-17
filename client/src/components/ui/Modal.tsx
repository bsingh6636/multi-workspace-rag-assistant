import { useEffect, useId, useRef, type ReactNode } from 'react'
import { XIcon } from '@primer/octicons-react'

type Props = {
  title: string
  onClose: () => void
  /** While true (a request is running) the dialog can't be closed. */
  busy?: boolean
  /** Use the red header style for destructive dialogs. */
  danger?: boolean
  children: ReactNode
}

// A modal built on the native <dialog> element: it traps focus, puts the rest
// of the page behind a backdrop and closes on Esc. Clicking the backdrop does
// NOT close it, so a half-typed name isn't lost by a stray click.
// The parent mounts it to open it and unmounts it to close it.
export default function Modal({ title, onClose, busy = false, danger = false, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      // Esc fires "cancel". Let the parent decide, and ignore it while busy.
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
    >
      <header className={danger ? 'modal-header danger' : 'modal-header'}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="btn-octicon" aria-label="Close" onClick={onClose} disabled={busy}>
          <XIcon />
        </button>
      </header>
      {children}
    </dialog>
  )
}
