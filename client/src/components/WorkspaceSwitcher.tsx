import { useState } from 'react'
import { CheckIcon, PlusIcon, StackIcon, TriangleDownIcon } from '@primer/octicons-react'
import type { Workspace } from '../types'
import Popover from './ui/Popover'

type Props = {
  workspaces: Workspace[]
  active: Workspace | undefined
  onSwitch: (id: string) => void
  onCreate: () => void
}

// The header's workspace picker, like GitHub's context switcher: a button with
// the active workspace's name opens a filterable list with a checkmark on the
// active one, plus "New workspace" at the bottom.
export default function WorkspaceSwitcher({ workspaces, active, onSwitch, onCreate }: Props) {
  return (
    <Popover
      buttonClassName="btn btn-invisible switcher-button"
      buttonLabel={`Switch workspace (current: ${active?.name ?? 'none'})`}
      button={
        <>
          <StackIcon />
          <span className="switcher-name">{active?.name ?? 'Choose workspace'}</span>
          <TriangleDownIcon />
        </>
      }
    >
      {(close) => (
        <SwitcherPanel
          workspaces={workspaces}
          activeId={active?.id}
          onPick={(id) => {
            close()
            if (id !== active?.id) onSwitch(id)
          }}
          onCreate={() => {
            close()
            onCreate()
          }}
        />
      )}
    </Popover>
  )
}

type PanelProps = {
  workspaces: Workspace[]
  activeId: string | undefined
  onPick: (id: string) => void
  onCreate: () => void
}

// Separate component so the filter text resets every time the popover opens.
function SwitcherPanel({ workspaces, activeId, onPick, onCreate }: PanelProps) {
  const [filter, setFilter] = useState('')
  const shown = workspaces.filter((ws) => ws.name.toLowerCase().includes(filter.trim().toLowerCase()))

  return (
    <div className="switcher-panel">
      <div className="popover-title">Switch workspace</div>
      <div className="popover-filter">
        <input
          type="search"
          placeholder="Find a workspace…"
          aria-label="Find a workspace"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoFocus
        />
      </div>

      <ul className="menu-list" role="listbox" aria-label="Workspaces">
        {shown.map((ws) => (
          <li key={ws.id}>
            <button
              type="button"
              className="menu-item"
              role="option"
              aria-selected={ws.id === activeId}
              onClick={() => onPick(ws.id)}
            >
              <span className="menu-check">{ws.id === activeId && <CheckIcon />}</span>
              <span className="menu-text">{ws.name}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="menu-empty">No workspace matches “{filter}”</li>}
      </ul>

      <div className="menu-divider" role="separator" />
      <button type="button" className="menu-item" onClick={onCreate}>
        <span className="menu-check">
          <PlusIcon />
        </span>
        <span className="menu-text">New workspace</span>
      </button>
    </div>
  )
}
