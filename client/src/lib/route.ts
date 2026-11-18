// The app's URLs, without a router library:
//   /                     → last workspace (from the profile), Chat tab
//   /w/<wsId>             → that workspace, Chat tab
//   /w/<wsId>/<tab>       → that workspace and tab (documents, tasks, tool-calls)
// The URL only picks what to show. The server still checks that the user owns
// the workspace on every /api/workspaces/:wsId/... call.

export const TAB_IDS = ['chat', 'documents', 'tasks', 'tool-calls'] as const
export type Tab = (typeof TAB_IDS)[number]

export type Route = { wsId: string | null; tab: Tab }

function isTab(value: string | undefined): value is Tab {
  return TAB_IDS.includes(value as Tab)
}

// "/w/abc/tasks" → { wsId: "abc", tab: "tasks" }. Anything else → no workspace.
// An unknown tab name falls back to Chat.
export function parseRoute(pathname: string): Route {
  const [first, wsId, tab] = pathname.split('/').filter(Boolean)
  if (first !== 'w' || !wsId) return { wsId: null, tab: 'chat' }
  return { wsId, tab: isTab(tab) ? tab : 'chat' }
}

// Chat is the default tab, so its URL is just /w/<wsId>.
export function routePath(wsId: string, tab: Tab): string {
  return tab === 'chat' ? `/w/${wsId}` : `/w/${wsId}/${tab}`
}

// push: a new history entry, so Back returns here (a click on a workspace or tab).
// replace: swap the current entry (a redirect or a fix), so Back never lands on a broken URL.
export function navigate(path: string, { replace = false }: { replace?: boolean } = {}) {
  if (path === window.location.pathname) return
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
}
