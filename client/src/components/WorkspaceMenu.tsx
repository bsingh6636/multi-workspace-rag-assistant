import { KebabHorizontalIcon, PencilIcon, TrashIcon } from '@primer/octicons-react'
import Popover from './ui/Popover'

type Props = {
  canDelete: boolean
  onRename: () => void
  onDelete: () => void
}

// "…" menu next to the workspace title with Rename and Delete.
// Delete is disabled (with the reason shown) when it's the user's only workspace.
export default function WorkspaceMenu({ canDelete, onRename, onDelete }: Props) {
  return (
    <Popover
      align="right"
      buttonClassName="btn btn-icon"
      buttonLabel="Workspace settings"
      button={<KebabHorizontalIcon />}
    >
      {(close) => (
        <div className="menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              close()
              onRename()
            }}
          >
            <span className="menu-check">
              <PencilIcon />
            </span>
            <span className="menu-text">Rename</span>
          </button>
          <div className="menu-divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="menu-item danger"
            disabled={!canDelete}
            onClick={() => {
              close()
              onDelete()
            }}
          >
            <span className="menu-check">
              <TrashIcon />
            </span>
            <span className="menu-text">
              Delete workspace
              {!canDelete && <span className="menu-hint">You need at least one workspace</span>}
            </span>
          </button>
        </div>
      )}
    </Popover>
  )
}
