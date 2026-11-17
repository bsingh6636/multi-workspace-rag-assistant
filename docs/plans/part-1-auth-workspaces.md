# Part 1 plan: Auth + workspaces

Goal: a user can sign up, lands in a "Default" workspace, can create, rename, delete and switch workspaces, and is put back in the last one after a reload. Another user's workspace id returns 404.

Checklist lives in `PLAN.md`. This file holds the detail.

---

## A. Server

### New dependencies
`@supabase/supabase-js`, `zod`.

### Files
| File | Purpose |
|---|---|
| `src/config.ts` | Reads env once and validates it with zod. Fails at startup with a clear message if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing. Never prints values. Gemini and Discord vars become required in the parts that use them. |
| `src/db.ts` | One Supabase client built with the **service-role key** (bypasses RLS, server only). Also exports the `Workspace` type. |
| `src/types/express.d.ts` | Adds `req.user` and `req.workspace` to Express's `Request` type. |
| `src/middleware/auth.ts` | `requireAuth`: reads `Authorization: Bearer <jwt>`, calls `supabase.auth.getUser(token)`, sets `req.user = { id, email }`. Missing or invalid token gives 401. |
| `src/middleware/workspace.ts` | `requireWorkspace(userId, wsId)`: returns the workspace only if `id = wsId AND user_id = userId`, otherwise `null`. `loadWorkspace` middleware: validates `:wsId` is a UUID, calls `requireWorkspace`, sets `req.workspace`, or returns **404** (not 403, so it doesn't reveal that the id exists). |
| `src/lib/httpError.ts` | `HttpError(status, message)`, thrown by controllers and middleware. |
| `src/middleware/error.ts` | The one error handler: `HttpError` → its status, `ZodError` → 400, Postgres `23505` → 409, else 500. |
| `src/routes/index.ts` | `apiRouter`: `apiRouter.use(requireAuth)`, then mounts `/profile` and `/workspaces`, then a JSON 404. |
| `src/routes/profile.routes.ts` + `src/controllers/profile.controller.ts` | `GET /api/profile` and `PATCH /api/profile`. |
| `src/routes/workspace.routes.ts` + `src/controllers/workspace.controller.ts` | Workspace CRUD. Later parts mount documents, chats, etc. under `/:wsId`. |
| `src/index.ts` | `app.use('/api', apiRouter)`, static files, `errorHandler` last. |

### Routes
| Route | Behaviour |
|---|---|
| `GET /api/profile` | **Bootstrap.** Upserts the `profiles` row (no-op if it exists). If the user has no workspaces, inserts "Default". Returns `{ user: {id, email}, last_workspace_id }`. Both inserts use `ON CONFLICT DO NOTHING`, so two parallel first calls (React StrictMode runs effects twice in dev) can't create two Defaults or fail. |
| `PATCH /api/profile` `{ last_workspace_id }` | zod: UUID. Checks ownership with `requireWorkspace` first, so you can't save someone else's workspace id. 404 if not yours. |
| `GET /api/workspaces` | The user's workspaces, oldest first. |
| `POST /api/workspaces` `{ name }` | zod: trimmed, 1–80 chars. Duplicate name gives 409. |
| `PATCH /api/workspaces/:wsId` `{ name }` | Rename. Same validation and 409. |
| `DELETE /api/workspaces/:wsId` | Deletes it; documents, chunks, chats, tasks and tool calls go with it through `ON DELETE CASCADE`. Refuses (400) to delete your **last** workspace, so the app never has an empty state. `profiles.last_workspace_id` becomes `NULL` through `ON DELETE SET NULL`. |

### How workspace scoping is wired
```
app.use('/api', apiRouter)
  apiRouter.use(requireAuth)                       → req.user
  apiRouter.use('/workspaces', workspaceRoutes)
  router.get('/'), router.post('/')                → scoped by req.user.id
  router.use('/:wsId', loadWorkspace)              → req.workspace (ownership checked)
  router.patch('/:wsId'), router.delete('/:wsId')
  (Part 2+) router.use('/:wsId/documents', …)      → handlers read req.workspace.id only
```
Handlers below `/:wsId` use `req.workspace.id`, never a body or query value. That is hard rule 1.

### Errors
Controllers throw; `middleware/error.ts` answers. Express 5 forwards errors from async handlers automatically.
- `HttpError(404, …)` etc. → that status and message.
- zod `parse()` failures → 400 with the first issue's message.
- Postgres unique violation (`23505`) → 409.
- Anything else → generic 500; only the message is logged.

---

## B. Client

### New dependencies
`@supabase/supabase-js` (anon key only), `axios`, `sonner` (toasts), `@primer/octicons-react` (icons).

### Files
| File | Purpose |
|---|---|
| `src/lib/supabase.ts` | Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. supabase-js keeps the session in localStorage and refreshes it. |
| `src/lib/http.ts` | One axios instance (`baseURL: /api`). A request interceptor adds `Authorization: Bearer <access_token>`; a response interceptor turns every failure into an `ApiError` with a readable message (network/502 → "Can't reach the server", 401 → sign out). Exports `getRequest/postRequest/patchRequest/deleteRequest`, used everywhere. |
| `src/types.ts` | `Workspace`, `Profile`. |
| `src/components/ui/Modal.tsx` | Native `<dialog>` modal: focus trap, backdrop, Esc closes, backdrop click does **not** (a half-typed name isn't lost), can't close while a request runs. |
| `src/components/ui/Popover.tsx` | Button + floating panel; closes on outside click, Esc, or when an item calls `close()`. |
| `src/components/AuthForm.tsx` | Email and password form with a sign-in / sign-up toggle. If sign-up returns no session (email confirmation is on), it says "check your email". |
| `src/components/WorkspaceSwitcher.tsx` | GitHub-style context switcher in the header: button with the active name opens a popover with a filter box, the list (checkmark on the active one) and "New workspace". |
| `src/components/WorkspaceMenu.tsx` | "…" menu next to the workspace title: Rename, Delete (disabled with a reason when it's the only workspace). |
| `src/components/WorkspaceNameDialog.tsx` | Create and rename dialog. Server errors ("already exists") show inside the dialog. |
| `src/components/DeleteWorkspaceDialog.tsx` | Type the workspace name to unlock the red Delete button, like GitHub's delete-repository dialog. |
| `src/components/UserMenu.tsx` | Avatar (Google picture or initial) with "Signed in as …" and Sign out. |
| `src/components/Dashboard.tsx` | Loads `/api/profile` then `/api/workspaces`. Active workspace = `last_workspace_id` if it's still in the list, otherwise the first one. Switching calls `PATCH /api/profile`. Success/failure toasts (`sonner`). Loading spinner and a "Try again" error state. The panels arrive in Parts 2–5. |
| `src/App.tsx` | Reads the session and listens with `onAuthStateChange`. No session shows `AuthForm`; a session shows `Dashboard`. No router library yet; a plain conditional is enough. |

---

## C. Manual steps (you)

1. Do the Part 0 Supabase steps if not done yet: create the project, run `sql/schema.sql` then `sql/match_chunks.sql`, and fill `server/.env` and `client/.env`.
2. Supabase dashboard → Authentication → Sign In / Providers → Email: turn **Confirm email** off. Otherwise every sign-up needs an inbox and the demo account is slower to set up.

## D. How to verify

Run `cd server && npm run dev` and `cd client && npm run dev`, then:

1. Sign up with a new email: you land in "Default".
2. Create workspace "B", switch to it, reload: still on "B".
3. Rename "B", then try renaming it to "Default": you get "already exists".
4. Delete "B": you're moved to "Default". Try deleting "Default" (the last one): refused.
5. Isolation (the 404 check). In the browser console, copy your token:
   `JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('-auth-token')))).access_token`
   Sign up a second user, copy one of **their** workspace ids from `GET /api/workspaces`, then as the first user:
   ```bash
   curl -i -X PATCH localhost:3000/api/workspaces/<other-user-ws-id> \
     -H "Authorization: Bearer <first-user-token>" -H 'Content-Type: application/json' -d '{"name":"x"}'
   # → 404 {"error":"Workspace not found"}
   ```
6. No token: `curl -i localhost:3000/api/workspaces` gives 401.
