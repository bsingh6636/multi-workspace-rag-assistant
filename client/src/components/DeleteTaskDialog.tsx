import { useState } from 'react'
import { errorMessage } from '../lib/http'
import type { Task } from '../types'
import Modal from './ui/Modal'

type Props = {
  task: Task
  onConfirm: () => Promise<void>
  onClose: () => void
}

// Confirms deleting one task. Deleting only happens here, never from the chat:
// the assistant has no delete tool (docs/plans/task-actions.md).
export default function DeleteTaskDialog({ task, onConfirm, onClose }: Props) {
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
    <Modal title="Delete task" onClose={onClose} busy={busy} danger>
      <div className="modal-body">
        {error && (
          <p className="flash flash-error" role="alert">
            {error}
          </p>
        )}
        <p>
          Delete <strong>{task.title}</strong>? This can't be undone. To keep it but take it off your list, mark it done
          instead.
        </p>
      </div>
      <footer className="modal-footer">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={busy} autoFocus>
          {busy ? 'Deleting…' : 'Delete task'}
        </button>
      </footer>
    </Modal>
  )
}
