# Part 5 plan: Dashboard

Goal: everything a workspace holds can be seen from one screen: its documents, chats, tasks and every tool call the model made. Switching workspaces changes every panel, and nothing from the previous workspace shows.

Checklist lives in `PLAN.md`. Data comes from routes that already exist (Part 4): `GET /api/workspaces/:wsId/tasks` and `GET /api/workspaces/:wsId/tool-calls`.

---

## A. What already exists

| PLAN.md item | Where | State |
|---|---|---|
| Protected layout, switcher in the header | `App.tsx` shows `AuthForm` without a session and `Dashboard` with one. `Dashboard` has the header with `WorkspaceSwitcher`, `WorkspaceMenu` and `UserMenu`. | Done in Part 1 |
| Documents panel | `DocumentsPanel.tsx` | Done in Part 2 |
| Chats (history) | The chat list in `ChatPanel.tsx`, grouped by last activity | Done in Part 3 |
| Panels reload on switch | `Dashboard` renders each panel with `key={active.id}`, so a new workspace mounts a fresh panel with empty state | Pattern exists; the new tabs use it too |

So Part 5 is two new tabs plus checks.

---

## B. Client

### Files
| File | Change |
|---|---|
| `src/types.ts` | `Task` and `ToolCallRow` types (match the table columns). |
| `src/components/TasksPanel.tsx` | New. The Tasks tab. |
| `src/components/ToolCallsPanel.tsx` | New. The Tool calls tab. |
| `src/components/Dashboard.tsx` | `Tab` gets `'tasks'` and `'tool-calls'`, with icons (`ChecklistIcon`, `ToolsIcon`). Both panels get `key={active.id}`. |
| `src/index.css` | A few classes for the new rows. Reuses `.box`, `.box-list`, `.box-row`, `.label-*`, `.skeleton`, `.blankslate`. |

### Tasks tab
- Header: "Tasks" with a counter, and a Refresh button (tasks are created from the chat, so a refresh is handy without switching tabs).
- One row per task, newest first (the server's order):
  - title
  - due date, e.g. "Due Fri, 20 Nov 2026", with a red "Overdue" label when it's before today, or a yellow "Due today" label. Today is the browser's local date, the same zone the chat sends with each message.
  - "Saved 18 Nov, 07:40" in muted text.
- `due_date` is a plain `YYYY-MM-DD`. It's formatted from its parts, not with `new Date('2026-11-20')`, which reads it as UTC midnight and can show the day before in the Americas.
- Empty state: "No tasks yet", with a hint to ask the assistant ("Remind me to … on Friday").
- No create, edit, done or delete: tasks come from the `save_task` tool, and editing is out of scope (CLAUDE.md).

### Tool calls tab
- Header: "Tool calls" with a counter, a "Failed only" toggle and Refresh.
- One row per call, newest first:
  - ✓ or ✕ icon, the tool name in monospace, and a status label for failures ("Invalid arguments", "Unknown tool", "Error").
  - latency ("412 ms") and time.
  - the arguments on one line, cut with "…" (full text on hover).
  - the error in red when there is one.
  - A native `<details>` per row expands the full arguments and result as formatted JSON. No state needed, keyboard works.
- ~~The server returns the newest 200 rows, with a note at the cap.~~ Replaced by cursor paging with Load more and a server-side "Failed only" filter (`docs/plans/pagination.md`).
- Empty state: "No tool calls yet", or "No failed tool calls" when the filter is on.

### Shared behaviour
- Loading shows skeleton rows like the documents panel, so the first render never flashes the empty state.
- A failed load shows a red flash with the reason (from `errorMessage`).
- The active tab stays the same when the workspace changes.

---

## C. Server

No change. Both routes run behind `requireAuth` and `loadWorkspace`, so `:wsId` must belong to the caller (404 otherwise), and both filter by `workspace_id` from the URL.

---

## D. How to verify

1. **Unit tests, typecheck, lint, client build** all pass.
2. **Isolation (API):** a throwaway user with two workspaces, A and B, and tasks and tool-call rows inserted into each with the service-role key. `GET /tasks` and `GET /tool-calls` for A return only A's rows, and B only B's. Another user's workspace id returns 404.
3. **Browser (headless Chromium, desktop and 390px wide):** sign in as the throwaway user, open each tab in A, switch to B, and check that every tab shows only B's rows and that the tab stays selected. Screenshot each tab. Check that the phone width has no sideways scroll.
4. **Live chat:** one "remind me to … tomorrow" message, then the Tasks tab shows the task and the Tool calls tab shows the `save_task` row with its latency.
5. The throwaway user is deleted at the end (cascades remove its rows). Test servers use ports 3127/3128, not the user's 3000/5173.

---

## E. Results (2026-11-18)

- **Unit tests** 85/85 (no server change). Client typecheck, lint (0 warnings) and build pass.
- **Models checked first:** one probe each. `gemini-3.5-flash-lite` and `gemini-3.6-flash` answered in about 1.6 s, and `gemini-embedding-001` returned 768 dimensions.
- **Browser and API run:** 29/29 checks on a test server at :3127 (Discord unset). It used two throwaway users, which are deleted afterwards, and headless Chrome.
  - API: tasks and tool calls of A return only A's rows, and B's only B's. Another user gets 404 on A's routes. No token gets 401.
  - Tasks tab: "Overdue", "Due today", no label for a future date, and "No due date".
  - Tool calls tab:
    - latency, status labels and the multi-line zod error are shown
    - Details expands the arguments and result JSON
    - "Failed only" leaves the 2 failed rows
  - Switching to B with the Tool calls tab open keeps the tab. Every tab then shows only B: 1 tool call, 1 task, no documents, no chats.
  - Live chat: "Remind me to call the Falcon vendor tomorrow" saved "Call the Falcon vendor" due 2026-11-19. The Tasks tab showed it, and the Tool calls tab showed `save_task` at the top (401 ms).
  - 390px: no sideways page scroll on either tab. No console or page errors.
- **Found and fixed in the run:**
  - At 390px the tab bar scrolled ("Chat" cut to "hat"), and the latency/time column squeezed the arguments. Tab icons are now hidden under 480px. Latency and time moved into the row's first line.
  - One check failed on the first run because of a bug in my test, not the app. The unknown-tool row's error text lists "list_tasks", which my "no list_tasks row from B" check matched. The check now looks at the tool name only.
- **Also in this part:** `useList` (load plus refresh) and `RowsSkeleton` are shared. The documents panel now uses the shared skeleton instead of its own copy.
- **Known limits:**
  - Documents, tasks and tool calls are paged (25 at a time, Load more). See `docs/plans/pagination.md`.
  - Tasks are read-only by design.
