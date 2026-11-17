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
