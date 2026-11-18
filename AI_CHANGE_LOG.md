# AI Change Log

Every change the AI assistant makes to this repo is recorded here **before** the change is made: what changes and why. Newest entries go at the bottom.

When something the AI did turns out to be wrong, the entry is marked **⚠ AI mistake** with how it was noticed and fixed. These entries are the source material for the "hardest bug" section of `AI_NOTES.md`.

Entry format:

```
## YYYY-MM-DD HH:MM IST: <short title>
- **Files:** paths touched
- **What:** what is changing
- **Why:** reason / requirement it serves
```

---

## 2026-11-18 00:20 IST: Initial README
- **Files:** `README.md`
- **What:** Wrote the project README: features, stack, architecture, data model, API routes, isolation design, ingestion pipeline, tool loop, prompt-injection defenses, local setup, env vars, Render deployment, test walkthrough and scope cuts.
- **Why:** The README is a graded deliverable (what the app does, how to run it locally, env vars, how and where it's deployed, how to test it). Writing it first fixes the design before any code is written. The live URL and demo login are placeholders until the app is deployed.

## 2026-11-18 00:22 IST: Keep the assignment brief and JD out of git
- **Files:** `.gitignore`, `_private/requirements.md`, `_private/jd.md`
- **What:** Saved the assignment brief and the job description under `_private/`, and gitignored that folder. The `.gitignore` also covers `node_modules`, `dist`, and `.env*` (except `.env.example`).
- **Why:** The AI needs the brief as reference, but it shouldn't be public. The company's take-home brief and office address don't belong on GitHub. Deleting the files later wouldn't be enough, because they would stay in git history, and the commit history is graded. Ignoring `.env` from the start means secrets can't be committed (a quality-bar item).

## 2026-11-18 00:23 IST: Add this change log
- **Files:** `AI_CHANGE_LOG.md`
- **What:** Created this file.
- **Why:** The user wants a timestamped record of every change, written before the change is made. It also gives a fresh, honest trail of AI mistakes for `AI_NOTES.md`.

## 2026-11-18 00:25 IST: Handoff files for new chat sessions
- **Files:** `CLAUDE.md`, `PLAN.md`, `docs/DESIGN.md`, `_private/interview_prep.md`
- **What:** Wrote down everything decided so far so a fresh AI session can start any part without the earlier chat:
  - `CLAUDE.md`: entry point, with the stack, hard rules and the session workflow.
  - `PLAN.md`: Parts 0–8 with tasks, "done when" checks and status checkboxes.
  - `docs/DESIGN.md`: the detailed spec (schema columns, retrieval SQL, tool definitions, the loop, prompts, failure handling) and the design-review mistakes to avoid.
  - `_private/interview_prep.md` (gitignored): interview questions and the demo script.
- **Why:** The user is starting a new chat for each part. Claude Code loads `CLAUDE.md` automatically, and that file is also a graded deliverable. The plan and design have to live in files, not in chat history, so later sessions don't drift from them (for example, putting the workspace filter after the search or trusting `workspace_id` from the client).

## 2026-11-18 00:35 IST: Change the similarity threshold from a gate to a chunk filter (⚠ AI mistake)
- **Files:** `docs/DESIGN.md`, `CLAUDE.md`, `PLAN.md`, `README.md`, `_private/interview_prep.md`
- **What:** The threshold no longer short-circuits to "I don't know" before the LLM. It only decides which chunks go into the prompt, and that can be zero chunks (`<documents>NONE FOUND</documents>`). The LLM is always called with tools attached. Added a citation guard in code after the LLM answers: labels that weren't in the prompt are stripped, and an answer with no valid citation and no tool call is replaced with the fixed "I don't know" message, unless the message is small talk.
- **Why / how noticed:** The earlier flow, designed with AI help, gated the LLM on retrieval similarity. Tracing "save a task: call the vendor tomorrow" through the diagram showed it retrieves nothing similar, hits "I don't know" and never reaches the LLM, so every tool-only request would be silently blocked, because action requests don't look like document text. The citation guard keeps refusals deterministic in code now that the LLM is always called. This is a candidate for the "hardest bug" in AI_NOTES.md.

## 2026-11-18 00:37 IST: Initialise the git repo
- **Files:** `.git/` (new)
- **What:** Ran `git init -b main`. Nothing is committed yet.
- **Why:** The user asked for a git repo. Commit history is graded, so the repo has to exist before Part 0's first commit. `.gitignore` already keeps `_private/` and `.env` out.

## 2026-11-18 00:45 IST: Create the public GitHub repo
- **Files:** `.git/config` (adds the `origin` remote)
- **What:** Created the public repo `bsingh6636/multi-workspace-rag-assistant` with `gh repo create` and set it as `origin` (SSH). Nothing is pushed yet because there are no commits.
- **Why:** The user asked for a public repo. The name is spelled correctly, leaves out the company name, and tells a visitor what the project is. The local folder still has the old misspelled name. Renaming it is left to the user, because the running Claude session and its memory folder are tied to that path.

## 2026-11-18 00:50 IST: Per-part plan files, starting with Part 0
- **Files:** `docs/plans/part-0-setup.md` (new), `CLAUDE.md`
- **What:** Added a detailed plan file for Part 0 covering the files to create, the decisions, which steps the user does by hand (Supabase, Render, Gemini key, cron) and how to verify. Added a line to the CLAUDE.md session workflow: each part gets `docs/plans/part-N-*.md` written before any code, and the session stops after the part for the user's review.
- **Why:** The user asked for plans to live in files and for work to go one phase at a time, with a review after each phase. `PLAN.md` is the checklist; the per-part file holds the detail for that part so the user can review the plan alongside the code.

## 2026-11-18 00:53 IST: Part 0 code: SQL schema, server and client scaffold
- **Files:** `sql/schema.sql`, `sql/match_chunks.sql`, `server/**`, `client/**`, `package.json`, `.env.example`, `.nvmrc`
- **What:** Wrote the full schema (all tables, checks, cascades, indexes, RLS on with no policies) and the `match_chunks` function with the workspace filter inside the vector query. Scaffolded Express 5 + TS with `/health`, a JSON 404 for unknown `/api` routes, static serving of `client/dist` with an `index.html` catch-all, and a JSON error handler. Scaffolded Vite React TS with a page that calls `/health`. A root `package.json` gives Render one build and one start command.
- **Why:** Part 0 of `PLAN.md`. Details and decisions are in `docs/plans/part-0-setup.md`.

## 2026-11-18 01:02 IST: Tick the finished Part 0 code items
- **Files:** `PLAN.md`
- **What:** Ticked the scaffold, static serving and `.env.example` items. The SQL items stay open until the files are run in Supabase, and the Render, cron and Gemini items stay open until the user does them.
- **Why:** Locally verified: `npm run build` from the root builds both apps, `/health` returns 200 `{"ok":true}`, `/api/nope` returns a JSON 404, and an unknown client route returns `index.html`.

## 2026-11-18 02:23 IST: Keep the personal notes file out of git
- **Files:** `.gitignore`
- **What:** Added `user-later.md` to `.gitignore` and unstaged it. The file itself is unchanged.
- **Why:** The file holds the user's personal study notes. The user chose to keep it local so it doesn't appear in the graded commit history.

## 2026-11-18 02:24 IST: Part 1 plan: auth and workspaces
- **Files:** `docs/plans/part-1-auth-workspaces.md` (new)
- **What:** Wrote the detailed Part 1 plan: server config validation, Supabase admin client, `requireAuth` and workspace-ownership middleware, the `/api/me` bootstrap (profile plus "Default" workspace), workspace CRUD routes, and the client's login form, API helper and workspace switcher. It also lists the manual Supabase setting ("Confirm email" off) and the test steps.
- **Why:** Part 1 of `PLAN.md`, following the plan-file-first workflow.

## 2026-11-18 02:27 IST: Part 1 code: auth middleware, workspace routes, login and switcher
- **Files:** `server/src/{config,db,index}.ts`, `server/src/types/express.d.ts`, `server/src/middleware/{auth,workspace}.ts`, `server/src/routes/{me,workspaces}.ts`, `server/package.json`, `client/src/lib/{supabase,api}.ts`, `client/src/types.ts`, `client/src/components/{AuthForm,Dashboard,WorkspaceSwitcher}.tsx`, `client/src/App.tsx`, `client/src/index.css`, `client/package.json`
- **What:** Server: env validation, service-role Supabase client, Bearer JWT check, `requireWorkspace` ownership middleware (404 when not the owner), `/api/me` bootstrap of the profile and "Default" workspace, and workspace create/rename/delete. Client: email/password auth, an API helper that attaches the JWT, and a workspace switcher that restores `last_workspace_id`.
- **Why:** Part 1 of `PLAN.md`. Details are in `docs/plans/part-1-auth-workspaces.md`.

## 2026-11-18 02:40 IST: README: GET /api/me bootstrap, last-workspace rule, Confirm email setting
- **Files:** `README.md`
- **What:** API table now lists `GET /api/me` (creates the profile and "Default" workspace on first call). Features mention that a user's last workspace can't be deleted. Local setup says to turn off "Confirm email" in Supabase Auth.
- **Why:** Part 1 added these behaviours; the README has to match the code (CLAUDE.md workflow step 4).

## 2026-11-18 02:58 IST: Center and restyle the sign-in screen
- **Files:** `client/src/components/AuthForm.tsx`, `client/src/index.css`
- **What:** The auth screen gets its own full-height layout that centers the form on both axes, with a small app mark and a one-line subtitle above it. The submit button becomes a filled primary button. Inputs get a visible focus ring and smooth hover/focus transitions. The sign-in/sign-up switch moves into a separate box under the card. New styles are scoped under `.auth` and `button.primary`, so the dashboard is unchanged apart from the shared input focus ring.
- **Why:** The user flagged the login panel as badly placed: it was a 360px `.stack` inside the 880px `<main>`, so it sat at the top-left of the page instead of in the center, and the submit button looked the same as every other button.

## 2026-11-18 03:19 IST: Sign-in screen follows GitHub's layout, adds Continue with Google
- **Files:** `client/src/components/AuthForm.tsx`, `client/src/index.css`, `README.md`, `PLAN.md`
- **What:** The sign-in screen now follows GitHub's login layout. Content starts near the top instead of being centered vertically. There is a 48px mark, a title with no subtitle, bold labels, 40px inputs and button, and a 352px input column. The form keeps its bordered box. An "or" divider and a "Continue with Google" button (Supabase `signInWithOAuth`) sit under the submit button. "New to Workspace Assistant? Create an account" becomes a plain line under the box. README and PLAN mention Google sign-in and the Supabase provider setup it needs.
- **Why:** The user compared the screen with GitHub's login and asked for the same position and sizing, with the box kept around the form and the divider and "Continue with Google" button added.

## 2026-11-18 03:31 IST: Hosting moves from Render to AWS with Docker
- **Files:** `CLAUDE.md`, `PLAN.md`, `README.md`, `package.json`, `.env.example`, `docs/plans/part-0-setup.md`, `server/src/index.ts` (comment only)
- **What:** Replaced Render as the host with AWS running one Docker container. Removed the Render deploy and cron-job.org keep-alive steps from Part 0. Added a Dockerfile and AWS deploy step to Part 8. Changed the README hosting row, the live-demo note and the Deployment section to match, and changed the per-part test step from "live URL" to "locally". The Part 0 plan file keeps its original text, with a note at the top.
- **Why:** The user decided to deploy on AWS at the end. There isn't time to learn Render as well, and the recruiter said deployment can be skipped for now. The brief's "no credit card" rule conflicts with AWS, because an AWS account needs a card. The user knows about this conflict and accepted it.

## 2026-11-18 03:32 IST: ⚠ AI mistake: fix a line-number edit in server/src/index.ts
- **Files:** `server/src/index.ts`
- **What:** Restored the blank line before the `/health` comment and removed the old "Keep-alive target for the cron ping" line, so only the new "Health check for the container" comment is left.
- **Why:** The previous entry changed the comment with `sed '14s…'`, which targets a line *number*. Between reading the file and editing it, the file had moved down one line (another session was editing it), so the edit replaced the blank line 14 and left the old comment in place. This was noticed by grepping for leftover "cron" text afterwards. No code was lost. Fixed with an exact-text edit, and `tsc --noEmit` passes. Lesson: use exact-text edits, not line-number edits, on files that may be changing.

## 2026-11-18 03:35 IST: Point the Supabase MCP at the app's project and allow writes
- **Files:** `.mcp.json`
- **What:** Changed `project_ref` from `gfofdnkmpamisiligudz` to `hwrbhadkmooangthpgjv` (the project in `server/.env`) and removed `read_only=true`.
- **Why:** The MCP pointed at a different Supabase project, so it could never have seen the app's tables. The user chose to allow writes so the AI can create the schema with `apply_migration`, which Supabase records as a tracked migration. The user can turn read-only back on after setup.

## 2026-11-18 03:36 IST: Apply the schema to Supabase through the MCP
- **Files:** none in the repo (database only). Then `PLAN.md` ticks.
- **What:** Applied `sql/schema.sql` as migration `init_schema` and `sql/match_chunks.sql` as migration `match_chunks` to project `hwrbhadkmooangthpgjv`, using the Supabase MCP `apply_migration` tool. The files ran exactly as they are in git. Before applying, the project had no tables and no migrations.
- **Why:** Login failed with "Could not find the table 'public.profiles'" because the schema had never been run. Using `apply_migration` instead of pasting into the SQL Editor means Supabase records both steps as tracked migrations.

## 2026-11-18 03:55 IST: Split server into routes + controllers, axios client helpers, GitHub-style dialogs, switcher and toasts
- **Files:** `server/src/index.ts`, `server/src/routes/*`, `server/src/controllers/*` (new), `server/src/lib/httpError.ts` (new), `server/src/middleware/error.ts` (new), `server/src/middleware/workspace.ts`, `client/package.json`, `client/src/lib/http.ts` (replaces `lib/api.ts`), `client/src/components/*`, `client/src/index.css`, `README.md`, `CLAUDE.md`, `docs/DESIGN.md`, `docs/plans/part-1-auth-workspaces.md`
- **What:** Server: each resource now has a `routes/<name>.routes.ts` file (paths and middleware only, a plain `router` variable) and a `controllers/<name>.controller.ts` file (the handlers). `routes/index.ts` builds one `apiRouter` that runs `requireAuth` once and mounts the resource routers; `index.ts` just does `app.use('/api', apiRouter)`. `/api/me` + `meRouter` is renamed to `/api/profile` + profile routes, because it reads and updates the `profiles` row. Controllers throw `HttpError(status, message)` and zod errors instead of building error responses by hand; one error middleware turns `HttpError` → its status, `ZodError` → 400, Postgres `23505` → 409, anything else → 500. Client: `lib/http.ts` wraps axios with `getRequest/postRequest/patchRequest/deleteRequest`, an interceptor that adds the Bearer token, and one place that turns any failure into an `Error` with a readable message (including "can't reach the server" for a 502/network error). `window.prompt/confirm` are replaced by a modal built on the native `<dialog>` element (closes with Cancel or Esc, not on a backdrop click, so a half-typed name isn't lost). The `<select>` is replaced by a GitHub-style context switcher: a button showing the active workspace, which opens a popover with a filter box, a checkmark on the active item, and "New workspace". Rename/Delete move into a "Workspace settings" menu. Success and error messages show as toasts (`sonner`). Buttons follow GitHub's Primer styles (default, primary, danger, invisible) with Octicons.
- **Why:** The user found the browser `prompt/confirm` popups and plain buttons too basic, asked for dialogs/popovers and toasts, a reusable axios layer with central error handling, a better name than `meRouter`, and separate route and controller files so each file is easier to read.

## 2026-11-18 04:20 IST: Comment out Continue with Google for now
- **Files:** `client/src/components/AuthForm.tsx`, `README.md`, `PLAN.md`
- **What:** Commented out the "or" divider, the Continue with Google button and its `signInWithGoogle` handler. The code stays in the file so it can be turned back on later. `GoogleIcon` is also commented out so the linter doesn't flag an unused function. README and PLAN go back to email and password only, and the Google provider setup note is removed.
- **Why:** The user decided to skip Google login for now. Without the Supabase Google provider set up, the button would only show a "provider is not enabled" error.

## 2026-11-18 04:25 IST: Choose the Gemini models (tested with real requests)
- **Files:** `.env.example`, `README.md`, `CLAUDE.md`, `docs/DESIGN.md`, `PLAN.md`, `_private/interview_prep.md`
- **What:** Chat uses `gemini-3.6-flash`, with `gemini-3.5-flash-lite` as the fallback on 429/503. Embeddings use `gemini-embedding-001` with `outputDimensionality: 768`. Added `GEMINI_CHAT_FALLBACK_MODEL` and filled in the model names in `.env.example` (they aren't secrets). The retry policy now switches to the fallback model after retries on the primary run out. The `save_task` tool now asks for `due_date` as `YYYY-MM-DD`, and the system prompt includes today's date.
- **Why:** The AI Studio model list mixes free and paid models, so each candidate was tested with one small real request. `gemini-3.6-flash` and `3.5-flash-lite` called `save_task` correctly. `3.8-flash` and `4-hydrogen` returned 503 "high demand" (overloaded, not paid). `2.5-flash` returned 404 "no longer available to new users", even though the list shows it. Graders test at random times, so a reliable model beats a newer, overloaded one. The test also showed the model sending `due_date: "tomorrow"`, which `z.string().date()` would reject. Giving the model today's date and asking for ISO format avoids an `invalid_args` loop, and zod still catches anything else.
- **Also:** DESIGN.md now says to normalize 768-dimension `gemini-embedding-001` vectors to length 1, because truncated outputs aren't unit-normalized. It also adds a ~30s timeout on every Gemini call, since a request hung during testing.

## 2026-11-18 04:28 IST: Fill in the Gemini model names in the local server/.env
- **Files:** `server/.env` (gitignored, local only)
- **What:** Set `GEMINI_CHAT_MODEL=gemini-3.6-flash`, `GEMINI_EMBED_MODEL=gemini-embedding-001` and added `GEMINI_CHAT_FALLBACK_MODEL=gemini-3.5-flash-lite`. No secret values were read or changed.
- **Why:** Both model lines were empty, and Part 2 needs the embedding model. The values match the tested choices in `.env.example` and DESIGN §6.

## 2026-11-18 04:28 IST: Part 2 plan: ingestion
- **Files:** `docs/plans/part-2-ingestion.md` (new)
- **What:** Wrote the detailed Part 2 plan: upload route (multer, 5 MB, `.txt/.md/.pdf`), text extraction (pdf-parse v2, per page), normalization and SHA-256 dedup, the chunker, batched and normalized Gemini embeddings with retry, the document status lifecycle, list/delete routes, and the client Documents panel. It also records two choices for review: re-uploading a `failed` document retries it instead of returning "duplicate", and a document is capped at 300 chunks.
- **Why:** Part 2 of `PLAN.md`, following the plan-file-first workflow. pdf-parse v2 and batch `embedContent` were checked with a real call first (pages come back separately; 768-dim vectors have norm about 0.59, so they need normalizing).

## 2026-11-18 04:28 IST: Part 2 code: upload, extract, chunk, embed, store; Documents panel
- **Files:** `server/src/config.ts`, `server/src/services/{gemini,embeddings,chunker,extract,ingest}.ts` (new), `server/src/middleware/{upload,error}.ts`, `server/src/routes/{document,workspace}.routes.ts`, `server/src/controllers/document.controller.ts` (new), `server/test/chunker.test.ts` (new), `server/package.json`, `client/src/types.ts`, `client/src/components/{DocumentsPanel,DeleteDocumentDialog}.tsx` (new), `client/src/components/Dashboard.tsx`, `client/src/index.css`
- **What:** The upload route and ingestion pipeline described in `docs/plans/part-2-ingestion.md`: multer upload with extension and size limits, PDF/text extraction, normalization, SHA-256 dedup per workspace, heading-aware chunking (~800/150), batched Gemini embeddings (retry on 429/5xx/timeout, normalized to length 1), chunk rows stored with `workspace_id`, and the processing → ready/failed status. List and delete routes are scoped to the workspace. Client: a Documents panel with upload, status labels and delete.
- **Why:** Part 2 of `PLAN.md`.

## 2026-11-18 04:34 IST: Docs match the built ingestion; threshold finding for Part 3
- **Files:** `docs/DESIGN.md`, `README.md`, `docs/plans/part-2-ingestion.md`, `PLAN.md`
- **What:** DESIGN §3 now describes the chunker as built (sections by heading, then windows of at most 800 characters that end at the best paragraph/line/sentence/word break, with ~150 characters of overlap; PDFs by page), the rule that re-uploading a `failed` document retries it, the 300-chunk cap, and normalization before hashing. The README pipeline sketch matches. The Part 2 plan records the end-to-end results and the measured similarity scores. Ticked the Part 2 server items in `PLAN.md`.
- **Why:** The plan said "pack paragraphs", but a sliding window per section turned out simpler and gives a hard 800-character cap, so the spec has to match the code (workflow step 4). The end-to-end test found that an unrelated question ("capital of France?") scores about 0.54 against the Falcon docs, above the default `SIMILARITY_THRESHOLD` of 0.5. Part 3 needs to tune it, likely to about 0.65.

## 2026-11-18 04:42 IST: Toasts move to the top right and get type colours
- **Files:** `client/src/App.tsx`
- **What:** The sonner `<Toaster>` now uses `position="top-right"` with a top offset of 76px, so toasts sit just under the 64px header instead of covering the avatar. `richColors` is on, so success toasts are green, errors red, info (e.g. "already in this workspace, so it was skipped") blue and warnings yellow.
- **Why:** The user asked for toasts at the top right and for success and failure to look different. **⚠ AI mistake:** `richColors` had already been added once in this session but was missing from `App.tsx` (the file was rewritten while the Part 2 session was working in parallel). The user noticed when every toast looked the same.

## 2026-11-18 04:44 IST: Documents list hides the "Ready" badge
- **Files:** `client/src/components/DocumentsPanel.tsx`
- **What:** `StatusLabel` renders nothing for `ready`. Only "Processing" and "Failed" still show a badge.
- **Why:** The user asked for it: ready is the normal state, so no badge means ready, and the badges left are the ones that need attention.

## 2026-11-18 04:47 IST: ⚠ AI mistake: Node types missing for server tests in the editor
- **Files:** `server/tsconfig.json`, `server/test/tsconfig.json` (new), `server/package.json`
- **What:** The root tsconfig now lists `"types": ["node"]` explicitly. A new `test/tsconfig.json` extends it, includes `test/` and `src/`, and never emits, so the editor type-checks the tests with Node's types. `npm run typecheck` now checks the tests too.
- **Why:** The user's editor showed "Cannot find name 'node:assert/strict'" in `test/chunker.test.ts`. The Part 2 work added `test/` outside the tsconfig `include` (only `src`), so the editor checked it as a loose file. Recent TypeScript no longer loads every `@types` package by default, and `src/` only got Node's types indirectly through `@types/express`. `tsx --test` doesn't type-check, so the tests still ran and nothing caught it.

## 2026-11-18 04:50 IST: Part 3 plan: scoped RAG chat
- **Files:** `docs/plans/part-3-rag-chat.md` (new)
- **What:** Wrote the detailed Part 3 plan: retrieval with the threshold as a filter, the prompt layout (system rules, XML-escaped `<documents>` with prompt-local labels, history with old labels stripped), the LLM call with retry and fallback model, the citation guard with a small-talk exception, chat and message routes including retry of a failed answer, and the client chat UI. Lists the decisions to review and how to tune the threshold.
- **Why:** Part 3 of `PLAN.md`, following the plan-file-first workflow. A probe just before planning found `gemini-3.6-flash` returning 503 "high demand" while `gemini-3.5-flash-lite` answered correctly with a `[c1]` citation, so the fallback path is needed in practice, not just on paper.

## 2026-11-18 04:50 IST: Part 3 code: retrieval, prompt, LLM with fallback, citation guard, chats; chat UI
- **Files:** `server/src/config.ts`, `server/src/db.ts`, `server/src/types/express.d.ts`, `server/src/services/{retrieve,prompt,llm,citations,chat}.ts` (new), `server/src/middleware/chat.ts` (new), `server/src/routes/{chat,workspace}.routes.ts`, `server/src/controllers/chat.controller.ts` (new), `server/test/citations.test.ts` (new), `client/src/types.ts`, `client/src/components/{ChatPanel,ChatMessage}.tsx` (new), `client/src/components/Dashboard.tsx`, `client/src/index.css`
- **What:** The chat flow from `docs/plans/part-3-rag-chat.md`: the user message is saved first, then a pending assistant row. Retrieval runs `match_chunks` (workspace filter inside the query) and keeps chunks at or above the threshold (zero is fine). The prompt holds escaped, labelled chunks. Gemini is called with retry and the fallback model. The citation guard strips invented labels and forces the fixed refusal for uncited answers. Retry reuses the failed row. Client: a chat tab with a chat list, messages, sources and Retry.
- **Why:** Part 3 of `PLAN.md`.

## 2026-11-18 04:59 IST: Set SIMILARITY_THRESHOLD to 0.62 from measured scores; record Part 3 results
- **Files:** `.env.example`, `server/.env` (local), `server/src/config.ts`, `docs/DESIGN.md`, `README.md`, `docs/plans/part-3-rag-chat.md`, `PLAN.md`
- **What:** The default threshold goes from 0.5 to 0.62 everywhere. DESIGN §2 records the measurement. The Part 3 plan gets a results section (end-to-end checks, scores, latency). Ticked the Part 3 server items in `PLAN.md`.
- **Why:** In the Part 3 end-to-end test (`gemini-embedding-001`, 768 dims, normalized), relevant questions scored 0.69–0.79 top-1 and unrelated ones 0.54–0.58, across 13 questions in two workspaces. At 0.5 every unrelated question would put chunks in the prompt. 0.62 sits in the gap, a little closer to the unrelated side, because dropping a real answer is worse than letting an off-topic chunk through (the prompt and citation guard still refuse). Retune on the Part 6 seed docs.

## 2026-11-18 05:01 IST: Tick the Part 3 client item after a browser check
- **Files:** `PLAN.md`, `docs/plans/part-3-rag-chat.md`
- **What:** Ticked "Client: chat UI…" and added the browser results to the Part 3 plan.
- **Why:** Headless Chrome (puppeteer-core installed only in the session scratchpad, not the repo) logged in as a throwaway user, asked two questions through the UI, reloaded and switched tabs. The cited answer, the Sources box, the refusal, the history after reload, the Documents tab and the 390px mobile layout all rendered correctly. The test user was deleted afterwards.

## 2026-11-18 05:06 IST: ⚠ AI mistake: chat tab overflowed the window and shifted the layout; thin themed scrollbars
- **Files:** `client/src/components/Dashboard.tsx`, `client/src/index.css`
- **What:** The app shell is now a flex column. On the Chat tab it gets `app-fit` (exactly one window tall), and the chat box takes the remaining height with `flex: 1` instead of `height: calc(100vh - 230px)`. So the page itself never scrolls there; only the message list and chat list do. `html { scrollbar-gutter: stable }` keeps the page width the same whether or not a page scrollbar is showing, so switching tabs can't move the content sideways. All scrollbars are thin and use theme colours (`--scrollbar-thumb`, light and dark).
- **Why:** The user saw the layout jump when switching between Chat and Documents, and a page scrollbar on the Chat tab even in full screen. The Part 3 chat CSS guessed the space above the chat as a fixed 230px. The real header, title, tabs and padding are taller, so the page overflowed by a few pixels and showed a scrollbar on Chat only. That scrollbar made the centred content narrower, so it jumped. Noticed by the user from a screenshot.

## 2026-11-18 05:07 IST: "New chat" is disabled while the current chat is already empty
- **Files:** `client/src/components/ChatPanel.tsx`
- **What:** `isEmptyChat = activeChatId === null && messages.length === 0`, computed during render. The New chat button is disabled when it's true (no chats yet, or New chat was just clicked), with a tooltip saying why.
- **Why:** The user asked for it: clicking New chat on an already-empty chat does nothing. A derived value was used instead of the user's `useEffect` + `chats.length` idea. An effect would add an extra render and a second copy of the state. Also, `chats.length` alone would be wrong: with saved chats in the list, the user can still be sitting on a fresh empty chat. A chat row is only created when its first message is sent, so a saved chat is never empty and `activeChatId === null` covers every empty case.

## 2026-11-18 05:09 IST: Unsent chat drafts are kept per chat in localStorage
- **Files:** `client/src/components/ChatPanel.tsx`
- **What:** The composer text is saved to localStorage as you type, under `draft:<workspaceId>:<chatId or "new">`. Opening a chat, starting a new chat or reloading the page brings back that chat's draft. Sending clears it. If a send fails and the question wasn't saved, the text goes back into the box and back into storage. Every storage access is in try/catch, so a private window or blocked storage just means no draft is kept.
- **Why:** The user asked how ChatGPT and Claude keep a half-typed message and to copy that if it was simple. localStorage was chosen over IndexedDB because a draft is one short string per chat. It's per-browser convenience, not data, so it doesn't belong in the database.

## 2026-11-18 05:10 IST: Client retries GET requests twice (after 3s, then 5s) when the server can't be reached
- **Files:** `client/src/lib/http.ts`
- **What:** In the axios response interceptor, a GET that fails with no response or a 502/503/504 is retried after 3 s, and again after 5 s. Only then does the caller get "Can't reach the server". Loading states (spinners) stay up during the retries. POST, PATCH and DELETE are never retried automatically, because repeating them could, for example, send a chat message twice.
- **Why:** The user's screenshot showed "Couldn't load your workspaces: Can't reach the server" right after the API restarted (`tsx watch` restarts it whenever a server file changes; a deploy would do the same). The user asked for 2 retries at 3 s and 5 s.

## 2026-11-18 05:14 IST: ⚠ AI mistake: answers and uploads stuck forever when the server restarts mid-request
- **Files:** `server/src/services/recovery.ts` (new), `server/src/index.ts`, `docs/DESIGN.md`
- **What:** On startup, before it accepts requests, the server runs `failInterruptedWork()`. Any assistant message still `pending` becomes `failed` ("The server restarted while answering. Please retry."), so the client shows Retry. Any document still `processing` becomes `failed`, and its partial chunks are deleted. Then `app.listen` runs. If the cleanup itself fails (e.g. the DB is unreachable), it's logged and the server starts anyway.
- **Why:** The user's screenshots showed "capital of france" stuck on "Thinking…", still there after a reload. The assistant row had been saved as `pending`, and then `tsx watch` restarted the server mid-answer, so nothing ever marked it `done` or `failed` (hard rule 9 assumed the process survives). Uploads had the same hole, and it was worse: a document stuck in `processing` is returned as a "duplicate" on re-upload, so the file could never be added again. Its partial chunks were also still searchable, because `match_chunks` doesn't filter on document status. A startup sweep was chosen over the SIGINT/SIGTERM handler the user suggested. A signal handler doesn't run on a crash, `kill -9` or an out-of-memory kill, and would need tracking of in-flight requests. The sweep covers every case, because the server always starts again before anyone can use it. It relies on there being one server process (one container, as decided); with several instances it would fail another instance's live work.

## 2026-11-18 05:22 IST: Research notes: Gemini model checks, LLM latency benchmark, upload rate limit
- **Files:** `docs/research/llm-models-and-latency.md` (new), `docs/research/bench-llm.mjs` (new)
- **What:** Wrote down the Gemini model availability tests (which models answer on the free key, tool calling, 768-dim embeddings), the latency benchmark of Gemini against Claude through MWAPI (same RAG-shaped request, with medians), the quota errors seen, and why a 34-page PDF upload failed with "embedding service is rate-limited". Saved the benchmark script so it can be run again. It reads keys from env vars and contains no secrets.
- **Why:** The user asked to keep these results as research notes in the repo. They back the model choices and the next fixes to retries and fallback.

## 2026-11-18 05:24 IST: Answer sources become a collapsible accordion
- **Files:** `client/src/components/ChatMessage.tsx`, `client/src/index.css`
- **What:** The Sources box under an answer is now a native `<details>` element, collapsed by default. The summary row reads e.g. "5 sources from 3 documents", with a chevron that turns when it opens. Expanding it shows the same numbered list (file, page/section, similarity) as before.
- **Why:** The user asked for sources as a collapsible accordion: a long source list under every answer made the chat hard to scan. `<details>/<summary>` needs no state or JS and is keyboard- and screen-reader-accessible out of the box.

## 2026-11-18 05:30 IST: Answers drop inline citation numbers; sources are listed once per document
- **Files:** `client/src/components/ChatMessage.tsx`, `client/src/index.css`
- **What:** The `[cN]` markers are removed from the displayed answer text (with the space before them), so no superscript numbers appear after each point. The collapsible Sources list now shows each document once: filename, the pages/sections it was cited from, and its best similarity score. The summary reads e.g. "Sources · 3 documents". Display only: the server still uses `[cN]` for the citation guard and stores per-chunk citations unchanged.
- **Why:** The user found the numbers after every point noisy and asked for just the documents, numbered, in the collapsible at the end. The same file used to appear several times when several of its chunks were cited.

## 2026-11-18 05:33 IST: Research notes: MWAPI can't serve Gemini or embeddings
- **Files:** `docs/research/llm-models-and-latency.md`
- **What:** Added §5: MWAPI lists only 10 Claude models. Its `/embeddings` returns 404 "Embeddings API is not supported", a Gemini-style `:embedContent` returns 404, and `/messages` with a Gemini model returns `model_not_found`. Also recorded why a different embedding model can't be a fallback, and the options that do work.
- **Why:** The user asked whether MWAPI could act as a same-model Gemini fallback when the Gemini rate limit hits, so uploads don't break. The probes show it can't.

## 2026-11-18 05:36 IST: Workspace title row removed; settings menu moves next to the switcher; wider main area
- **Files:** `client/src/components/Dashboard.tsx`, `client/src/components/WorkspaceMenu.tsx`, `client/src/index.css`
- **What:** Removed the page heading (workspace name + "…" menu) above the tabs. The "…" workspace settings menu (Rename / Delete) now sits in the header right after the workspace switcher. The tabs are the first row of the main area. `.app-main` max width goes from 1012px to 1280px (still centred, not full width).
- **Why:** The user pointed out the heading repeated the name already shown in the header switcher and took vertical space from the chat. Putting the settings menu beside the switcher keeps every workspace action (switch, create, rename, delete) in one spot, next to the name it acts on.

## 2026-11-18 05:38 IST: Workspace names are unique ignoring case; new workspaces default to Default, Default_2, …
- **Files:** `server/src/controllers/workspace.controller.ts`, `client/src/lib/workspaceNames.ts` (new), `client/src/components/WorkspaceNameDialog.tsx`, `client/src/components/Dashboard.tsx`, `client/src/index.css`, `docs/DESIGN.md`
- **What:** The server rejects a create or rename with 409 "A workspace named “X” already exists" when another of the user's workspaces has the same name, ignoring case and surrounding spaces. Before, only exact matches were blocked by `UNIQUE (user_id, name)`, so "Research" and "research" could both exist. The create dialog now starts filled with the next free name: "Default", then "Default_2", "Default_3", and so on. The dialog shows the duplicate error under the input as you type and disables the submit button, so you don't have to wait for the server round trip.
- **Why:** The user asked that two workspaces can never share a name, that the default follows the Default / Default_2 pattern, and that a duplicate shows an error. The DB constraint stays as the backstop for two exact-name requests racing.

## 2026-11-18 05:43 IST: Upload size limit = 95% of one minute's embedding quota
- **Files:** `server/src/config.ts`, `server/src/services/ingest.ts`, `server/src/services/uploadLimit.ts` (new), `server/test/uploadLimit.test.ts` (new), `client/src/components/DocumentsPanel.tsx`, `.env.example`, `README.md`, `docs/DESIGN.md`, `docs/research/llm-models-and-latency.md`
- **What:** Replaced the fixed 300-chunk cap with a limit taken from the embedding quota. A document may need at most 95% of one minute's quota: chunks ≤ 95% of `GEMINI_EMBED_RPM` (each chunk counted as one request) and chunk text ≤ 95% of `GEMINI_EMBED_TPM` × 4 characters per token. The defaults are 100 RPM and 30,000 TPM, set in env. A larger file is rejected with 413 before any embedding or DB write, and the message gives its size in pages (PDF) or characters and the approximate maximum. The check is a pure function with unit tests.
- **Why:** A 34-page PDF failed partway through with "embedding service is rate-limited", because embedding it needed more than one minute of the free quota, while the 300-chunk cap allowed it. The user asked to block uploads above 95% of what fits, with a clear error. Google doesn't publish free-tier embedding limits (they're per account in AI Studio), so the values are env vars with commonly seen defaults.

## 2026-11-18 05:48 IST: Startup cleanup always logs its result
- **Files:** `server/src/index.ts`, `server/src/services/recovery.ts`
- **What:** `failInterruptedWork()` now returns `{ answers, uploads }` (how many rows it marked failed) instead of logging only when something was found. `start()` logs "Startup cleanup: marked N interrupted answer(s) and M interrupted upload(s) as failed" on every boot, including 0/0.
- **Why:** The user asked for a log at the cleanup call in `start()`. Before, a clean boot printed nothing, so you couldn't tell from the logs whether cleanup had run at all.

## 2026-11-18 06:04 IST: Reminder in PLAN.md: check pagination at the end
- **Files:** `PLAN.md`
- **What:** Added a Part 8 item: review the list endpoints that can grow (documents, chats, tool-call log, tasks) and make sure each has a limit or pagination. Message pagination inside a chat stays out of scope (CLAUDE.md).
- **Why:** The user asked to be reminded to check pagination where it's needed, at the end of the build.

## 2026-11-18 06:06 IST: Part 4 plan: tool loop
- **Files:** `docs/plans/part-4-tool-loop.md` (new)
- **What:** Plan for the tool registry (`save_task`, `list_tasks`, `send_discord_summary`), the loop (max 3 rounds, then a forced text answer), logging every call to `tool_calls`, the two GET routes, idempotent side effects on Retry, and the browser's time zone for "today". It records a real tool-call probe on `gemini-3.5-flash-lite`. The reply carries a `thoughtSignature`, so the model's turn must be sent back unchanged.
- **Why:** Session workflow: each part's plan is written before its code.

## 2026-11-18 06:06 IST: Part 4 code: tool registry, loop, logging, tasks and tool-call routes
- **Files:** `server/src/config.ts`, `server/src/services/tools.ts` (new), `server/src/services/toolLoop.ts` (new), `server/src/services/llm.ts`, `server/src/services/prompt.ts`, `server/src/services/chat.ts`, `server/src/controllers/chat.controller.ts`, `server/src/controllers/task.controller.ts` (new), `server/src/controllers/toolCall.controller.ts` (new), `server/src/routes/task.routes.ts` (new), `server/src/routes/toolCall.routes.ts` (new), `server/src/routes/workspace.routes.ts`, `server/test/tools.test.ts` (new), `client/src/components/ChatPanel.tsx`
- **What:** As in the plan.
  - The model calls tools from an allowlist. Arguments are checked with strict zod schemas, which also produce the Gemini declarations.
  - `workspaceId`, `chatId` and `messageId` come from the server.
  - Every attempt is logged with its status and latency.
  - The loop runs up to `MAX_TOOL_ITERATIONS` rounds and keeps one model for the whole turn.
  - The citation guard gets `toolCalled`.
  - "Today" uses the browser's time zone.
- **Why:** PLAN Part 4. Tool-only requests ("save a task…") must work even when no documents match (hard rule 7).

## 2026-11-18 06:12 IST: ⚠ AI mistake: Discord posts contained [cN] labels, and the summary answer had no sources
- **Files:** `server/src/services/tools.ts`, `server/src/services/toolLoop.ts`, `server/src/services/citations.ts`, `server/src/services/chat.ts`, `server/src/services/prompt.ts`, `server/test/citations.test.ts`, `server/test/tools.test.ts`
- **What:**
  - `send_discord_summary` removes `[cN]` labels before posting. They're prompt-local and mean nothing in Discord.
  - The loop now returns every tool call of the turn. The citation guard also counts valid labels found in those calls' arguments (`toolText`), so an answer whose facts went into a Discord summary still lists its sources. Only labels that exist in this prompt count, and the answer text is unchanged.
  - The prompt says not to put `[cN]` labels in tool arguments.
- **Why:** The Part 4 end-to-end run. "Summarise the Project Falcon document and send it to Discord" posted "…payments gateway [c2]…" to the webhook. The model cited in the tool argument instead of its reply ("I have posted the summary…"), so the answer had 0 citations. A tool was called, so the guard let it through without sources. The plan assumed the model would follow "cite the chunks in your reply". It didn't, so this is enforced in code.

## 2026-11-18 06:15 IST: Docs match the built tool loop; tick Part 4 in PLAN.md; record results
- **Files:** `docs/DESIGN.md`, `README.md`, `PLAN.md`, `docs/plans/part-4-tool-loop.md`
- **What:**
  - DESIGN §4: the guard also counts labels from tool arguments.
  - DESIGN §5 is rewritten to match the code:
    - strict schemas generated into the declarations
    - the loop with a forced text answer
    - one model per turn
    - at most 5 calls per reply
    - `toolCalled` means "any attempt"
    - idempotent side effects on Retry
    - Discord safety (labels stripped, mentions off)
    - the browser's time zone
  - README: the layout lists `toolLoop.ts`; the tool loop sketch and the defenses list match.
  - PLAN: the Part 4 boxes are ticked.
  - The plan file gets a results section.
- **Why:** Session workflow: decisions that changed are written into DESIGN and the README in the same session.

## 2026-11-18 06:35 IST: gemini-3.5-flash-lite becomes the primary chat model everywhere
- **Files:** `.env.example`, `server/src/config.ts`, `README.md`, `docs/DESIGN.md`, `CLAUDE.md`
- **What:** The primary chat model is `gemini-3.5-flash-lite` and the fallback is `gemini-3.6-flash`, in the config defaults, `.env.example`, the README, DESIGN §6 and CLAUDE.md.
- **Why:** The user decided flash-lite is primary. Their `server/.env` already used that order, and the docs said the reverse.
  - In Part 3, `gemini-3.6-flash` returned 503 on every call (20–60 s answers via the fallback). It later returned 429 because its daily quota was used up.
  - flash-lite answered in about 1 s, with correct citations and tool calls (research note §2).

## 2026-11-18 06:35 IST: Remove the empty duplicate DISCORD_WEBHOOK_URL line from server/.env
- **Files:** `server/.env` (gitignored, local only)
- **What:** Deleted the empty `DISCORD_WEBHOOK_URL=` line. The URL the user added further down is kept unchanged.
- **Why:** With two lines, only the last one counts (it did load correctly). An empty line above it is easy to misread, or to "fix" the wrong one.

## 2026-11-18 06:35 IST: Chat answers show the tool calls they made, with the reason when one failed
- **Files:** `server/src/controllers/chat.controller.ts`, `server/src/services/chat.ts`, `server/src/db.ts`, `client/src/types.ts`, `client/src/components/ChatMessage.tsx`, `client/src/index.css`, `docs/DESIGN.md`
- **What:**
  - The messages API embeds each answer's tool calls (`tool_calls(tool_name, status, error, args, created_at)`, oldest first) through the `message_id` foreign key.
  - Under an answer, the client shows a small line per call. A success reads like "✓ Saved task “Review the Falcon launch plan”". A failure reads like "✕ Discord: Discord isn't set up on this server", with the stored reason.
  - Identical repeats from a Retry are shown once.
  - Every attempt, with its reason, is already stored in `tool_calls` (status and error).
- **Why:** The user confirmed that every attempt is recorded, a failed one with its reason, and asked for it to be shown in small text.

## 2026-11-18 06:38 IST: ⚠ AI mistake: the chat overflowed phone screens when a chat title is long
- **Files:** `client/src/index.css`
- **What:** The chat grid columns are `minmax(0, 1fr)` instead of `1fr` (desktop `240px minmax(0, 1fr)`, phone `minmax(0, 1fr)`). Now a long chat title is cut off with "…" as intended, instead of widening the whole chat. The new tool-call lines are block lines inside a list limited to 90% of the message width. Before, they were squeezed into a narrow column ("Posted to / Discord").
- **Why:** Found in the Part 4 browser check (390px screenshot): with the title "Post this exact message to Discord: Test messa…", messages and the composer were cut off on the right.
  - A `1fr` grid column can't be narrower than its content, so the `nowrap` title set the width. The Part 3 check used a short title, so it didn't show up.
  - The narrow tool lines came from this session's CSS: a percentage `max-width` on an item inside a list that sizes itself to its content.

## 2026-11-18 06:41 IST: "What abilities do you have?" counts as small talk; task questions go through list_tasks
- **Files:** `server/src/services/citations.ts`, `server/src/services/prompt.ts`, `server/test/citations.test.ts`, `docs/DESIGN.md`
- **What:**
  - The small-talk check now also matches questions about the assistant itself: "what abilities/capabilities/features/tools do you have", "what are your abilities", "what can you / this chat / the model do", "how can you help". It accepts "u" for "you", and a word stem (`abilit…`, `capabilit…`) so a typo like "abilitiles" still matches. The whole message must still be such a question, so "what can you tell me about Falcon?" still needs a citation.
  - The system prompt lists what the assistant can do (answer from this workspace's documents with sources, save tasks, list tasks, post a summary to Discord).
  - New prompt rule: questions about the workspace's tasks ("what's pending", "when do I need to …") call `list_tasks` instead of answering from memory or refusing.
- **Why:** In the user's test, "what abilitiles do u have ?" and a "when do i need to …" task question (asked right after "get my tasks") both got the fixed "I don't know".
  - The first didn't match the small-talk regex, so the citation guard replaced the answer.
  - For the second, the prompt only allows facts from `<documents>`, and the guard blocks uncited answers when no tool ran. Answering from chat history was rejected: history holds user text and old model wording, so a user could plant a "fact" and get it repeated without a source. Calling `list_tasks` again gives fresh, logged data, and the guard already accepts turns that called a tool.

## 2026-11-18 06:43 IST: The "what can you do" list is built from the tool registry
- **Files:** `server/src/services/tools.ts`, `server/src/services/prompt.ts`, `server/src/services/chat.ts`, `server/test/tools.test.ts`, `CLAUDE.md`
- **What:**
  - Each tool in the registry has a short `ability` line ("save tasks, with an optional due date").
  - `buildSystemPrompt(today, abilities)` lists document Q&A plus every tool's ability. `chat.ts` passes `toolAbilities` from the registry.
  - A test checks that every tool has an ability and that each one appears in the prompt.
  - New CLAUDE.md rule: a new or changed tool sets its `ability`. A new feature that isn't a tool is added to the fixed part of the list in `prompt.ts`.
- **Why:** The user asked that the abilities answer stays up to date whenever functionality is added or changed. The 06:41 change wrote the list by hand in the prompt, so a new tool could be missing from it. Built from the registry, the same list that declares the tools describes them.

## 2026-11-18 06:49 IST: Record the Discord posting problems found in the user's manual test
- **Files:** `docs/plans/part-4-tool-loop.md`
- **What:** Added a "User's manual test (06:35–06:48)" section to the Part 4 results. It lists the four Discord posts and the refused capability question, with what was asked, what was posted and why. Facts were taken from the `messages`, `tool_calls` and `chunks` tables. No code changed. The fix is proposed, waiting for the user's decision.
- **Why:** The user asked for this event to be recorded. Three of the four posts should not have gone out: invented text, a "not found" non-answer, and a question treated as a command. The fourth was true but showed no source.

## 2026-11-18 06:58 IST: Record the second round of Discord posts (06:48–06:56), including "NONE FOUND" and abusive text
- **Files:** `docs/plans/part-4-tool-loop.md`
- **What:** Extended the incident section with 10 more posts from `tool_calls`:
  - The literal prompt marker "NONE FOUND".
  - Two more question-style or history-copied posts.
  - Five sexually explicit or harassing messages about a named person, dictated in the user's test. They were posted unfiltered, and Gemini didn't refuse.
  - The abusive text is described, not copied. No code changed.
- **Why:** The user pointed out that a "NONE FOUND" message was also posted. The query for it found the rest. The abusive posts show the proposed fix ("allow text the user dictated") isn't enough on its own: outbound posts also need a content check.

## 2026-11-18 07:03 IST: Discord posts need a source, unsafe content is blocked, fixed replies for "can't do" and "what to post"
- **Files:** `server/src/services/tools.ts`, `server/src/services/citations.ts`, `server/src/services/prompt.ts`, `server/src/services/llm.ts`, `server/src/services/chat.ts`, `server/test/tools.test.ts`, `server/test/citations.test.ts`, `docs/DESIGN.md`, `docs/plans/part-4-tool-loop.md`
- **What:**
  1. **Discord source check (code).** `send_discord_summary` refuses text unless it cites `[cN]` chunks from this answer's prompt, or every word of it is in the user's current message (dictated). The tool context gets the turn's chunk labels and the user message from the server.
  2. **Safety settings.** Every Gemini call blocks harassment, hate and sexually explicit content at LOW and above, and dangerous content at MEDIUM and above. A blocked reply becomes a `done` answer with a fixed "I can't help with that." It isn't a `failed` answer, because Retry wouldn't help. Blocked turns are left out of later history, so one bad message doesn't block the rest of the chat.
  3. **Fixed replies the guard accepts.** "I can't do that." (for actions no tool can do, like scheduling or reading Discord, and for content it won't post); the server replaces it with that text plus the abilities list. "What should I post to Discord? …" (a post request with no content, or "can you send a Discord message?"). The model can't add facts to either: the guard swaps in the fixed text.
  4. **Prompt.** Discord summaries put the `[cN]` labels inside the summary (removed before posting). Post only the user's exact words or a cited summary. "Not found" is never posted. Questions aren't commands. No insults, sexual content or claims about people.
  5. **Small talk.** Matched on letters only, after an optional greeting, so "hi , who are yo u" counts. The `abilit…`/`capabilit…` stems are capped at 6 extra letters.
- **Why:** The user's manual tests (06:35–06:56) got invented, "not found", "NONE FOUND", history-copied and abusive posts through to Discord, because "a tool was called" skipped the citation guard. "hi , who are yo u" and "can u schedule a discord message after 1 min" got the document refusal instead of an answer about the assistant. Scheduling itself isn't built: it's a new feature, so the assistant now says it can't do it.

## 2026-11-18 07:04 IST: ChatGPT-style chat list and conversation layout (Primer theme kept)
- **Files:** `server/src/controllers/chat.controller.ts`, `client/src/types.ts`, `client/src/components/ChatPanel.tsx`, `client/src/components/ChatMessage.tsx`, `client/src/index.css`, `docs/DESIGN.md`
- **What:**
  1. `GET /chats` returns `last_message_at` (the newest message's time, from an embedded `messages` select limited to 1) and sorts by it, so a chat you continue moves to the top. No schema change.
  2. Chat list grouped under "Today", "Yesterday", "Previous 7 days", "Previous 30 days" and "Older" by last activity. Sending a message moves that chat to the top straight away. Full title shows on hover.
  3. Conversation and composer sit in a centered column (max 768px). A header shows the open chat's title.
  4. Composer is one rounded box with the send button inside that grows with the text (up to about 8 lines), plus a hint line under it.
  5. Copy button under each finished assistant answer (copies the text without `[cN]` markers).
- **Why:** The user asked to borrow the good parts of ChatGPT's chat history and layout while keeping our theme. Delete chat, rename, pin and search were left out (rename is out of scope; delete needs a yes).

## 2026-11-18 07:07 IST: Clearer, red warning in the delete-workspace dialog
- **Files:** `client/src/components/DeleteWorkspaceDialog.tsx`, `client/src/index.css`
- **What:** The warning box is now red (`flash-error`, matching the dialog's red title) instead of yellow. It leads with a bold "This can't be undone.", names the workspace in bold and lists what is deleted as bullets (documents, chats, tasks, tool-call log). The name to type in the confirm label is shown bold in monospace, like GitHub's delete-repository dialog.
- **Why:** The user found the single grey sentence on a yellow box easy to skim past for a destructive action (screenshot 07:07).

## 2026-11-18 07:08 IST: Skeleton rows in the chat list while it loads
- **Files:** `client/src/components/ChatPanel.tsx`, `client/src/index.css`
- **What:** `ChatPanel` tracks `loadingChats`. While the list is loading, the sidebar shows a placeholder section label and six grey rows of varying width with a soft pulse (still under `prefers-reduced-motion`). "No chats yet" now appears only after the list has loaded, instead of flashing first.
- **Why:** The user asked for a skeleton or a browser cache for the chat list. A skeleton was chosen: caching chat titles in localStorage would leave a user's question text in the browser after sign-out (shared computers), could show chats that were deleted elsewhere, and needs invalidation code. The list call is a single fast query, so a skeleton covers the wait.

## 2026-11-18 07:10 IST: No empty-state flash when a workspace's chat opens; message skeleton instead of a spinner
- **Files:** `client/src/components/ChatPanel.tsx`, `client/src/index.css`
- **What:**
  - `loadingMessages` starts `true`, so the first render shows the loading state, not "Ask about this workspace's documents". It turns false once the list is in and either there are no chats or the newest chat's messages have loaded.
  - The loading state is a skeleton shaped like a conversation (two right-aligned question bubbles, each followed by lines of answer), used both on first load and when switching chats.
  - The chat header shows a grey bar instead of "New chat" while the list loads.
- **Why:** The user saw empty message → spinner → chats (or back to the empty message) on every load. The empty state appeared first because `loadingMessages` started `false` while the chat list was still loading.

## 2026-11-18 07:11 IST: Skeleton rows in the documents panel while it loads
- **Files:** `client/src/components/DocumentsPanel.tsx`, `client/src/index.css`
- **What:** The spinner is replaced by three placeholder rows shaped like document rows (icon, filename line, meta line, status pill), using the shared `.skeleton` style. The document counter is hidden until the list has loaded, instead of showing 0.
- **Why:** The user asked whether documents should get a skeleton like the chat list. It keeps loading states consistent, and rows of the real height stop the panel from jumping when the list arrives.

## 2026-11-18 07:20 IST: Copy button shows on hover (always on the latest answer); account menu no longer breaks the email mid-word
- **Files:** `client/src/components/ChatMessage.tsx`, `client/src/components/ChatPanel.tsx`, `client/src/components/UserMenu.tsx`, `client/src/index.css`
- **What:**
  - Copy button under an answer is hidden until the answer is hovered or the button gets keyboard focus, like ChatGPT. The latest answer always shows it. Touch screens (no hover) always show it.
  - Account menu: the email stays on one line (cut with "…" past 260px, full address on hover) instead of wrapping at any character ("bkushwaha.dev@gmai / l.com").
- **Why:** The user found a copy icon under every answer noisy (screenshot 07:17) and suggested moving it or adding a toggle in the profile menu. Hover reveal keeps the button where people expect it without adding a setting. The email wrapped mid-word because `.menu-header` had `overflow-wrap: anywhere` inside a popover that shrinks to its narrowest content.

## 2026-11-18 07:21 IST: Account menu header becomes an account card (avatar, name, email)
- **Files:** `client/src/components/UserMenu.tsx`, `client/src/index.css`
- **What:** The "Signed in as <email>" text is replaced by a card: a 40px avatar (Google picture or initial), the name from the Google profile (`full_name`/`name`, if any) in bold and the email below it in muted text, each on one line with "…" and a hover title. Without a name the email is the bold line. The avatar markup is shared by the header button and the card.
- **Why:** The user said the menu still didn't look good after the 07:19 email fix (screenshot 07:21).

## 2026-11-18 07:27 IST: Message box gets focus on New chat / opening a chat, and typing anywhere goes into it
- **Files:** `client/src/components/ChatPanel.tsx`
- **What:**
  - "New chat", opening a chat from the list and the first load put the cursor in the message box (skipped on touch screens, where focusing pops up the keyboard).
  - Typing a printable character while focus is on nothing editable (no input, textarea, select or open dialog, no Ctrl/Cmd/Alt) moves focus to the message box, and that first character lands in it, like ChatGPT.
- **Why:** The user asked for the input to be focused when starting a new chat, or when they start typing.

## 2026-11-18 07:33 IST: "Thinking…" stops as soon as a send fails
- **Files:** `client/src/components/ChatPanel.tsx`
- **What:** When sending fails, the "Thinking…" placeholder is removed right away, together with the error toast. Before, it stayed until the follow-up fetch of the chat's messages finished. While the server is down that fetch retries for 3s + 5s.
- **Why:** ⚠ AI mistake (Part 3 send flow). The user's screenshot (07:32) showed the "Couldn't send: Can't reach the server" toast while "Thinking…" was still spinning. The DB showed the server had saved the question and then gone down (dev restart) before it created the answer row.

## 2026-11-18 07:38 IST: save_task keeps the time the user gave (prompt-only, no schema change)
- **Files:** `server/src/services/prompt.ts`, `server/src/services/tools.ts`, `server/src/services/chat.ts`, `server/test/tools.test.ts`, `docs/DESIGN.md`, `docs/plans/part-4-tool-loop.md`
- **What:**
  - The prompt now gives the model the current time as well as the date ("It is now Wednesday, 2026-11-18, 07:38 (Asia/Kolkata)"). `describeToday` is renamed `describeNow`.
  - New rule plus save_task argument descriptions: there's no time field, so a time the user gives ("in 3 min", "after 2 hours", "at 9pm") is turned into a clock time and kept at the end of the title ("Drink water at 07:44"), and due_date is set to the day it falls on. The reply must repeat the saved title and due date.
- **Why:** ⚠ AI mistake (Part 4 prompt/tool design). Another session pointed it out from the user's chat, and a live check against Gemini confirmed it (same 4 inputs plus 3 controls, current prompt):
  - "created a task after 5 min to drink water" saved as "Drink water": the time was **dropped silently**, but the reply still said the task was saved.
  - "… after 2 min", "charge after 10 min", "… in 3 min" kept the time in the title, but as relative words that are meaningless when read later, and with **no due_date**. list_tasks then shows "(created …)" instead of a due date.
  - The model couldn't do better: the prompt only gave today's date, never the current time.
  - The user picked the prompt-only fix over adding a `tasks.due_time` column, to stay inside the brief's "optional due date".
- **Testing (live Gemini, tool calls faked, no DB):** a script in the session scratchpad ran 9 phrasings: relative times, "at 9pm", "tomorrow", no time, "reminder" / "remind me". It ran at the real time and again with the clock set to 23:50 IST. After the fix every time was kept and every timed task got a due_date; "tomorrow" and "buy milk" (no time) were unchanged. Unit tests: 85 pass, including a new midnight case for `describeNow`.
- **Other things the testing found:**
  - The first wording produced "… in 07:42" and "stretch after 2 min at 07:42" (relative words kept next to the clock time). The rule now says to *replace* the time words with "at HH:MM". This final wording was **not** re-run live (see quota below).
  - At 23:50, "charge after 10 min" became "at 00:00" with due_date still 2026-11-18 (should be 11-19). The model does the clock arithmetic, so a time just past midnight can get the wrong date. The rule now spells out "the next day if it passes midnight". Listed as a known limit in DESIGN.md.
  - Gemini's safety filter blocked one request that used a bodily-function example ("Blocked by the safety filter (SAFETY)"), which the user would see as "I can't help with that." That example was also removed from the repo at the user's request (prompt example, and this log's quotes of it).
  - Fallback model `gemini-3.6-flash` hit its free-tier limit of 20 requests a day (429, retry in ~5h48m) and once returned 504 DEADLINE_EXCEEDED. While the primary is unavailable, answers will fail with Retry until the quota resets.

## 2026-11-18 07:46 IST: Tool descriptions cover more ways of asking (reminders, to-do lists, "all my tasks")
- **Files:** `server/src/services/tools.ts`, `server/src/services/prompt.ts`
- **What:**
  - `save_task`: the description names a reminder as a task and lists common phrasings ("remind me to…", "set a reminder", "add … to my to-do list", "don't let me forget…"). It says one call per task, and that no alert is sent at the due time, so the reply mustn't promise one.
  - `list_tasks`: lists common task questions ("what's pending", "what's due today", "did I save…"). The `limit` description says to use 50 when the user asks for all tasks (the default is 10).
  - `send_discord_summary`: says to post right away, only on a clear request, and that it can't schedule a post for later.
  - Ability line: "save tasks and reminders, with an optional due date and time". The prompt's "can't do" example becomes "scheduling a Discord post for later", so a "reminder" isn't mistaken for it. The "remind me" sentence moved from the prompt into the tool description.
- **Why:** The user asked to broaden the tool wording so more phrasings work first time. Seen earlier today: "created a reminder after 5 min to drink water" got "I can't do that" (screenshot 07:32), and "list all my task" was capped at the default 10.
- **Testing (live Gemini, tool calls faked, nothing saved or posted):** 8 phrasings. Reminders after 5 min and on Friday, "don't let me forget X and Y tomorrow" (two save_task calls, one per task), "add stretch to my to-do list", "list all my tasks" (limit 50), "what is due today?" and "post … at 6pm" ("I can't do that.") all behaved as intended.
  - ⚠ AI mistake found by that test: my first Discord wording ("Not for questions about Discord ('can you post?')") made "can you post to discord?" get a free-text "Yes, I can…" instead of the fixed "What should I post…" reply. It competed with the prompt rule that already handles this, so I removed it. Re-run: "can you post to discord?" → the fixed reply, "post … at 6pm" → "I can't do that.", "post hello team to discord" → posted (faked).
  - Unit tests: 85 pass.

## 2026-11-18 08:07 IST: "Load more" pagination for documents, tasks and the tool-call log
- **Files:** `docs/plans/pagination.md`, `server/src/lib/pagination.ts`, `server/src/controllers/document.controller.ts`, `server/src/controllers/task.controller.ts`, `server/src/controllers/toolCall.controller.ts`, `server/test/pagination.test.ts`, `client/src/lib/useList.ts`, `client/src/components/ui/LoadMore.tsx`, `client/src/components/DocumentsPanel.tsx`, `client/src/components/TasksPanel.tsx`, `client/src/components/ToolCallsPanel.tsx`, `client/src/types.ts`, `client/src/index.css`, `docs/DESIGN.md`, `PLAN.md`, `README.md`, `docs/plans/part-5-dashboard.md`
- **What:**
  - The three list endpoints return `{ items, nextCursor, total }` in pages of 25 (`?limit=`, max 100). They use cursor paging on `(created_at, id)`, newest first.
  - The client shows "Showing X of Y" and a "Load more" button.
  - The tool-call "Failed only" filter moves to the server (`?failed=true`).
  - Tasks no longer load without a limit, and the tool-call log's fixed cap of 200 is gone.
- **Why:** The user asked whether the lists needed pagination, then asked for "Load more" on documents and tasks (and the tool-call log), researched and built properly. Cursor paging over OFFSET: rows keep arriving, so offset pages would repeat or skip a row, and it uses the existing `(workspace_id, created_at desc)` indexes. Details in `docs/plans/pagination.md`. This is the Part 8 pagination check, done early.
- **Testing:**
  - Unit: 9 new tests in `server/test/pagination.test.ts` (cursor round-trip; bad limit; foreign or crafted cursors, including attempts to add a `workspace_id` or `id` condition to the filter, are rejected with 400; slicing and `nextCursor`). 94 server tests pass. Client and server type-check.
  - Live, read-only against Supabase: a script called the three real controller functions with `limit=3` and followed `nextCursor` to the end. Documents (5 rows, 2 pages), tasks (6 rows, 2 pages) and tool calls (23 rows, 8 pages) matched one full ordered query exactly, with no duplicates and `total` only on page 1. A bad cursor got 400. `failed=true` couldn't be checked on real rows, because the database has no failed tool calls; it returned an empty first page with total 0.
  - Not done: clicking Load more in the browser.
