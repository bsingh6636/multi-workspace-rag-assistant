import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { ChecklistIcon, CommentDiscussionIcon, FileIcon, ToolsIcon } from '@primer/octicons-react'
import { toast } from 'sonner'
import { deleteRequest, errorMessage, getRequest, patchRequest, postRequest } from '../lib/http'
import { navigate, parseRoute, routePath, type Tab } from '../lib/route'
import { nextDefaultName } from '../lib/workspaceNames'
import type { Profile, Workspace, WorkspaceCounts, WorkspaceDeleted } from '../types'
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

// The workspace sections (ids in lib/route.ts). The active tab stays the same when the workspace changes.
// count: which number from /counts the tab shows (Chat has none, like GitHub's Code tab).
const TABS: { id: Tab; label: string; icon: ReactNode; count?: keyof WorkspaceCounts }[] = [
  { id: 'chat', label: 'Chat', icon: <CommentDiscussionIcon /> },
  { id: 'documents', label: 'Documents', icon: <FileIcon />, count: 'documents' },
  { id: 'tasks', label: 'Tasks', icon: <ChecklistIcon />, count: 'openTasks' },
  { id: 'tool-calls', label: 'Tool calls', icon: <ToolsIcon />, count: 'toolCalls' },
]

// Logged-in shell: loads the user's workspaces, opens the one in the URL (or
// the last active one), and handles switching, create, rename and delete.
// Below the header, one tab per section of the active workspace: chat,
// documents, tasks, tool-call log. The workspace and tab are kept in the URL
// (lib/route.ts), so a reload, Back/Forward and links work.
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
    // Set by the cleanup: results that arrive after it (React StrictMode's
    // second run in dev, a retry, or sign-out mid-load) are dropped.
    let ignore = false
    async function load() {
      try {
        // /profile first: it creates the profile and "Default" workspace for new users.
        const profile = await getRequest<Profile>('/profile')
        const list = await getRequest<Workspace[]>('/workspaces')
        if (ignore) return
        setWorkspaces(list)
        // 1. The workspace in the URL, if it's one of the user's.
        // 2. Otherwise the last workspace if it still exists, otherwise the first.
        const route = parseRoute(window.location.pathname)
        const fromUrl = list.find((ws) => ws.id === route.wsId)
        if (route.wsId && !fromUrl) toast.error('Workspace not found. Opened your last workspace instead.', { id: 'ws-not-found' })
        const last = list.find((ws) => ws.id === profile.last_workspace_id)
        const chosen = fromUrl ?? last ?? list[0]
        if (!chosen) return
        const chosenTab = fromUrl ? route.tab : 'chat'
        setActiveId(chosen.id)
        setTab(chosenTab)
        // "/" or a bad link becomes the real URL, without adding a history entry.
        navigate(routePath(chosen.id, chosenTab), { replace: true })
        // Opening a workspace by its link counts as using it.
        if (chosen.id !== profile.last_workspace_id) rememberWorkspace(chosen.id)
      } catch (e) {
        if (!ignore) setLoadError(errorMessage(e))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [loadAttempt])

  function retryLoad() {
    setLoading(true)
    setLoadError(null)
    setLoadAttempt((n) => n + 1)
  }

  const active = workspaces.find((ws) => ws.id === activeId)

  // The tab counters. Tagged with their workspace, so counts that arrive after
  // a workspace switch are never shown on the new one. Fetched when the
  // workspace or tab changes, and when a panel changes something (onChange).
  // A failed fetch keeps the old numbers: they're extra, not worth a toast.
  const [counts, setCounts] = useState<{ wsId: string; counts: WorkspaceCounts } | null>(null)
  const refreshCounts = useCallback(async () => {
    if (!activeId) return
    try {
      const fresh = await getRequest<WorkspaceCounts>(`/workspaces/${activeId}/counts`)
      setCounts({ wsId: activeId, counts: fresh })
    } catch {
      // Keep what's shown.
    }
  }, [activeId])
  useEffect(() => {
    refreshCounts()
  }, [refreshCounts, tab])
  const shownCounts = counts && counts.wsId === activeId ? counts.counts : null

  const allNames = workspaces.map((ws) => ws.name)

  // Show a workspace and tab, and put them in the URL.
  function show(id: string, nextTab: Tab, options?: { replace?: boolean }) {
    setActiveId(id)
    setTab(nextTab)
    navigate(routePath(id, nextTab), options)
  }

  // Switch right away in the UI (same tab), then remember it on the server.
  async function switchTo(id: string, options?: { replace?: boolean }) {
    show(id, tab, options)
    await rememberWorkspace(id)
  }

  // Back/Forward: show what the URL says, without adding another history entry.
  // A URL whose workspace is gone (deleted since) is swapped for the current one.
  useEffect(() => {
    function onPopState() {
      const route = parseRoute(window.location.pathname)
      const ws = workspaces.find((w) => w.id === route.wsId)
      if (!ws) {
        if (route.wsId) toast.error('That workspace no longer exists.', { id: 'ws-not-found' })
        if (activeId) navigate(routePath(activeId, tab), { replace: true })
        return
      }
      setActiveId(ws.id)
      setTab(route.tab)
      if (ws.id !== activeId) rememberWorkspace(ws.id)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [workspaces, activeId, tab])

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
    const next = remaining[0]
    toast.success(`Deleted workspace “${active.name}”`, next && { description: `Switched to “${next.name}”` })
    // replace: Back shouldn't return to the deleted workspace's URL.
    if (next) await switchTo(next.id, { replace: true })
  }

  // The user confirmed "delete everything" in chat. The server already deleted
  // the workspace (making a new one if it was the only one) and remembered
  // `next` as the last workspace. Reload the list and open `next`; replace, so
  // Back doesn't return to the deleted workspace's URL.
  async function workspaceDeletedFromChat({ deletedName, next, created }: WorkspaceDeleted) {
    toast.success(`Deleted workspace “${deletedName}”`, {
      description: created ? `Created and switched to “${next.name}”` : `Switched to “${next.name}”`,
    })
    try {
      setWorkspaces(await getRequest<Workspace[]>('/workspaces'))
      show(next.id, 'chat', { replace: true })
    } catch {
      // Couldn't fetch the list: point the URL at `next` and reload everything.
      navigate(routePath(next.id, 'chat'), { replace: true })
      retryLoad()
    }
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
                  onClick={() => show(active.id, t.id)}
                >
                  {t.icon}
                  {t.label}
                  {t.count && shownCounts && shownCounts[t.count] > 0 && (
                    <span className="counter" title={shownCounts[t.count].toLocaleString()}>
                      {formatCount(shownCounts[t.count])}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* key: a new workspace gets a fresh panel, so the old workspace's data never flashes. */}
            {tab === 'chat' && <ChatPanel
                key={active.id}
                workspaceId={active.id}
                onChange={refreshCounts}
                onWorkspaceDeleted={workspaceDeletedFromChat}
              />}
            {tab === 'documents' && <DocumentsPanel key={active.id} workspaceId={active.id} onChange={refreshCounts} />}
            {tab === 'tasks' && <TasksPanel key={active.id} workspaceId={active.id} onChange={refreshCounts} />}
            {tab === 'tool-calls' && <ToolCallsPanel key={active.id} workspaceId={active.id} onChange={refreshCounts} />}
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
          currentName={active.name}
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

// Saves the workspace as the one to open next time ("/" or a new login).
async function rememberWorkspace(id: string) {
  try {
    await patchRequest('/profile', { last_workspace_id: id })
  } catch (e) {
    toast.error(`Couldn't save your workspace choice: ${errorMessage(e)}`)
  }
}

// Like GitHub's counters: 999, then 1k, 1.2k, 12k.
function formatCount(n: number): string {
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}k`
}
