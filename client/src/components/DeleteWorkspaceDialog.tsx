import { useState, type FormEvent } from 'react'
import { AlertIcon } from '@primer/octicons-react'
import { errorMessage } from '../lib/http'
import type { Workspace } from '../types'
import Modal from './ui/Modal'

type Props = {
  workspace: Workspace
  onConfirm: () => Promise<void>
  onClose: () => void
}

// Like GitHub's "delete repository": the user types the workspace name to
// unlock the red button, because the delete removes everything inside it.
export default function DeleteWorkspaceDialog({ workspace, onConfirm, onClose }: Props) {
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const matches = typed === workspace.name

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!matches) return
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
    <Modal title={`Delete ${workspace.name}`} onClose={onClose} busy={busy} danger>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {error && (
            <p className="flash flash-error" role="alert">
              {error}
            </p>
          )}
          <p className="flash flash-warn">
            <AlertIcon />
            <span>
              This permanently deletes the workspace with all its documents, chats, tasks and tool-call history. It
              can't be undone.
            </span>
          </p>
          <label className="form-label" htmlFor="confirm-name">
            To confirm, type “{workspace.name}” below
          </label>
          <input
            id="confirm-name"
            className="form-control"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
          />
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy || !matches}>
            {busy ? 'Deleting…' : 'Delete this workspace'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
