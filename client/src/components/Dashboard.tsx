import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { ChecklistIcon, CommentDiscussionIcon, FileIcon, ToolsIcon } from '@primer/octicons-react'
import { toast } from 'sonner'
import { deleteRequest, errorMessage, getRequest, patchRequest, postRequest } from '../lib/http'
import { nextDefaultName } from '../lib/workspaceNames'
import type { Profile, Workspace } from '../types'
import ChatPanel from './ChatPanel'
import DeleteWorkspaceDialog from './DeleteWorkspaceDialog'
import DocumentsPanel from './DocumentsPanel'
import TasksPanel from './TasksPanel'
import ToolCallsPanel from './ToolCallsPanel'
import UserMenu from './UserMenu'
import WorkspaceMenu from './WorkspaceMenu'
import WorkspaceNameDialog from './WorkspaceNameDialog'
import WorkspaceSwitcher from './WorkspaceSwitcher'

// Which dialog is open (only one at a time).
type DialogKind = 'create' | 'rename' | 'delete' | null

// The workspace sections. The active tab stays the same when the workspace changes.
type Tab = 'chat' | 'documents' | 'tasks' | 'tool-calls'
const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'chat', label: 'Chat', icon: <CommentDiscussionIcon /> },
  { id: 'documents', label: 'Documents', icon: <FileIcon /> },
  { id: 'tasks', label: 'Tasks', icon: <ChecklistIcon /> },
  { id: 'tool-calls', label: 'Tool calls', icon: <ToolsIcon /> },
]

// Logged-in shell: loads the user's workspaces, restores the last active one,
// and handles switching, create, rename and delete. Below the header, one tab
// per section of the active workspace: chat, documents, tasks, tool-call log.
export default function Dashboard({ user }: { user: User }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [tab, setTab] = useState<Tab>('chat')

  // Bumped by "Try again" to re-run the load effect.
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        // /profile first: it creates the profile and "Default" workspace for new users.
        const profile = await getRequest<Profile>('/profile')
        const list = await getRequest<Workspace[]>('/workspaces')
        setWorkspaces(list)
        // Restore the last workspace if it still exists, otherwise use the first.
        const last = list.find((ws) => ws.id === profile.last_workspace_id)
        setActiveId(last?.id ?? list[0]?.id ?? null)
      } catch (e) {
        setLoadError(errorMessage(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [loadAttempt])

  function retryLoad() {
    setLoading(true)
    setLoadError(null)
    setLoadAttempt((n) => n + 1)
  }

  const active = workspaces.find((ws) => ws.id === activeId)
  const allNames = workspaces.map((ws) => ws.name)

  // Switch right away in the UI, then remember it on the server.
  async function switchTo(id: string) {
    setActiveId(id)
    try {
      await patchRequest('/profile', { last_workspace_id: id })
    } catch (e) {
      toast.error(`Couldn't save your workspace choice: ${errorMessage(e)}`)
    }
  }

  // The three dialog actions throw on failure, so the dialog can show the error.
  async function createWorkspace(name: string) {
    const ws = await postRequest<Workspace>('/workspaces', { name })
    setWorkspaces((list) => [...list, ws])
    setDialog(null)
    toast.success(`Created workspace “${ws.name}”`)
    await switchTo(ws.id)
  }

  async function renameWorkspace(name: string) {
    if (!active) return
    const updated = await patchRequest<Workspace>(`/workspaces/${active.id}`, { name })
    setWorkspaces((list) => list.map((ws) => (ws.id === updated.id ? updated : ws)))
    setDialog(null)
    toast.success(`Renamed to “${updated.name}”`)
  }

  async function deleteWorkspace() {
    if (!active) return
    await deleteRequest(`/workspaces/${active.id}`)
    const remaining = workspaces.filter((ws) => ws.id !== active.id)
    setWorkspaces(remaining)
    setDialog(null)
    toast.success(`Deleted workspace “${active.name}”`)
    if (remaining[0]) await switchTo(remaining[0].id)
  }

  return (
    // On the chat tab the app is exactly one window tall, so only the message list scrolls.
    <div className={tab === 'chat' ? 'app app-fit' : 'app'}>
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-mark" aria-hidden="true">
            W
          </div>
          {!loading && !loadError && (
            <WorkspaceSwitcher
              workspaces={workspaces}
              active={active}
              onSwitch={switchTo}
              onCreate={() => setDialog('create')}
            />
          )}
          {/* Settings for the active workspace sit right next to its name. */}
          {!loading && active && (
            <WorkspaceMenu
              canDelete={workspaces.length > 1}
              onRename={() => setDialog('rename')}
              onDelete={() => setDialog('delete')}
            />
          )}
        </div>
        <UserMenu user={user} />
      </header>

      <main className="app-main">
        {loading && (
          <div className="blankslate" aria-busy="true">
            <span className="spinner" aria-hidden="true" />
            <p className="muted">Loading your workspaces…</p>
          </div>
        )}

        {loadError && (
          <div className="flash flash-error flash-row" role="alert">
            <span>Couldn't load your workspaces: {loadError}</span>
            <button type="button" className="btn btn-sm" onClick={retryLoad}>
              Try again
            </button>
          </div>
        )}

        {!loading && active && (
          <>
            <nav className="tabs" aria-label="Workspace sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="tab"
                  aria-current={tab === t.id ? 'page' : undefined}
                  onClick={() => setTab(t.id)}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </nav>

            {/* key: a new workspace gets a fresh panel, so the old workspace's data never flashes. */}
            {tab === 'chat' && <ChatPanel key={active.id} workspaceId={active.id} />}
            {tab === 'documents' && <DocumentsPanel key={active.id} workspaceId={active.id} />}
            {tab === 'tasks' && <TasksPanel key={active.id} workspaceId={active.id} />}
            {tab === 'tool-calls' && <ToolCallsPanel key={active.id} workspaceId={active.id} />}
          </>
        )}
      </main>

      {dialog === 'create' && (
        <WorkspaceNameDialog
          title="Create a new workspace"
          submitLabel="Create workspace"
          initialName={nextDefaultName(allNames)}
          takenNames={allNames}
          onSubmit={createWorkspace}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'rename' && active && (
        <WorkspaceNameDialog
          title="Rename workspace"
          submitLabel="Rename"
          initialName={active.name}
          takenNames={workspaces.filter((ws) => ws.id !== active.id).map((ws) => ws.name)}
          onSubmit={renameWorkspace}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && active && (
        <DeleteWorkspaceDialog workspace={active} onConfirm={deleteWorkspace} onClose={() => setDialog(null)} />
      )}
    </div>
  )
}
