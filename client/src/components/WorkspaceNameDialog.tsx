import { useState, type FormEvent } from 'react'
import { errorMessage } from '../lib/http'
import Modal from './ui/Modal'

type Props = {
  title: string
  submitLabel: string
  initialName?: string
  /** Should throw on failure; the error message is shown inside the dialog. */
  onSubmit: (name: string) => Promise<void>
  onClose: () => void
}

// Used for both "Create workspace" and "Rename workspace".
// Server errors (e.g. "already exists") stay inside the dialog so the user can fix the name.
export default function WorkspaceNameDialog({ title, submitLabel, initialName = '', onSubmit, onClose }: Props) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const trimmed = name.trim()
  const unchanged = trimmed === initialName.trim()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!trimmed || unchanged) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(trimmed) // on success the parent closes the dialog
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {error && (
            <p className="flash flash-error" role="alert">
              {error}
            </p>
          )}
          <label className="form-label" htmlFor="workspace-name">
            Workspace name
          </label>
          <input
            id="workspace-name"
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoFocus
            autoComplete="off"
          />
          <p className="form-note">Up to 80 characters. Names must be unique across your workspaces.</p>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !trimmed || unchanged}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
