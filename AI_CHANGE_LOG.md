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
