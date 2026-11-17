# Part 0 plan: Setup

> **Note (2026-11-18):** hosting later moved from Render to AWS with Docker, and the deploy and cron steps below were dropped. See `AI_CHANGE_LOG.md`. The rest of this plan is kept as written.

Goal: a deployable skeleton. The Render URL shows the React page, `/health` returns 200, and the database schema is in place for Part 1.

Checklist lives in `PLAN.md`. This file holds the detail.

---

## A. Code (done by the AI in this session)

### 1. `sql/schema.sql`
- `create extension if not exists vector;`
- Tables from `docs/DESIGN.md` §1, in dependency order: `workspaces` → `profiles` → `documents` → `chunks` → `chats` → `messages` → `tasks` → `tool_calls`.
- `CHECK` constraints for every status/role column.
- `ON DELETE CASCADE` from workspace to everything, and from document to chunks. `SET NULL` for `profiles.last_workspace_id`, `tasks.created_by_message_id` and `tool_calls.message_id`.
- `UNIQUE (user_id, name)` on workspaces, `UNIQUE (workspace_id, content_hash)` on documents.
- Plain b-tree indexes on the foreign keys used in `WHERE` clauses. **No** HNSW/IVFFlat index on `chunks.embedding` (DESIGN §7).
- `enable row level security` on every table with **no policies**. The browser's anon key can then read nothing; only the server (service-role key) can.
- The file is re-runnable during development: it starts with `drop table if exists … cascade` for our tables, so it wipes data. Comment at the top says so.

### 2. `sql/match_chunks.sql`
- The function from DESIGN §2: `where c.workspace_id = ws_id` sits **inside** the query, before `order by … limit k`.
- Revoke `execute` from `public`, `anon` and `authenticated`, grant it to `service_role` only.

### 3. `/server` (Express 5 + TypeScript)
- `package.json` scripts: `dev` (`tsx watch`), `build` (`tsc`), `start` (`node dist/index.js`).
- `tsconfig.json`: `module: nodenext` (CommonJS output, no `.js` import suffixes), `strict`, `outDir: dist`.
- `src/index.ts`:
  - `GET /health` → `{ ok: true }` (no DB call, so the keep-alive ping is cheap and works before env is set).
  - `/api/*` that matches nothing → JSON 404 (so an API typo never returns `index.html`).
  - `express.static(client/dist)` and a catch-all that returns `index.html` for client-side routes.
  - JSON error handler that never returns stack traces.
- Env is loaded with `dotenv` from `server/.env` in dev. On Render, env comes from the dashboard. Env validation with zod starts in Part 1, when the server first needs keys.

### 4. `/client` (Vite + React + TypeScript)
- Scaffold with `create-vite` (`react-ts` template), then strip the demo boilerplate.
- `App.tsx` shows the app name and calls `/health`, printing the result. That proves client → server works on the live URL.
- `vite.config.ts`: dev proxy for `/api` and `/health` to `http://localhost:3000`, so the client never hard-codes a server URL.

### 5. Root files
- `package.json` (root) with two scripts so Render needs only `npm run build` and `npm start`:
  - `build`: install and build the client, then install and build the server. Uses `npm ci --include=dev` because Render sets `NODE_ENV=production`, which would otherwise skip TypeScript and Vite.
  - `start`: `npm --prefix server start`.
- `.env.example` with every variable from the README and no values.
- `.nvmrc` / `engines` pinned to Node 22 so Render and local match.

### Decisions to review
| Decision | Why |
|---|---|
| Express 5 | Async handler errors reach the error middleware automatically, so routes need less try/catch. |
| CommonJS output | `pdf-parse` is CommonJS, and it avoids `.js` suffixes on every import. |
| `/health` doesn't touch the DB | The cron ping must stay cheap and must not fail because of a DB hiccup. |
| RLS on, no policies | Defence in depth: even if the anon key is used directly, it reads nothing. |
| `schema.sql` drops tables first | Fast iteration during the build day. Will be noted in the README as dev-only. |

---

## B. Manual steps (done by you)

1. **Supabase:** create a free project. In the SQL editor run `sql/schema.sql`, then `sql/match_chunks.sql`. Copy the project URL, anon key and service-role key into `server/.env` and `client/.env` (see `.env.example`).
2. **Gemini:** create a key in Google AI Studio. Note the current free chat model name and embedding model name, and confirm the embedding model supports `outputDimensionality: 768`. Put them in `server/.env`.
3. **Render:** new Web Service from the GitHub repo.
   - Build command: `npm run build`
   - Start command: `npm start`
   - Env vars: everything from `.env.example` (the `VITE_*` ones are needed at build time).
   - Push Part 0 first (after review), since Render deploys from GitHub.
4. **cron-job.org:** a job that calls `https://<render-url>/health` every 10 minutes.

---

## C. How to verify

Local:
```bash
npm run build && npm start       # from the repo root
curl -i localhost:3000/health    # 200 {"ok":true}
curl -i localhost:3000/api/nope  # 404 JSON
open http://localhost:3000       # React page shows "server: ok"
```
Dev mode: `cd server && npm run dev` and `cd client && npm run dev`, then open the Vite URL.

Database (Supabase SQL editor):
```sql
select table_name from information_schema.tables where table_schema = 'public';
select proname from pg_proc where proname = 'match_chunks';
```

Live: the Render URL shows the React page, and `/health` returns 200.
