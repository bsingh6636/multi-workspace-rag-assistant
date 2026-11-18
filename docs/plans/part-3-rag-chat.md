# Part 3 plan: Scoped RAG chat

Goal: chat in the active workspace. Each answer comes only from that workspace's chunks, cites them, and says "I don't know" otherwise. The user's question is never lost, and a failed answer can be retried.

Checklist lives in `PLAN.md`. Spec: `docs/DESIGN.md` §4 and §6. Tools come in Part 4; this part leaves a clear slot for them.

---

## A. Server

### Files
| File | Purpose |
|---|---|
| `src/config.ts` | Adds `GEMINI_CHAT_MODEL` (default `gemini-3.6-flash`), `GEMINI_CHAT_FALLBACK_MODEL` (default `gemini-3.5-flash-lite`) and `SIMILARITY_THRESHOLD` (number between 0 and 1). |
| `src/services/retrieve.ts` | `retrieve(workspaceId, question)`: embeds the question (`RETRIEVAL_QUERY`, normalized), calls `rpc('match_chunks', { ws_id, query_embedding, k: 5 })`, then keeps chunks with `similarity ≥ SIMILARITY_THRESHOLD`. Returns the kept chunks with labels `c1…cN`, plus a `retrieval` record for the debug view: `{ workspace_id, threshold, k, retrieved: [{ chunk_id, similarity, kept }], kept, hit }`. Zero kept chunks is a normal result. |
| `src/services/prompt.ts` | `buildSystemPrompt(today)` and `buildContents(history, chunks, question)`. Details below. |
| `src/services/llm.ts` | `generate({ systemInstruction, contents })`: calls the primary model through `withRetry` (1s, 2s, 4s). If it still fails with a retryable error (429/5xx/timeout), it makes one attempt on the fallback model. Returns `{ text, model, tokensIn, tokensOut }`. An empty answer is an error. Part 4 adds `tools` and function calls here. |
| `src/services/citations.ts` | `applyCitationGuard({ answer, chunks, userMessage, toolCalled })`. Pure function, unit-tested. Details below. |
| `src/services/chat.ts` | `answer({ workspaceId, chatId, userMessage, assistantMessageId })`: history → retrieve → prompt → generate → guard → update the assistant row to `done` with `citations`, `retrieval`, tokens and latency. On any error the row becomes `failed` with a short message. Used by both "send" and "retry". |
| `src/middleware/chat.ts` | `loadChat`: `:chatId` must be a UUID and a chat **in `req.workspace`** (`where id = chatId and workspace_id = wsId`), otherwise 404. Sets `req.chat`. |
| `src/routes/chat.routes.ts`, `src/controllers/chat.controller.ts` | Routes below. Mounted in `workspace.routes.ts` after `loadWorkspace`. |
| `test/citations.test.ts` | Tests for the guard. |

### Routes (under `/api/workspaces/:wsId/chats`)
| Route | Behaviour |
|---|---|
| `GET /` | This workspace's chats, newest first: `id, title, created_at`. |
| `POST /` | Creates an empty chat. The title is filled from the first question (first 60 characters). |
| `GET /:chatId/messages` | All messages, oldest first. No pagination (out of scope). |
| `POST /:chatId/messages` `{ content }` | zod: 1–4000 characters after trimming. **(1)** Insert the user message (`done`) — saved before anything can fail. **(2)** Insert the assistant message (`pending`). **(3)** `answer(...)`. Returns `201 { userMessage, assistantMessage }`. The assistant message may be `failed`; that's still a 201, and the client shows Retry. |
| `POST /:chatId/messages/:messageId/retry` | Only for an assistant message with status `failed` (otherwise 409). Sets it back to `pending` and re-runs `answer` with the user message just before it. The same row is reused, so a retry never duplicates the question or the answer. |

### Prompt layout
```
systemInstruction:
  rules (DESIGN §4) + "Today is YYYY-MM-DD" + "Reply in plain text, no markdown"

contents:
  last 10 finished messages of this chat (user → "user", assistant → "model"),
    with old [cN] labels removed (they pointed at an older prompt's chunks)
  final user turn:
    <documents>
    <chunk label="c1" filename="falcon.md" section="Access codes">…</chunk>
    </documents>          (or <documents>NONE FOUND</documents>)

    Question: …
```
- **Chunk text is XML-escaped** (`&`, `<`, `>`, and quotes in attributes). A document that contains `</documents>` or `<chunk …>` can't close our tags or fake a chunk; it stays data.
- Documents go in the **current** turn only. History carries what was said, not old chunks, so the model can't cite a chunk that isn't in this prompt.
- No markdown, because the client renders plain text (no markdown library).

### Citation guard (`citations.ts`)
1. Find citation groups: `[c1]`, `[c1, c3]`, `[c2][c4]`. Keep labels that exist in this prompt and drop invented ones. A group with no valid labels is removed from the text.
2. `citations` = valid labels in first-use order → `{ label, chunk_id, document_id, filename, section, similarity }`.
3. If there are no valid citations **and** no tool was called **and** the user message isn't small talk, the answer becomes the fixed refusal: `I don't know — this workspace's documents don't cover that.`
4. Small talk = the whole message is a greeting, thanks, goodbye, "who are you" or "what can you do", allowing a few extra words like "there" plus punctuation. "Hi, what is the Falcon code?" is **not** small talk.
5. `retrieval.hit = citations.length > 0`.

### Decisions to review
| Decision | Why |
|---|---|
| Retry reuses the failed assistant row | The question is already saved; a retry should fill in the answer, not add a second copy of either message. |
| Failed answer still returns 201 | The request itself worked (the question is saved). The failure is part of the data, so the client renders it with a Retry button and the state survives a reload. |
| History: last 10 finished messages, labels stripped | Enough for follow-ups ("and when does it launch?"). Pending and failed rows are skipped. |
| XML-escape chunk text | Prompt-injection defence: uploaded text can't break out of `<documents>`. |
| Fallback after the full retry schedule | Matches DESIGN §6. Cost: while the primary model is overloaded (it was during planning), each answer waits ~7s of retries before the fallback replies. If that feels slow in testing, retry the primary once and then switch. That is a one-line change. |
| No thinking config | `thinkingLevel: LOW` worked on the fallback model but couldn't be tested on the primary (503). An unsupported setting would be a 400 that never retries, so the defaults stay. |
| Threshold | Set from measured scores on the test docs (section C), not guessed. |

---

## B. Client

| File | Purpose |
|---|---|
| `src/types.ts` | `Chat`, `Message`, `Citation`. |
| `src/components/ChatPanel.tsx` | A left column with "New chat" and this workspace's chats, and a right column with the conversation and the composer. Sending with no chat open creates one first. The user's message and a "Thinking…" placeholder show at once and are replaced by the server's rows. Enter sends; Shift+Enter adds a new line. The composer is disabled while an answer is pending. |
| `src/components/ChatMessage.tsx` | One message. In assistant text, `[c1]` becomes a small numbered marker. Under the answer: **Sources**, listing filename › section with the similarity score. A failed message shows the error and a **Retry** button. |
| `src/components/Dashboard.tsx` | A small tab bar: **Chat** and **Documents**. Part 5 adds Tasks and Tool calls. Each panel has `key={active.id}`, so switching workspaces never shows the old workspace's data. |
| `src/index.css` | Tabs, chat layout and message styles, using the existing Primer tokens. |

---

## C. How to verify

1. `cd server && npm test`: chunker and citation-guard tests pass.
2. End-to-end with a throwaway user (deleted afterwards). Workspace A gets `falcon.md`; B gets an unrelated doc.
   - A: "What is the Project Falcon code?" → contains **7731**, with a citation to `falcon.md`.
   - B: the same question → the fixed "I don't know" message, and B's retrieval record lists only B's chunks.
   - A: "What is the capital of France?" → "I don't know".
   - A: "hello" → a normal greeting, not a refusal.
   - A follow-up that needs history works.
   - Retry: with a bad Gemini key the assistant message is `failed` and the question is kept. Retry with a good key → `done`, and the chat has exactly 2 messages.
   - Another workspace's chat id → 404.
3. **Threshold tuning:** log the similarity of relevant and unrelated questions against the test docs and pick a value that separates them. Write it in `.env.example`, `server/.env` and DESIGN §2.
4. In the browser: ask, see the sources, reload and see the history, switch workspace and see a different chat list.

---

## D. Results (2026-11-18, AI session)

- `npm test`: **30/30** pass (chunker, citation guard, small talk, prompt escaping).
- End-to-end against the real Supabase and Gemini, with a throwaway user that was deleted afterwards. **15/15 checks pass:**
  - A: "What is the Project Falcon code?" → "The Project Falcon code is 7731 [c1]." citing `falcon.md › Access codes`.
  - A follow-up, "And when does it launch?", → "Project Falcon launches in Q3 [c1]." (history works).
  - A: "What is the capital of France?" → the fixed refusal. "hello!" → a normal greeting.
  - B: the Falcon question → refusal. B's retrieval record lists only B's chunks. B's own question (leave days) → cited answer from `handbook.md`.
  - A's chat through B's URL → 404 (GET and POST). A blank message → 400.
  - Bad Gemini key → 201 with a `failed` answer and the question saved. Retry with a good key → `done` in the **same row**, and the chat still has exactly 2 messages. Retrying a `done` answer → 409.
- **Threshold scores** (top-1 similarity): relevant 0.69–0.79, unrelated 0.54–0.58 → `SIMILARITY_THRESHOLD=0.62` (DESIGN §2).
- **Browser** (headless Chrome): cited answer with a numbered marker and a Sources box, the refusal, history after reload, the Documents tab and the 390px mobile layout all render correctly.
- **⚠ Latency:** `gemini-3.6-flash` returned **503 "high demand" on every call** during this session (planning probe, end-to-end run and browser run). Each answer waited for the full retry schedule (1+2+4s, plus however long each 503 took) before the fallback answered: **20–60s per answer**. The fallback, `gemini-3.5-flash-lite`, answers in ~1s when called directly and cited correctly every time. Options for the user:
  1. Swap them in `.env`: `GEMINI_CHAT_MODEL=gemini-3.5-flash-lite`, `GEMINI_CHAT_FALLBACK_MODEL=gemini-3.6-flash`. No code change.
  2. Retry the primary once, then fall back (a small change in `llm.ts`).
  3. Remember for a few minutes that the primary is down and go straight to the fallback (a small "circuit breaker").
