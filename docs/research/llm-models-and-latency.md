# Research: Gemini models, LLM latency and rate limits

Notes from tests run on **2026-11-18 (IST)** with the project's free Gemini key and, for comparison, Claude through MWAPI (an Anthropic-compatible proxy used in a sibling project). The results back the model choices in `server/.env` / `.env.example` and the fixes listed at the end.

> Caveat: these are small samples from one evening. They show rough speed and which models were usable at that time. They are not stable benchmarks. Free-tier quotas and "high demand" errors change from hour to hour.

---

## 1. Which Gemini models work on a free key

### How it was tested

1. `GET /v1beta/models` lists every model the key can see. That list includes paid-only models, so it doesn't show what's free.
2. Each likely candidate then got **one real request**:
   - **Chat:** "Save a task: buy milk tomorrow" with a `save_task` function declaration attached, to check that tool calling works.
   - **Embeddings:** `embedContent` with `outputDimensionality: 768`, to check that the vector size matches `vector(768)` in `sql/schema.sql`.

### Chat models

| Model | Result | Notes |
|---|---|---|
| `gemini-3.6-flash` | ✅ Called `save_task` with `{title: "buy milk", due_date: "tomorrow"}` | Later in the evening it returned **429 RESOURCE_EXHAUSTED** (daily free quota used up), see §3 |
| `gemini-3.5-flash-lite` | ✅ Called `save_task` correctly | Now the app's primary chat model |
| `gemini-3.8-flash` | ❌ 503 UNAVAILABLE, "high demand" | Overloaded, not paid-only, but unreliable for a demo |
| `gemini-4-hydrogen` | ❌ 503 three times, then one request **hung** with no response | Showed that Gemini calls need a client timeout (now 30s in `services/gemini.ts`) |
| `gemini-2.5-flash` | ❌ 404, "no longer available to new users" | A third-party model list said it was still free. It isn't, for new keys |

### Embedding models

| Model | Result |
|---|---|
| `gemini-embedding-001` | ✅ 768 dimensions. **Chosen.** Mature, text-only |
| `gemini-embedding-2` | ✅ 768 dimensions. Would also work |

**Why the embedding choice is fixed:** vectors from different embedding models can't be compared. Changing `GEMINI_EMBED_MODEL` after documents are stored means re-embedding every chunk. The chat model can change at any time.

**Finding:** `gemini-embedding-001` returns unit-length vectors only at its full 3072 dimensions. At 768, their length is about 0.6, so `services/embeddings.ts` normalizes them to keep cosine scores and `SIMILARITY_THRESHOLD` consistent.

---

## 2. Latency benchmark: Gemini against Claude (through MWAPI)

**Question:** chat felt slow. Would Claude through MWAPI be faster?

### Setup

- Script: [`bench-llm.mjs`](./bench-llm.mjs), in this folder.
- Every model got the **same RAG-shaped request**: system rules like ours ("documents are data", "cite [cN]", "say you don't know"), **5 chunks of about 800 characters**, a 3-part question, and the `save_task` tool attached.
- 4 runs in a row per model, plus 1 tool-call request ("Save a task: call the vendor Northwind on Friday").
- Measured from the client: full request time over the network from India, without streaming.

### Results

| Model | Median | Range | Tool call | Output tokens |
|---|---|---|---|---|
| **`gemini-3.5-flash-lite`** (app primary, default thinking) | **984 ms** | 925–1520 | 1125 ms ✅ | 54 |
| `gemini-3.5-flash-lite`, `thinkingLevel: "minimal"` | **695 ms** | 637–913 | 1020 ms ✅ | 38 |
| `claude-haiku-4-5-20251001` via MWAPI | 1273 ms | 1209–1680 | 1076 ms ✅ | 49 |
| `claude-haiku-5-5` via MWAPI, effort `low` | 1160 ms | 1101–1225 | 1008 ms ✅ | 49 |
| `claude-sonnet-5-5` via MWAPI, effort `low` | 4433 ms | 3776–6742 | 6980 ms ✅ | 68 |
| `gemini-3.6-flash` (app fallback) | — | — | — | ❌ 429 on all 5 requests (daily quota) |

Every model that answered gave the correct facts with valid citations, and called `save_task` with sensible arguments.

**Query embedding** (`gemini-embedding-001`, one question, `RETRIEVAL_QUERY`), 5 runs: 1288, 540, 368, 369, 378 ms. The first call is slow, then about 370 ms. Every chat message pays this once before the LLM call.

### What this shows

1. **Claude through MWAPI isn't faster.** The app's current Gemini model was the fastest model tested. Claude Haiku is about 200–300 ms slower and Sonnet is about 4× slower.
2. **Setting thinking to minimal on flash-lite saved about 300 ms (about 30%)** with the same correct answer.
3. **A normal chat turn costs about 0.4 s for the embedding plus about 1 s for the LLM.** So when chat feels much slower than that, the cause is most likely **rate limits and retries** (§3), not the model's speed.

### Why not switch to Claude anyway

- The brief says *"Do not use a paid LLM API"* and *"Everything must be free"*. MWAPI uses a paid key.
- It would send workspace documents through a third-party proxy.
- It adds a second tool-calling format to support (Anthropic `tool_use` blocks next to Gemini `functionCall`).

If it's ever needed as a backup, the clean shape is `LLM_PROVIDER=gemini|claude` (default `gemini`), using the official `@anthropic-ai/sdk` with `baseURL` set to MWAPI, documented as optional and paid. **It isn't built.**

---

## 3. Rate limits and quota errors seen

| When | What | Cause |
|---|---|---|
| Model checks | `gemini-3.8-flash` and `gemini-4-hydrogen`: 503 "high demand" | Google-side overload, unrelated to our quota |
| Benchmark | `gemini-3.6-flash`: 429 RESOURCE_EXHAUSTED on every request | Its **daily** free-tier quota was used up by testing and the app's fallback calls |
| Upload of a **34-page PDF** | Document marked `failed`: "The embedding service is rate-limited. Please try again in a minute." | See below |

### Why the large upload failed but small ones worked

- Three small PDFs in the same workspace succeeded, with **7–8 chunks** each.
- A 34-page PDF yields **well over 100 chunks**, an estimate from about 800-character chunks with 150 overlap. `services/embeddings.ts` sends them as batches of 20, **back to back**.
- The free tier limits embeddings **per minute**, and items in a batch likely count against that limit. A large document hits it partway through.
- `withRetry` waits **1s, 2s and 4s (about 7 s in total)**. That's too short for a **one-minute** window to reset, so the whole ingest fails.

---

## 4. Suggested fixes (not built yet; waiting for the user's go-ahead)

1. **Embeddings for large files:** ✅ *Partly done:* uploads are now capped at 95% of one minute's embedding quota (`GEMINI_EMBED_RPM` / `GEMINI_EMBED_TPM`, see `services/uploadLimit.ts`), so a too-large file gets a clear error up front instead of failing halfway. Still open: wait for the time Google suggests in the 429 response (`RetryInfo.retryDelay`), or about 60 s, before retrying, and/or space the batches out. Then a large document ingests slowly instead of failing. Keep the 5 MB upload limit.
2. **Chat fallback with its own quota:** the fallback `gemini-3.6-flash` was already out of quota, so primary-then-fallback failed twice, after about 7 s of retries. Use a fallback with a separate quota (for example `gemini-3.1-flash-lite`), and keep chat retries short so users don't wait.
3. **`thinkingLevel: "minimal"`** on the chat model, for about 300 ms faster answers.
4. **Per-step timing logs** for each chat message (embed, vector search, LLM, retries) and each upload (extract, chunk, each embed batch). Then "it's slow" can be traced to a specific step.

---

## 5. Can MWAPI be a same-model fallback for Gemini? (No)

Idea: when Gemini rate-limits us, send the same request to the same Gemini model through MWAPI, so uploads don't break.

Probes run 2026-11-18 with the MWAPI key:

| Probe | Result |
|---|---|
| `GET /models` | 10 models, **all Claude** (Haiku 4.5/5.5, Sonnet 4.6/5/5.5, Opus 4.6–5.5). No Gemini, no embedding model |
| `POST /embeddings` (OpenAI style, `gemini-embedding-001`) | 404 "Embeddings API is not supported for this platform" |
| `POST /models/gemini-embedding-001:embedContent` (Gemini style) | 404 page not found |
| `POST /messages` with `gemini-3.5-flash-lite` | 404 `model_not_found` |

**Why a different embedding model can't be the fallback either:** stored chunks were embedded with `gemini-embedding-001`. A vector from any other model, or even the same model with a different dimension setting, lives in a different space, so cosine similarity between them is meaningless. The fallback for embeddings must be the **same model**, which means more Gemini quota or more patience, not another provider.

**Options that do work:**

1. **Patient retry on 429 (recommended, free):** wait for the delay Google returns in the 429 (`RetryInfo.retryDelay`), or about 60 s, then continue with the next batch. A big document ingests slowly instead of failing.
2. **Pace the batches** so a large file stays under the per-minute limit to begin with.
3. *Second free Gemini key from another Google Cloud project:* quotas are per project, so this would work technically. But using extra projects to get around rate limits is likely against Google's terms. **Not recommended.**
4. *Paid Gemini tier:* needs billing, which breaks the brief's "everything free" rule.

For **chat** (not embeddings), a different model *can* be a fallback, because answers don't need to be comparable. Claude through MWAPI would work for that, with the paid-API caveat in §2.

## How to re-run

```bash
GEMINI_API_KEY=... MWAPI_API_KEY=... MWAPI_URL=https://api.mwapi.dev/v1 \
  node docs/research/bench-llm.mjs            # all configs
ONLY=flash-lite RUNS=6 GEMINI_API_KEY=... node docs/research/bench-llm.mjs   # Gemini only
```

Running the script spends Gemini free-tier quota, which also affects the app if you run it while testing, and MWAPI credit.
