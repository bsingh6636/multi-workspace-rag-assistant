import { useState } from 'react'
import { errorMessage } from '../lib/http'
import type { DocumentRow } from '../types'
import Modal from './ui/Modal'

type Props = {
  document: DocumentRow
  onConfirm: () => Promise<void>
  onClose: () => void
}

// Confirms deleting one document. Its chunks are removed with it, so it stops
// being used in answers straight away.
export default function DeleteDocumentDialog({ document, onConfirm, onClose }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm() // on success the parent closes the dialog
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Delete document" onClose={onClose} busy={busy} danger>
      <div className="modal-body">
        {error && (
          <p className="flash flash-error" role="alert">
            {error}
          </p>
        )}
        <p>
          Delete <strong>{document.filename}</strong>? Its {document.chunk_count} chunks are removed too, and the
          assistant will stop using it in answers.
        </p>
      </div>
      <footer className="modal-footer">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={busy} autoFocus>
          {busy ? 'Deleting…' : 'Delete document'}
        </button>
      </footer>
    </Modal>
  )
}
