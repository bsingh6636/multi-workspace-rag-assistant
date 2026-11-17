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
