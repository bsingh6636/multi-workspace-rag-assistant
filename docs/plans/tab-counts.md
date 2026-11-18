# Tab counts (GitHub style)

Asked for by the user on 2026-11-18: counters on the workspace tabs, like GitHub's "Pull requests 3".

## Decisions

| Tab | Counter | Why |
|---|---|---|
| Chat | none | Like GitHub's Code tab: it's a place to work, not a list of items. The chat sidebar already shows every chat. |
| Documents | all documents | Same number as the Documents panel header. |
| Tasks | **open** tasks | Same as the Tasks panel's default view ("Open tasks"), and like GitHub counting open PRs. |
| Tool calls | all tool calls | Same number as the Tool calls panel header (without "Failed only"). |

- Like GitHub, a counter of 0 isn't shown, and 1000 or more shows as "1k", "1.2k".

## Server

`GET /api/workspaces/:wsId/counts` → `{ documents, openTasks, toolCalls }`. Three `count: 'exact', head: true` queries run in parallel, each filtered by the URL's workspace id after `loadWorkspace` has checked ownership (hard rule 1). No rows are sent, only the counts.

## Client

- `Dashboard` holds the counts, tagged with the workspace id they belong to, so a reply that arrives after a workspace switch is never shown on the new workspace.
- Counts are fetched when the workspace or the tab changes, and when a panel calls `onChange` after changing something:
  - Chat: after a send or a Retry. The answer may have saved or completed a task and logged tool calls.
  - Documents: after an upload or a delete.
  - Tasks: after done/not done, a delete, or Refresh.
  - Tool calls: after Refresh.
- If the count fetch fails, the old counts stay. They're extra information, so there's no error toast.
