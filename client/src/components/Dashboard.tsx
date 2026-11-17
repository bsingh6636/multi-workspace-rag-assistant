import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { StackIcon } from '@primer/octicons-react'
import { toast } from 'sonner'
import { deleteRequest, errorMessage, getRequest, patchRequest, postRequest } from '../lib/http'
import type { Profile, Workspace } from '../types'
import DeleteWorkspaceDialog from './DeleteWorkspaceDialog'
import DocumentsPanel from './DocumentsPanel'
import UserMenu from './UserMenu'
import WorkspaceMenu from './WorkspaceMenu'
import WorkspaceNameDialog from './WorkspaceNameDialog'
import WorkspaceSwitcher from './WorkspaceSwitcher'

// Which dialog is open (only one at a time).
type DialogKind = 'create' | 'rename' | 'delete' | null

// Logged-in shell: loads the user's workspaces, restores the last active one,
// and handles switching, create, rename and delete. Panels for documents, chats,
// tasks and the tool-call log are added in later parts.
export default function Dashboard({ user }: { user: User }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogKind>(null)

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
    <div className="app">
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
            <div className="page-head">
              <h1>
                <StackIcon size={20} />
                {active.name}
              </h1>
              <WorkspaceMenu
                canDelete={workspaces.length > 1}
                onRename={() => setDialog('rename')}
                onDelete={() => setDialog('delete')}
              />
            </div>

            {/* key: a new workspace gets a fresh panel, so the old list never flashes. */}
            <DocumentsPanel key={active.id} workspaceId={active.id} />
          </>
        )}
      </main>

      {dialog === 'create' && (
        <WorkspaceNameDialog
          title="Create a new workspace"
          submitLabel="Create workspace"
          onSubmit={createWorkspace}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'rename' && active && (
        <WorkspaceNameDialog
          title="Rename workspace"
          submitLabel="Rename"
          initialName={active.name}
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
