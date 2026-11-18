# Workspace and tab URLs

Asked for by the user on 2026-11-18. **Status: built** (except the optional chat URL below).

Today the active workspace is restored from `profiles.last_workspace_id`, but the tab isn't saved: a reload always opens Chat, Back does nothing, and a workspace can't be linked or bookmarked.

## URLs

```
/                          → last workspace (from the DB), Chat tab
/w/<wsId>                  → that workspace, Chat tab
/w/<wsId>/documents        → that workspace, Documents tab
/w/<wsId>/tasks
/w/<wsId>/tool-calls
```

## Which workspace opens

1. **The URL has a workspace id** and it's in the user's `/workspaces` list → open it, and save it as `last_workspace_id` (opening it counts as using it).
2. **The URL has an id that isn't in the list** (deleted, another user's, mistyped) → toast "Workspace not found", fall back to rule 3, and replace the URL.
3. **No id in the URL** (`/`) → `last_workspace_id` if it still exists, else the first workspace. Same as today. Then replace the URL with `/w/<id>`.

An unknown tab name falls back to Chat. The check is the list the server already returned, so there's no extra request, and the server still checks ownership on every `/workspaces/:wsId/...` call (hard rule 1). The URL only chooses what to show.

## History

- Switching workspace or tab → `pushState`, so Back and Forward work.
- Fixing a bad URL, the redirect from `/`, or the jump after deleting a workspace → `replaceState`, so Back doesn't land on a broken URL.
- `popstate` (Back/Forward) → set the workspace and tab from the URL without pushing again.

## How

- No router library. A small `client/src/lib/route.ts` with `parseRoute(pathname)`, `routePath(wsId, tab)` and `navigate(path, { replace })`, about 30 lines.
- `Dashboard.tsx` reads the route on load and listens for `popstate`. `switchTo` and `setTab` go through `navigate`.
- The server already serves `index.html` for unknown paths (`server/src/index.ts`), and Vite's dev server does the same, so a reload on `/w/<id>/tasks` works without changes.
- Signed out on a `/w/...` URL: show the login form, and keep the URL, so after login the user lands where the link pointed.

## Later (optional)

`/w/<wsId>/chat/<chatId>` to reopen a specific chat after a reload. This touches `ChatPanel.tsx`, so it's a separate step.

## Tests

- Reload on each tab stays on that tab and workspace.
- Back and Forward step through workspace and tab switches.
- `/` opens the last workspace. A deleted or another user's workspace id shows a toast and falls back.
- Two browser tabs on different workspaces each keep their own URL. `last_workspace_id` is the one used most recently.
