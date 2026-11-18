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
          {/* Red, not yellow: this is the one action in the app that can't be reversed. */}
          <div className="flash flash-error delete-warning">
            <AlertIcon />
            <div>
              <p className="delete-warning-title">This can't be undone.</p>
              <p>
                Deleting <strong>{workspace.name}</strong> permanently removes everything in it:
              </p>
              <ul>
                <li>All documents and their search index</li>
                <li>All chats and messages</li>
                <li>All tasks and the tool-call log</li>
              </ul>
            </div>
          </div>
          <label className="form-label" htmlFor="confirm-name">
            To confirm, type <code className="confirm-name">{workspace.name}</code> below
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
