import { useState, type FormEvent } from 'react'
import { errorMessage } from '../lib/http'
import { sameName } from '../lib/workspaceNames'
import Modal from './ui/Modal'

type Props = {
  title: string
  submitLabel: string
  initialName?: string
  /** Names of the user's other workspaces; typing one of them shows an error. */
  takenNames: string[]
  /** Should throw on failure; the error message is shown inside the dialog. */
  onSubmit: (name: string) => Promise<void>
  onClose: () => void
}

// Used for both "Create workspace" and "Rename workspace".
// A duplicate name is caught while typing; the server checks again, and any server
// error stays inside the dialog so the user can fix the name.
export default function WorkspaceNameDialog({
  title,
  submitLabel,
  initialName = '',
  takenNames,
  onSubmit,
  onClose,
}: Props) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const trimmed = name.trim()
  // Renaming to the same name is a no-op; a case-only change ("research" → "Research") is allowed.
  const unchanged = trimmed === initialName.trim()
  const duplicate = takenNames.some((taken) => sameName(taken, trimmed))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!trimmed || unchanged || duplicate) return
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
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            onFocus={(e) => e.target.select()}
            maxLength={80}
            autoFocus
            autoComplete="off"
            aria-invalid={duplicate}
            aria-describedby="workspace-name-note"
          />
          {duplicate ? (
            <p id="workspace-name-note" className="form-note form-note-error" role="alert">
              A workspace named “{trimmed}” already exists. Pick another name.
            </p>
          ) : (
            <p id="workspace-name-note" className="form-note">
              Up to 80 characters. Names must be unique across your workspaces.
            </p>
          )}
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !trimmed || unchanged || duplicate}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
