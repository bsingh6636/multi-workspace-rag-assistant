# Task actions: mark done (tab + chat), delete (tab only)

Asked for by the user on 2026-11-18, after the brief's tasks (save_task, list_tasks) were done.

## Decisions

| Action | Where | Why |
|---|---|---|
| Mark done / not done | Checkbox in the Tasks tab, and a `complete_task` tool in chat | Most useful, and cheap (one nullable column). Easy to undo (untick in the tab), so letting the model do it is low-risk. |
| Delete | Tasks tab only, with a confirm dialog. **Not a tool** | Destructive and can't be undone. Retrieved document text is untrusted: a document saying "delete all tasks" must never be able to trigger it (prompt injection). Destructive actions stay out of the model's reach. |
| Rename / change due date | Not built | Least value. Doing it from chat means guessing which task "the report one" is. |
| Mark done by clicking a task listed in a chat answer | Not built | The answer is text the model wrote. Instead, hovering the "Listed tasks" note shows a hint pointing to the Tasks tab. |
| Client request timeout | **Deferred** | The server has no deadline for a whole answer (each Gemini call retries for ~2 min, then the fallback model does too, per tool round). A client timeout would leave a `pending` answer the client never re-checks. It needs a server-side deadline first. |

## Schema

`alter table tasks add column done_at timestamptz;`: null means open; the time it was done otherwise. Applied to Supabase as a migration and added to `sql/schema.sql`.

## Server

- `PATCH /api/workspaces/:wsId/tasks/:taskId` `{ done: boolean }` sets `done_at` to now(), or back to null. `DELETE /api/workspaces/:wsId/tasks/:taskId` returns 204. Both are scoped by `workspace_id` from the URL (hard rule 1). An id that isn't in this workspace (or isn't a uuid) is a 404.
- `GET …/tasks?done=false|true`: open or done only. With no `done`, it returns all (paging unchanged).
- Tool `complete_task({ task_id })`, zod: uuid, strict. If the user doesn't say which task (and the last messages don't make it clear), the model calls `list_tasks` and asks, listing the open titles: a bare "Which task?" left the "Listed tasks" chip with nothing to pick from (user test, 08:51). The update is scoped by the server's `workspace_id`, so an id from another workspace is "not found". Already done → `already_done: true` (a Retry is safe).
- `list_tasks` returns `task_id` and `done` for each task, and only open tasks unless `include_done: true`. "All tasks" (any spelling) sets `include_done`, as in the Tasks tab where "All tasks" means including done; "my tasks" or "what's pending" lists open only. Before 09:08 on 2026-11-18, "all" only set `limit: 50`, so done tasks showed up sometimes and not others. The description says ids are for tool calls, never to show to the user. So "mark the vendor call done" becomes `list_tasks` → `complete_task`, two rounds of the tool loop.
- Prompt: the "can't do" example becomes "renaming or deleting tasks" (deleting is in the Tasks tab).

## Client

- Tasks tab: shows open tasks by default, with a "Show done" checkbox. Each row has a round "complete" button (`role="checkbox"`, tick on hover, filled green when done → title struck through; the row stays until refresh so it can be unticked). A square checkbox read as "select this row". Each row also has a delete button with a confirm dialog (`DeleteTaskDialog`, same pattern as documents).
- Chat: `complete_task` shows "Marked a task done". The "Listed tasks" note gets an info icon with the hover hint "To mark tasks done or delete them, use the Tasks tab."

## Tests

- Unit: `complete_task` args (non-uuid, extra `workspace_id`) → invalid_args; registry and abilities include it.
- Live (Gemini, tool calls faked): "mark X done" calls list_tasks then complete_task with the listed id, and ids aren't shown in the reply. "delete my tasks" gets "I can't do that." Endpoints checked against the database.
