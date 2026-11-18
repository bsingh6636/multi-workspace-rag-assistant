# Pagination: documents, tasks, tool-call log ("Load more")

The Part 8 pagination check (PLAN.md), done early at the user's request. Chat
messages stay unpaginated (out of scope, CLAUDE.md).

## Choice: cursor (keyset) paging with a "Load more" button

| Option | Why / why not |
|---|---|
| OFFSET + page numbers | Rows keep arriving (a new task or tool call shifts every page by one, so a row repeats or is skipped). Deep pages get slower, because Postgres still reads and throws away the skipped rows. Nobody needs "jump to page 7" of a log. |
| **Cursor: "rows older than (created_at, id)"** | **Chosen.** Stable while rows are added. Every page is one index range scan on the existing `(workspace_id, created_at desc)` indexes. `id` breaks ties when two rows share a timestamp. |
| Infinite scroll | Same API as Load more, but harder to use with a keyboard and harder to reach the end of the page. The button is simpler. |

## API

`GET /api/workspaces/:wsId/{documents,tasks,tool-calls}?limit=25&cursor=…`

```json
{ "items": [...], "nextCursor": "…" | null, "total": 42 | null }
```

- `limit`: 1–100, default 25.
- `cursor`: opaque to the client. It's `base64url(JSON [created_at, id])` of the last row sent. The server decodes it and checks it with zod (ISO timestamp + uuid) before it goes into the query filter, and anything else is a 400. The client never builds one.
- One extra row is fetched (`limit + 1`) to know whether there's another page, with no extra query.
- `total` is counted only on the first page, because later pages are filtered by the cursor. The client keeps it and adjusts it on its own upload or delete.
- `tool-calls` also takes `failed=true`: only rows whose status isn't `success`, filtered on the server so paging and the total stay correct (before, the "Failed only" box filtered whatever rows had loaded).
- `workspace_id` still comes from the URL and `loadWorkspace` (hard rule 1). The cursor only narrows a query that's already scoped.

## Files

- `server/src/lib/pagination.ts`: `parsePage`, `olderThan`, `toPage`, cursor encode/decode.
- `server/src/controllers/{document,task,toolCall}.controller.ts`: use it.
- `server/test/pagination.test.ts`: cursor round-trip, bad cursor or limit → 400, slicing and `nextCursor`.
- `client/src/lib/useList.ts`: becomes `usePagedList` (first page, `loadMore`, `refresh`, `total`).
- `client/src/components/ui/LoadMore.tsx`: footer with "Showing X of Y" and the button.
- `DocumentsPanel`, `TasksPanel`, `ToolCallsPanel`: use the hook. Counters show the total.

## Not paginated

- **Chat sidebar:** sorted by each chat's newest message (computed in the query), so a cursor would need that value stored on the chat. Left as is. It's one row per chat, and much smaller than the logs.
- **Messages in a chat:** out of scope.
