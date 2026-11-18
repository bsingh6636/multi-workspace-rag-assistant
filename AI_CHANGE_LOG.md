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
- **Files:** `server/src/config.ts`, `server/src/services/{gemini,embeddings,chunker,extract,ingest}.ts` (new), `server/src/middleware/{upload,error}.ts`, `server/src/routes/{document,workspace}.routes.ts`, `server/src/controllers/document.controller.ts` (new), `server/test/chunker.test.ts` (new), `server/package.json`, `client/src/types.ts`, `client/src/components/{DocumentsPanel,DeleteDocumentDialog}.tsx` (new), `client/src/components/Dashboard.tsx`
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
- **Files:** `server/src/config.ts`, `server/src/db.ts`, `server/src/types/express.d.ts`, `server/src/services/{retrieve,prompt,llm,citations,chat}.ts` (new), `server/src/middleware/chat.ts` (new), `server/src/routes/{chat,workspace}.routes.ts`, `server/src/controllers/chat.controller.ts` (new), `server/test/citations.test.ts` (new), `client/src/types.ts`, `client/src/components/{ChatPanel,ChatMessage}.tsx` (new), `client/src/components/Dashboard.tsx`
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
- **Files:** `client/src/index.css`, `client/src/components/TasksPanel.tsx` (tick icon 12px → 10px to fit the smaller circle)
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

## 2026-11-18 07:56 IST: Part 5 plan: dashboard tabs for Tasks and the tool-call log
- **Files:** `docs/plans/part-5-dashboard.md`
- **What:** Plan for Part 5. The protected layout, the header switcher, the chat history and the documents panel already exist (Parts 1–3). Part 5 adds two tabs: Tasks (title, due date with "Overdue" / "Due today" labels, when it was saved) and Tool calls (tool, status, latency, time, arguments, error, and the full arguments/result on expand, with a "Failed only" filter). Both read the routes added in Part 4 and remount when the workspace changes. No server or schema change.
- **Why:** PLAN.md Part 5. Before this session, the user also asked me to check the other sessions' changes and the AI models: 85/85 unit tests, typecheck and lint pass, and `gemini-3.5-flash-lite`, `gemini-3.6-flash` and `gemini-embedding-001` each answered a one-line probe (the fallback's daily limit has reset).

## 2026-11-18 08:00 IST: Part 5 code: Tasks and Tool calls tabs
- **Files:** `client/src/types.ts`, `client/src/components/TasksPanel.tsx` (new), `client/src/components/ToolCallsPanel.tsx` (new), `client/src/components/Dashboard.tsx`
- **What:**
  - Two new dashboard tabs next to Chat and Documents, each remounted per workspace (`key={active.id}`) like the existing panels.
  - **Tasks:** title, due date ("Due Fri, 20 Nov 2026") with an "Overdue" or "Due today" label against the browser's local date, and when it was saved. Refresh button, skeleton while loading, empty state with a hint. Read-only (tasks come from `save_task`).
  - **Tool calls:** ✓/✕, tool name, status label for failures, latency, time, the arguments on one line, the error in red, and a native `<details>` with the full arguments and result as JSON. "Failed only" toggle and Refresh. A note when the newest-200 cap is hit.
- **Why:** PLAN.md Part 5 (see `docs/plans/part-5-dashboard.md`). `due_date` is formatted from its Y-M-D parts because `new Date('2026-11-20')` is UTC midnight and shows the previous day west of UTC.

## 2026-11-18 08:03 IST: Part 5 phone-width fixes found in the browser check
- **Files:** `client/src/components/ToolCallsPanel.tsx`, `client/src/index.css`
- **What:** Under 480px the tab icons are hidden, so all four tabs fit without the bar scrolling. A tool-call row's latency and time move from a right-hand column into the row's first line (after the tool name, pushed right, wrapping under it when there's no room), so the arguments line gets the full width.
- **Why:** The 390px screenshots of the first build showed the tab bar scrolled, with "Chat" cut to "hat", and the latency/time column squeezing the arguments to about 20 characters. Found by my own screenshot check before handing over.

## 2026-11-18 08:01 IST: Part 5 done: docs, PLAN.md ticks, results
- **Files:** `PLAN.md`, `README.md`, `docs/plans/part-5-dashboard.md`
- **What:** Ticked Part 5's three boxes. README: the dashboard line names the four tabs and what each shows. The repository layout lists the panels, `lib/useList.ts` and `ui/RowsSkeleton`. The plan's Results section records the checks (29/29 browser and API checks, screenshots, the one failed check that was a bug in my test).
- **Why:** End of Part 5 (CLAUDE.md session workflow). No design decision changed, so DESIGN.md is unchanged.

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

## 2026-11-18 08:08 IST: Part 6 plan: seed data and hardening checks
- **Files:** `docs/plans/part-6-hardening.md`
- **What:** Plan for Part 6. Adds a `/seed` folder (two Falcon docs for workspace A, two unrelated docs plus a prompt-injection doc for B) and an idempotent `npm run seed` script that creates the demo account from `SEED_EMAIL`/`SEED_PASSWORD` and ingests the docs with the real pipeline. Then runs the checks PLAN.md lists: injection, invalid Gemini key, re-upload, secrets in the client bundle, and secrets in server logs.
- **Why:** PLAN.md Part 6. Another agent is adding pagination at the same time, so this part doesn't touch the list controllers, `lib/pagination.ts`, `useList` or the panels.

## 2026-11-18 08:09 IST: Seed documents and the seed script
- **Files:** `seed/*` (new), `server/src/scripts/seed.ts` (new), `server/package.json` (`seed` script), `.env.example`
- **What:** Five invented seed docs (see the Part 6 plan, section A). `npm run seed` creates or updates the demo user from `SEED_EMAIL`/`SEED_PASSWORD`, creates "A – Falcon" and "B – Other", ingests the docs through `ingestDocument()` (re-runs skip them by content hash) and opens the demo on A. `.env.example` lists the two optional variables.
- **Why:** PLAN.md Part 6, first item. The credentials come from the environment so no password is committed.

## 2026-11-18 08:15 IST: ⚠ AI mistake: a Supabase Auth hiccup signed users out (401 instead of 503)
- **Files:** `server/src/middleware/auth.ts`, `server/test/auth.test.ts` (new)
- **What:** `requireAuth` now tells the two kinds of `getUser` failure apart. When Supabase Auth can't be reached or answers 5xx (`isAuthRetryableFetchError`, or a status of 500 and above), the response is **503** "Can't check your session right now. Please try again.", with one log line (no token). Only a token Auth actually rejects gets 401. The decision is a small exported function, `authFailureStatus`, with unit tests.
- **Why:** ⚠ AI mistake (Part 1 auth middleware: every error became 401). Found in the Part 6 hardening run. One request to a test server took 11 s and came back 401 "Invalid or expired session" for a token that worked a second earlier and right after. The client's `http.ts` signs the user out on any 401, so a short Auth outage or network blip would log everyone out. A 503 is already retried for GETs and shown as "Can't reach the server" by the client.

## 2026-11-18 08:25 IST: Safety filter: harassment blocked at MEDIUM, not LOW (false positives on injected documents)
- **Files:** `server/src/services/llm.ts`, `docs/DESIGN.md`
- **What:** Harassment now blocks at MEDIUM and above. Hate and sexually explicit content stay at LOW, and dangerous content stays at MEDIUM.
- **Why:** Found by the Part 6 injection check. In workspace B, every question whose retrieval included `seed/injection.txt` usually came back "I can't help with that." That covers "What do the vendor notes say?" and the demo's "What is the Project Falcon code?" (the injection chunk mentions the code, so it passes the threshold). The doc's imperative text is rated HARASSMENT:LOW.
- **Evidence (live Gemini, same prompt as the app):**
  - With harassment at LOW, 5 of 6 replies to the two B questions were blocked. At MEDIUM, 0 of 6.
  - Unblocked, the model answered the vendor facts with a citation and ignored the injected instructions. In B it said "I don't know" for the Falcon code.
  - The 10 texts posted to Discord in the user's 06:48–06:56 test (read from `tool_calls`, never printed) gave identical outcomes at LOW and MEDIUM for harassment. The one that was blocked is still blocked, through sexual content at LOW. So the change loses nothing on the cases the 07:03 LOW setting was added for.

## 2026-11-18 08:27 IST: Tasks can be marked done (Tasks tab + complete_task tool) and deleted (Tasks tab only)
- **Files:** `docs/plans/task-actions.md`, `sql/schema.sql` (+ Supabase migration `tasks_done_at`), `server/src/controllers/task.controller.ts`, `server/src/routes/task.routes.ts`, `server/src/services/tools.ts`, `server/src/services/prompt.ts`, `server/test/tools.test.ts`, `client/src/types.ts`, `client/src/components/TasksPanel.tsx`, `client/src/components/DeleteTaskDialog.tsx`, `client/src/components/ChatMessage.tsx`, `client/src/index.css`, `docs/DESIGN.md`
- **What:**
  - New column `tasks.done_at`. `PATCH …/tasks/:taskId {done}` and `DELETE …/tasks/:taskId`, both scoped by the URL's workspace. `GET …/tasks?done=false|true`.
  - Tasks tab: a done checkbox, a delete button with a confirm dialog, and "Show done".
  - New tool `complete_task({ task_id })`. `list_tasks` returns ids and hides done tasks unless `include_done`.
  - Chat shows "Marked a task done", and "Listed tasks" gets a hover hint pointing to the Tasks tab.
- **Why:** The user asked for done/update/delete and agreed to: done in the tab and in chat, delete in the tab only. Delete isn't a tool because it can't be undone and retrieved text is untrusted (prompt injection). Rename isn't built. The client request timeout I proposed is deferred: without a server-side deadline for the whole answer it would leave a pending answer the client never re-checks (details in the plan).
- **Testing:**
  - Unit: the registry test now expects four tools ("no delete tool, on purpose"). New tests: complete_task rejects a non-uuid or an extra `workspace_id`, and a `delete_task` call is `unknown_tool`. 98 server tests pass. Client and server type-check.
  - Database (one temporary task, deleted afterwards; 15 checks): PATCH done/undone, `?done=false|true`, PATCH and DELETE through another workspace's URL → 404, malformed id → 404, bad body → 400, complete_task → done then `already_done` on repeat, from another workspace → "not found", list_tasks hides done tasks unless `include_done`, DELETE → 204 then 404.
  - Live Gemini, tools faked: "I called the vendor, mark it done" → list_tasks then complete_task with the right id; "list all my tasks" → no ids in the reply; "delete all my tasks" → "I can't do that." plus the abilities (now including "mark tasks as done"); "mark the dentist task done" (no such task) → says it couldn't find one, no guess.
  - Not done: clicking the checkbox and delete in the browser.
- **Found while building:** "list all tasks" got "I can't help with that." three times (08:25–08:26). Not caused by this change, which wasn't live yet. Gemini's sexual-content filter (LOW threshold) blocked the reply that repeated the user's old test task titles (a bodily-function word). The Part 6 session keeps that threshold and confirmed deleting those tasks is the fix, which the new Tasks-tab delete now allows.

## 2026-11-18 08:26 IST: The safety-block log line names the flagged categories
- **Files:** `server/src/services/llm.ts`, `server/src/services/chat.ts`
- **What:** `SafetyBlockedError` also carries the non-negligible safety ratings (e.g. `HARASSMENT:MEDIUM`), and the "blocked by the safety filter" log line prints them. `blockReasonOf` is unchanged.
- **Why:** The Part 6 run had a block whose log only said "SAFETY", so there was no way to tell which category fired without re-running the prompt by hand. Only category names and levels are logged, never message text.

## 2026-11-18 08:28 IST: Part 6 done: README demo account and walkthrough, PLAN.md ticks, results
- **Files:** `README.md`, `PLAN.md`, `docs/plans/part-6-hardening.md`
- **What:**
  - README:
    - New "Seed the demo account" setup step.
    - The test table lists the real seed files.
    - Walkthrough step 2 says to use a new chat, and step 6 asks "What do the vendor notes say?" (the question the run checked).
    - Two new defenses: the safety filter, and 503 rather than sign-out when Supabase Auth is unreachable.
  - PLAN.md: Part 6 boxes ticked.
  - Plan file: results recorded.
- **Why:** End of Part 6.

## 2026-11-18 08:46 IST: Removed the test data that tripped the safety filter; a blocked reply after a tool ran now says what was done
- **Files:** Supabase data only (see below); `server/src/services/prompt.ts`, `server/src/services/chat.ts`, `server/src/services/citations.ts`, `server/test/tools.test.ts`, `server/test/citations.test.ts`, `docs/DESIGN.md`
- **What:**
  - **Data (at the user's request):** deleted the 3 tasks, the 2 chats, 5 question/answer pairs in another chat, and the tool-call log rows containing the bodily-function word from the user's early testing. Checked afterwards: none left.
  - **Code:** when Gemini's safety filter blocks the reply *after* a tool succeeded, the answer is no longer a bare "I can't help with that.". It says what was done ("Your tasks were loaded, but the content filter blocked my reply…") and where to see the result. With no successful tool, it's unchanged. Both forms are still dropped from later history.
- **Why:** "list all tasks" got "I can't help with that." three times (08:25–08:26): list_tasks worked, but the sexual-content filter (kept at LOW by the Part 6 session) blocked the reply that repeated those task titles. The user asked to remove the data and fix the "blockage". The bare message made a working feature look broken.
- **Also:** "what do you have" (and the cut-off "what do u ha" the user sent) is now small talk, so the assistant's answer about what it can do isn't replaced by "I don't know" (CLAUDE.md rule 5). "what do you have on Falcon?" is still a document question.
- **Testing:** 7 new unit tests: `blockedReply` with no tool, an unknown tool, a repeated tool and two tools; the longer blocked reply is dropped from history like the short one; 3 new small-talk phrasings and 2 that must stay document questions. 105 server tests pass. The filter's block can't be reproduced on demand (it isn't consistent), so the new wording wasn't seen live.

## 2026-11-18 08:50 IST: Tasks tab: round "complete" button in place of the square checkbox, aligned with the title
- **Files:** `client/src/components/TasksPanel.tsx`, `client/src/index.css`, `docs/plans/task-actions.md`
- **What:** The done control is now a round button (`role="checkbox"`), like Todoist or Microsoft To Do. A faint tick shows on hover; when done it's a filled green circle with a white tick. Its tooltip reads "Mark as done" or "Mark as not done". It lines up with the title line, not the middle of the row.
- **Why:** The user found the square checkbox confusing (it reads as "select row") and saw it was misaligned (screenshot 08:48). It was centered between the title and the meta line. Select-then-"Mark done" was considered and rejected: it turns the usual one-task case into two clicks, and the chat already handles bulk.

## 2026-11-18 08:54 IST: "mark as done" asked "Which task?" without showing the tasks it had just listed
- **Files:** `server/src/services/tools.ts`, `docs/plans/task-actions.md`
- **Event (user's live test, 08:51):** "reminder to pee after 5 min" was saved. "delete this reminder" got "I can't do that." plus the abilities, which is correct: deleting is only in the Tasks tab. Then "mark as done" ran `list_tasks` (4 open tasks, in the tool-call log at 08:51:47) and replied only "Which task would you like to mark as done?". The user saw the "Listed tasks" chip but no list, and asked why it listed tasks and then didn't show them.
- **Cause:** `complete_task`'s description said "if several match or none does, ask the user". It didn't say to show the choices. Replayed against Gemini with the same prompt and tools: a bare "mark as done" listed the titles 1 time in 3. The other 2 times it asked "which task?" with nothing to pick from, once telling the user to "use the list tasks tool".
- **What:** the description now says: when the user doesn't say which task and the recent messages don't make it clear (it/this right after one task was discussed), call `list_tasks` and ask which one, listing the open titles (never ids). Never tell the user to call a tool.
- **Testing:** replayed against Gemini (tool results faked from the real 08:51 list), 3 runs per case, 15 runs in all.
  - The user's exact history + "mark as done": 3/3 call `list_tasks` and ask which one, listing all 4 titles.
  - A bare "mark as done": 3/3 list the titles (1/3 before the fix).
  - Right after the reminder was discussed, without the earlier "list all tasks" turn: 3/3 mark that reminder done.
  - "drink water is done": 3/3 mark the right task.
  - No ids in any reply. 105 unit tests pass.

## 2026-11-18 09:01 IST: Tasks tab: the round done button sat 2–3px above the title text ⚠ AI mistake
- **Files:** `client/src/index.css`, `client/src/components/TasksPanel.tsx` (tick icon 12px → 10px to fit the smaller circle)
- **What:** The circle is now 16px (it was 18px), the same size as GitHub's row checkbox. It's centred on the title's letters, not on the top of its 21px line.
- **Why:** The 08:50 change set the circle's position by eye, and that was wrong. The user noticed it in a screenshot (08:59) and compared it with GitHub's pull-request list (09:00). Measured in pixels: the 18px circle ran from y 283 to 300, but the title's centre is around y 294, so the circle stuck out above the text. GitHub's 16px box is centred on its title's capitals.

## 2026-11-18 09:08 IST: GitHub-style counters on the Documents, Tasks and Tool calls tabs
- **Files:** `docs/plans/tab-counts.md` (new), `server/src/controllers/workspace.controller.ts`, `server/src/routes/workspace.routes.ts`, `client/src/types.ts`, `client/src/components/Dashboard.tsx`, `client/src/components/ChatPanel.tsx`, `client/src/components/DocumentsPanel.tsx`, `client/src/components/TasksPanel.tsx`, `client/src/components/ToolCallsPanel.tsx`, `client/src/index.css`, `docs/DESIGN.md`
- **What:**
  - New `GET /api/workspaces/:wsId/counts` returns `{ documents, openTasks, toolCalls }`: three head-only count queries, scoped by the URL's workspace.
  - The tabs show them in a Primer counter. A 0 is hidden and 1000+ shows as "1k". Chat has no counter.
  - The Dashboard refetches the counts when the workspace or tab changes, and when a panel reports a change (send/Retry, upload/delete, done/delete/Refresh).
- **Why:** The user asked for tab counts "same as" GitHub's repo tabs (e.g. "Pull requests 3").

## 2026-11-18 09:08 IST: "list all tasks" sometimes left out done tasks; a misspelled "create task for …" was saved as the title
- **Files:** `server/src/services/tools.ts`, `docs/plans/task-actions.md`
- **Event (user's live test, 09:04–09:06, read from `messages` and `tool_calls`):**
  - "list all tasks" / "list all task" ran `list_tasks` with `include_done: true` twice (09:04:55, 09:05:14: 6 and 7 tasks, open and done). The same words ran without it twice (08:50:44, 09:06:04: open tasks only). The same question got different lists.
  - "cerarte task for waking up" saved the title "cerarte task for waking up". "create new task to cook food" saved "cook food" correctly; the misspelled "create" wasn't recognised as request words.
- **Cause:**
  - `include_done` said "only when the user asks about done or completed tasks", and `limit` said "use 50 when the user asks for all tasks". So "all" was tied to the page size, and whether done tasks were included was a guess.
  - The title description didn't say to drop the request words.
- **What:**
  - `include_done` is now true when the user asks for *all* tasks ("all tasks", "all my tasks", "every task") or about done ones. That matches the Tasks tab, where "All tasks" means including done. "My tasks" / "what's pending" stay open only.
  - The title description says to keep only the task itself and drop request words such as "create/add a task", "new task to", "remind me to", even when misspelled.
- **Testing:** replayed against Gemini with tool results faked (2 open tasks, 1 done).
  - **Before:** "list all tasks", "list all task" and "list all my task" included done tasks 0 times in 6 runs. "cerarte task for waking up" kept the request words in the title 1 time in 2.
  - **After:** the three "all" phrasings sent `include_done: true` 9/9, and each reply marked tasks open/pending or done. "list my tasks" and "what is pending" stayed open only, 6/6.
  - **Not tested yet:** the title fix ("cerarte task for waking up", "create new task to cook food", "remind me to call mom tomorrow"). The run hit the daily free-tier quota for `gemini-3.5-flash-lite` (500 requests a day; resets in about 4h17m). Retest it after the reset.
  - Server type check passes; 105 unit tests pass.

## 2026-11-18 09:18 IST: Info icon on "Listed tasks" shows gray, not green
- **Files:** client/src/index.css
- **What:** `.msg-tool svg` → `.msg-tool > svg`, so only the ✓/✕ status icon gets the success/danger colour and the 4px right margin.
- **Why:** ⚠ AI mistake. Noticed in the user's screenshot: the ⓘ hint was green like the ✓. `.msg-tool svg` (0,1,1) also matched the SVG inside `.msg-tool-info` and beat that span's `color: var(--fg-muted)`, so a hint looked like a second success mark.

## 2026-11-18 09:24 IST: Part 7 plan: retrieval debug panel and per-answer tokens/latency; streaming skipped
- **Files:** `docs/plans/part-7-stretch.md`
- **What:** Plan for Part 7.
  - A "Details" button next to Copy under each answer opens a panel: workspace id, threshold, top-k, each retrieved chunk (file, section, similarity, kept or below threshold, the label it got, whether the answer cited it), tokens in/out and latency.
  - `retrieve.ts` also records each chunk's file name, section and label (old messages still render).
  - Streaming is not built (reason in the plan).
- **Why:** PLAN.md Part 7. Before starting, I checked the combined tree after the other sessions' work: 105/105 server tests, typechecks and the client build pass. Client lint has 2 warnings, in files another session is editing (`useList.ts`, `Dashboard.tsx`); I asked that session about them.

## 2026-11-18 09:24 IST: Part 7 server: the retrieval record names each chunk's file, section and label
- **Files:** `server/src/services/retrieve.ts`, `server/test/retrieve.test.ts` (new)
- **What:** The kept/threshold mapping moves into a pure, exported `splitByThreshold(workspaceId, rows, threshold, k)` with unit tests. `retrieve()` calls it and still does the scoped vector query itself. Each `retrieval.retrieved` entry now also has `filename`, `section` and `label` (`c1`… for kept chunks, null below the threshold). Chunk text is not added.
- **Why:** Part 7 debug panel: bare chunk UUIDs don't tell a reader which document matched.

## 2026-11-18 09:25 IST: Part 7 client: "Details" panel under each answer (retrieval, tokens, latency)
- **Files:** `client/src/types.ts`, `client/src/components/ChatMessage.tsx`, `client/src/index.css` (appended)
- **What:**
  - `Message` gets `retrieval`, `tokens_in`, `tokens_out` and `latency_ms`.
  - A finished answer is rendered by a new `Answer` component. It holds the open/closed state of a "Details" toggle (pulse icon, next to Copy).
  - The panel shows:
    - the workspace id, threshold, top-k, how many chunks were kept and whether the answer cited any
    - one row per retrieved chunk in rank order: label, file › section, similarity and status (cited / in prompt / below threshold), chunk id on hover
    - tokens in/out and latency
  - Old messages without the Part 7 fields show "—" for the file. Messages with no retrieval record show only the cost line.
- **Why:** PLAN.md Part 7 (retrieval debug panel, and tokens and latency per message).

## 2026-11-18 09:26 IST: Plan for workspace and tab URLs
- **Files:** docs/plans/url-routing.md (new)
- **What:** Plan only, no code yet. URLs like `/w/<wsId>/documents`; the URL wins over `last_workspace_id`, and a bare `/` opens the last workspace as now.
- **Why:** User asked for reload-safe workspace and tab URLs and asked for the idea to be written down.

## 2026-11-18 09:31 IST: Workspace and tab URLs
- **Files:** client/src/lib/route.ts (new), client/src/components/Dashboard.tsx, client/src/components/UserMenu.tsx, docs/plans/url-routing.md, docs/DESIGN.md
- **What:**
  - URLs `/w/<wsId>` (Chat) and `/w/<wsId>/documents|tasks|tool-calls`. A workspace id in the URL wins over `last_workspace_id`. `/` opens the last workspace and becomes `/w/<id>`.
  - An id that isn't in the user's list shows "Workspace not found" and opens the last workspace instead.
  - Clicking a workspace or tab pushes a history entry (Back/Forward work). Redirects, fixes and the jump after deleting a workspace replace the current entry.
  - Opening a workspace from the URL or with Back also saves it as `last_workspace_id`.
  - Sign out from the user menu resets the URL to `/`, so the next user doesn't land on a "not found" link. A sign-out caused by an expired session keeps the URL, so logging in again returns to the same place.
- **Why:** User asked for reload-safe, linkable workspace and tab URLs. Before, a reload always opened Chat and Back did nothing. No router library: three small helpers are enough and easy to explain.

## 2026-11-18 09:30 IST: Part 7 done: docs, PLAN.md ticks, results; streaming not built
- **Files:** `README.md`, `docs/DESIGN.md`, `PLAN.md`, `docs/plans/part-7-stretch.md`
- **What:**
  - README: the feature line describes the Details panel. Walkthrough step 2 says how to open it. "Out of scope" says why streaming wasn't built.
  - DESIGN §4: the debug panel and the streaming trade-off.
  - PLAN.md: the debug panel and observability boxes are ticked. Streaming is marked "not built (decision)".
  - Plan file: results recorded.
- **Why:** End of Part 7. Both Gemini chat models hit their free-tier daily limits during this part (flash-lite 500/day, flash 20/day; resets in about 4.5 h). The browser check therefore used real retrieval records (embeddings have a separate quota) on stored answers, not live answers.

## 2026-11-18 09:35 IST: Second Gemini key (GEMINI_API_KEY_FALLBACK) used when the first key's quota runs out
- **Files:** `server/src/config.ts`, `server/src/services/gemini.ts`, `server/src/services/llm.ts`, `server/src/services/embeddings.ts`, `server/src/services/toolLoop.ts`, `server/test/gemini.test.ts` (new), `.env.example`, `docs/DESIGN.md`, `README.md`, `CLAUDE.md`
- **What:**
  - New optional `GEMINI_API_KEY_FALLBACK` (an API key from another Google account).
  - **Chat order:** main model on the primary key (with retries), the same model on the fallback key, then the fallback model on each key.
  - **Embeddings:** the primary key, then the fallback key.
  - **Cooldown:** a 429 that says to retry in 60 s or more (the free-tier *daily* limit) isn't retried. That key and model are skipped until the reset time Gemini gave, so later requests don't spend 7 s of retries on a key that's out for hours.
  - **Pinning:** a tool-loop turn pins the key as well as the model.
  - A quota error on every key now says "free quota is used up for now" instead of "try again in a minute".
  - Logs name the key ("primary key" / "fallback key"), never its value.
- **Why:** The user added the second key after both chat models hit their daily free-tier limit (flash-lite 500/day, flash 20/day) during Part 7 testing. Until the reset, every chat answer failed. A one-line check showed the new key works with both chat models and the embedding model.

## 2026-11-18 09:50 IST: Part 8 plan, Dockerfile and .dockerignore
- **Files:** `docs/plans/part-8-deploy.md` (new), `Dockerfile` (new), `.dockerignore` (new), `PLAN.md`
- **What:**
  - **Plan:** build the image on the laptop and copy it to the user's server (`docker save | ssh … docker load`), then `docker run --env-file` there.
  - **Dockerfile:** multi-stage. The build stage compiles the client (the public `VITE_*` values are build args) and the server. The runtime stage has production deps, the two `dist` folders and `/seed` (for the seed script), and a `/health` HEALTHCHECK.
  - **`.dockerignore`:** keeps `.env` files, `node_modules`, `dist`, `_private/` and `.git` out of the build context.
  - **PLAN.md:** ticked the Part 1 boxes and Part 2's client box. They were built and committed in `3b9c2f5` and `49fd5a2`, but never ticked.
- **Why:** The user asked to build the image locally "with envs and all" and move it to their server, which already runs Docker. The secrets go in a `.env` file on the server rather than inside the image. Anyone holding an image can read baked-in values with `docker inspect` or `docker history`, and the README and PLAN already promise "never baked into the image".

## 2026-11-18 10:02 IST: Hosting moves from AWS to the user's Azure VM, behind Caddy for HTTPS
- **Files:** `deploy/compose.yml` (new), `deploy/README.md` (new), `docs/plans/part-8-deploy.md`, `README.md`, `CLAUDE.md`, `PLAN.md`
- **What:**
  - **Target:** the user's Azure VM (Oracle Linux 8, x86_64), which already runs Docker and Compose. Ports 80 and 443 are free there.
  - **Compose:** `deploy/compose.yml` runs the app image plus Caddy. Caddy gets a Let's Encrypt certificate for the subdomain and forwards HTTPS to the app on 3000. Only Caddy publishes ports; the app isn't reachable directly.
  - **Secrets:** the app's secrets live in `app.env` on the VM, never in the image.
  - **Docs:** `deploy/README.md` lists the steps one by one, with a short reason for each, because the user wants to learn them. The docs that said "AWS" now say the Azure VM.
- **Why:** The user chose to deploy to a VM they already have, at a subdomain of their own domain, so the recruiter gets a fixed HTTPS link. Caddy was picked over a tunnel: the link stays the same across restarts, HTTPS renews itself, and there's no extra account.

## 2026-11-18 10:02 IST: App favicon instead of Vite's default
- **Files:** client/public/favicon.svg
- **What:** Replaced the Vite logo (purple lightning bolt) with the app's own icon: a document with a chat bubble, on a rounded square in the Primer accent blue (#0969da).
- **Why:** The browser tab still showed the Vite scaffold logo. The new icon matches the product (chat over your documents) and the app's colours.

## 2026-11-18 10:12 IST: Share the local dev app at local.brijeshhq.com through a Cloudflare Tunnel
- **Files:** `client/vite.config.ts`
- **What:**
  - Added `server.allowedHosts: ['local.brijeshhq.com']`. Vite's dev server rejects requests whose Host header it doesn't know.
  - **Outside the repo:** a named Cloudflare Tunnel `workspace-assistant`, set up by `cloudflared` in `~/.cloudflared/` (credentials, `workspace-assistant.yml`, log). It sends `local.brijeshhq.com` to `http://localhost:5173`, and Vite's proxy forwards `/api` to the dev server on :3000.
  - Not marked as the live deployment in PLAN or README.
- **Why:** The user wants a quick shareable URL that runs from the laptop, with no Docker for now. The VM, Caddy and Docker files stay in the repo for a real deployment later.

## 2026-11-18 14:49 IST: Simpler, clearer favicon
- **Files:** client/public/favicon.svg
- **What:** Redrew the icon as two stacked white pages (your documents, across workspaces) with a yellow AI sparkle, on a blue gradient rounded square. Thicker shapes, fewer details: the old green chat bubble, folded corner and three dots are gone.
- **Why:** The user asked for a better favicon. At 16px (tab size) the previous document-plus-bubble icon blurred into a smudge. Checked the new one side by side at 16/32/64px on light and dark backgrounds before switching.

## 2026-11-18 15:07 IST: Reliable sign-out and leaner auth state
- **Files:** `client/src/App.tsx`, `client/src/components/UserMenu.tsx`, `client/src/lib/http.ts`, `client/src/lib/auth.ts` (new), `client/src/components/Dashboard.tsx`
- **What:**
  - **⚠ AI mistake:** Sign out called `supabase.auth.signOut()` with the default `global` scope and ignored the result. If the revoke request fails (offline, 5xx), supabase-js keeps the session, so the user stayed signed in while the URL had already jumped to `/`. Found while reviewing the logout flow against auth-js 2.119's `_signOut`. Now one shared `signOut()` in `lib/auth.ts` uses `scope: 'local'`: the session is removed on this device first and the server revoke is best effort. Concurrent callers share one promise.
  - The 401 handler in `http.ts` uses the same `signOut()`, so several failed requests sign out once, and shows a single "session expired" toast (fixed toast id).
  - `App.tsx` listens to `onAuthStateChange` only (its `INITIAL_SESSION` event replaces the extra `getSession()` call). It stores the user, not the session, and skips token refreshes, so the dashboard no longer re-renders every hour. On `SIGNED_OUT` it dismisses all toasts left over from the old session. While the session loads it shows a spinner instead of a blank page.
  - `Dashboard.tsx`: the first-load effect ignores results after it is cleaned up (StrictMode's double run in dev, or sign-out mid-load).
- **Why:** The user asked to check the logout logic and improve its state, loading and calls.

## 2026-11-18 15:08 IST: Create-workspace button disabled with the suggested name
- **Files:** `client/src/components/WorkspaceNameDialog.tsx`, `client/src/components/Dashboard.tsx`
- **What:** **⚠ AI mistake** (the user saw it in the create dialog: "Default_2" was filled in but "Create workspace" stayed disabled). The dialog's "unchanged" rule (renaming to the same name is a no-op) compared against `initialName`, which for Create is only a suggestion, so submitting the suggestion was blocked. The rule now uses a separate `currentName` prop that only Rename passes. Create still pre-fills `initialName`.
- **Why:** Accepting the suggested name is the normal way to create a workspace.

## 2026-11-18 15:25 IST: Fixes from the full code review (Discord guard, stuck rows, chat race)
- **Files:** `server/src/services/tools.ts`, `server/src/services/chat.ts`, `server/src/services/toolLoop.ts`, `server/src/services/recovery.ts`, `server/src/services/ingest.ts`, `server/src/controllers/chat.controller.ts`, `server/src/controllers/document.controller.ts`, `server/test/tools.test.ts`, `client/src/components/ChatPanel.tsx`, `docs/DESIGN.md`, `PLAN.md`
- **What:**
  - **⚠ AI mistake (found in a whole-repo review the user asked for):** `send_discord_summary` only checked where the text came from. A summary with any valid `[cN]` label was posted, even if the user never asked to post. So an injected document in the same workspace as real data could get the model to post that data. Now the tool also checks in code that the user asked: their latest message must mention Discord or a posting verb (post, send, share, publish, forward), or the previous answer must be the fixed "What should I post to Discord?" question.
  - **⚠ AI mistake (same review):** the Retry guard for Discord returned `already_sent` whenever this message had any successful post. A second, different post in the same turn was skipped but reported to the model as sent. Now the first Discord call of an attempt counts the posts earlier attempts made, and only that many calls in this attempt are skipped.
  - Answers and uploads that stopped half-way while the server kept running (e.g. the final DB write failed) stayed `pending`/`processing` until a restart: endless "Thinking…" with no Retry, and the file blocked as a "duplicate". The server now keeps an in-memory set of the answers and uploads it's working on. Listing messages or documents marks rows that are `pending`/`processing` but not in that set as `failed`. Re-uploading such a file processes it again.
  - Chat panel: opening chat A and then chat B quickly could show A's messages under B's title. A response for a chat that's no longer open is now dropped.
  - Tool calls in the forced last reply (tools set to `NONE`) were dropped without a log row. They're now logged as `error` (not run), following hard rule 4.
  - PLAN.md Part 0 still named the old chat and fallback models (they were swapped after Part 3).
- **Why:** The user asked for the review's fixes. Points 5 (tool turns skip the citation guard) and 6 (an empty chat left by a failed first send) were left as known limits.

## 2026-11-18 15:49 IST: Styled tooltip on the "Listed tasks" info icon
- **Files:** `client/src/components/ChatMessage.tsx`, `client/src/index.css`
- **What:** The ⓘ after "Listed tasks" used the browser's native `title` tooltip: a small white box that is slow to appear, looks out of place in dark mode and never shows for keyboard users. It's now a Primer-style CSS tooltip (dark bubble with an arrow, from `aria-label`), shown on hover and on keyboard focus (the icon is focusable). The text was also out of date: the assistant can mark tasks done now (`complete_task`), so it no longer says to use the Tasks tab for that. It explains that the list is the assistant's text, and the Tasks tab is where tasks can be ticked off or deleted.
- **Why:** The user found the hover hard to read (screenshot of the chat).

## 2026-11-18 16:36 IST: Slack posts, and deleting a workspace from chat (with confirmation)
- **Files:** `server/src/config.ts`, `.env.example`, `server/src/services/tools.ts`, `server/src/services/toolLoop.ts`, `server/src/services/chat.ts`, `server/src/services/prompt.ts`, `server/src/controllers/chat.controller.ts`, `server/test/tools.test.ts`, `client/src/types.ts`, `client/src/components/ChatPanel.tsx`, `client/src/components/Dashboard.tsx`, `docs/DESIGN.md`, `docs/plans/slack-and-delete.md`, `PLAN.md`, `README.md`
- **What:**
  - `send_slack_summary` (Slack Incoming Webhook, `SLACK_WEBHOOK_URL`). It's built by the same helper as the Discord tool, so it has the same checks: the user asked, the text has a source, and Retry doesn't post twice. Slack's `<`, `>` and `&` are escaped, so `<!channel>` can't ping. "What should I post?" no longer names Discord.
  - `delete_workspace`: when the user asks in chat to delete everything, the server replies with a fixed "Are you sure?" question. Only a reply that is an explicit yes, to a question the tool really asked (checked in `tool_calls`), deletes the workspace and everything in it. The client then switches to another workspace, or to a new "Default" if it was the only one. Plan: `docs/plans/slack-and-delete.md`.
- **Why:** The user asked for Slack (the brief allows Slack or Discord) and for "delete everything" from chat, behind an "are you sure?" step. They chose the chat-only confirmation over a confirm button. It replaces the old "no delete tool" decision (DESIGN §5). It's named `delete_workspace`, not `delete_everything`, so the brief's injection test still logs `unknown_tool`. Both steps are code checks, so a document can't trigger it.

## 2026-11-18 16:48 IST: Say which workspace you were switched to after a delete
- **Files:** `client/src/components/Dashboard.tsx`
- **What:** After a workspace is deleted (from chat or from the workspace menu), the toast now also says where you landed: "Deleted workspace “X”" with "Switched to “Y”" under it, or "Created and switched to “Y”" when a new one was made.
- **Why:** The user asked to be told which workspace they were switched to after a delete.

## 2026-11-18 23:07 IST: Deployment subdomain renamed to workspace-ai.brijeshhq.com
- **Files:** `deploy/README.md`, `README.md`
- **What:** Replaced the `assistant` subdomain with `workspace-ai` in the deploy guide: the DNS record, the `dig` check, `APP_DOMAIN`, the health-check `curl` and the Supabase Site URL. Filled the main README's `<LIVE_URL>` placeholder with `https://workspace-ai.brijeshhq.com`.
- **Why:** The user didn't like `assistant.brijeshhq.com` (long, easy to misspell) and chose `workspace-ai`.

## 2026-11-18 23:10 IST: Hosting moves from the Azure VM to Render (free plan)
- **Files:** `render.yaml` (new), `deploy/README.md`, `deploy/compose.yml` (deleted), `Dockerfile` (comment only), `README.md`, `PLAN.md`, `CLAUDE.md`
- **What:** The same Docker image now runs as a Render web service on the free plan. `render.yaml` describes it: Docker runtime, `/health` check, and env variable names, with secrets set in the dashboard and not in git. Render builds from the GitHub repo on every push to `main`, and its env variables reach the Dockerfile as build args, so `VITE_*` work as before. Render handles HTTPS and the custom domain (`workspace-ai.brijeshhq.com`, a Cloudflare CNAME), so Caddy and `deploy/compose.yml` are gone. `deploy/README.md` is rewritten for Render: setup, the free plan's sleep after 15 minutes idle (a keep-alive ping on `/health`), and running the seed from the laptop, because the free plan has no shell.
- **Why:** The user wants to keep the project online for a long time without paying for VM resources, and picked Render's free plan over the paid Starter plan after hearing about the cold start.

## 2026-11-19 00:45 IST: Render service name matches the dashboard
- **Files:** `render.yaml`, `deploy/README.md`
- **What:** The Render service is named `multi-workspace-rag-assistant` (the name the dashboard filled in from the repo), so its URL is `multi-workspace-rag-assistant.onrender.com`. The docs and the CNAME target use that name now. `deploy/README.md` also covers the manual "New Web Service" flow the user followed: add the env variables with "Add from .env", and set the health check path under Advanced.
- **Why:** The user's screenshot of the Render setup page showed this name, not the `workspace-assistant` the docs used.
