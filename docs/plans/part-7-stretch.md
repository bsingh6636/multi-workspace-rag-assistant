# Part 7 plan: Stretch

Goal: make the RAG pipeline visible. For any answer you can see what was retrieved, from which workspace, how similar each chunk was, what the threshold let through, what the answer cited, and what the answer cost in tokens and time.

Checklist lives in `PLAN.md`. Other sessions are working on the dashboard and lists in parallel, so this part stays out of `Dashboard.tsx`, `useList.ts` and the panels.

---

## A. What's already stored

Every assistant message row already has:
- `retrieval` (jsonb): `workspace_id`, `threshold`, `k`, `retrieved: [{ chunk_id, similarity, kept }]`, `kept`, and `hit` (did the answer cite anything).
- `tokens_in`, `tokens_out` (summed over every model call in the turn) and `latency_ms` (whole turn).

The messages endpoint returns all columns, so the client already receives them.

## B. Server (small)

`services/retrieve.ts`: each `retrieved` entry also gets `filename`, `section` and, for kept chunks, its prompt `label` (`c1`, `c2`, …). Without them the panel could only show bare chunk UUIDs, which mean nothing to a reader. The added fields are plain metadata about the user's own workspace, not chunk text. Old messages keep the old shape, so the panel treats these fields as optional.

## C. Client

- `types.ts`: `Message` gets `retrieval`, `tokens_in`, `tokens_out` and `latency_ms` (all optional/nullable).
- `ChatMessage.tsx`: a small icon button (`PulseIcon`, "Details") sits next to Copy under each answer, shown on hover like Copy. It toggles a panel under the answer:
  - **Request:** workspace id (shortened, full on hover), threshold, top-k, how many chunks were kept, and whether the answer cited any.
  - **Chunks** (one row each, in rank order): label or "—", file › section, similarity to 3 decimals, and a status: "cited", "in prompt" (kept but not cited) or "below threshold". The chunk id is shown short, full on hover.
  - **Cost:** tokens in / out, latency in seconds.
  - Failed answers also show latency (and the error is already shown).
- `index.css`: appended styles. The panel uses the same muted box as tool-call Details.

The panel is closed by default, so normal use isn't cluttered, and it's always one click away for a reviewer.

## D. Streaming: not built

The citation guard runs on the **finished** answer. It can replace the whole text with "I don't know", "I can't do that. …" or a fixed reply, and it removes invalid labels. Streaming tokens to the browser would show text that the guard may then take back, which is exactly what the guard exists to prevent. Streaming safely would mean holding the stream until the guard runs, which gives no benefit, or streaming only after a separate pre-check. That's out of proportion for a stretch item. Recorded in DESIGN as a deliberate trade-off.

## E. How to verify

1. Unit test for the new `retrieved` fields: `retrieve` is DB-bound, so the mapping is moved into a pure function and tested.
2. A browser run on a test server with a throwaway user and the seed docs:
   - Ask the Falcon code question in A, open Details, and check the workspace id is A's, a `falcon.md` chunk is "cited" with similarity ≥ 0.62, the counts match, and tokens and latency are shown.
   - Ask the same in B: no "cited" rows, and the chunks are either below the threshold or "in prompt" without a citation.
   - Check phone width (390px), and check that an old message without the new fields still renders.
3. Typecheck, lint and build.

## F. Results (2026-11-18)

- **Unit tests:** 109/109, including 4 new `retrieve.test.ts` tests for `splitByThreshold`: labels in rank order, a similarity exactly at the threshold is kept, none kept is fine, and chunk text never goes into the record. Server and client typechecks pass, and the client builds. Lint shows only the two warnings that were already there (`useList.ts`, `Dashboard.tsx`, from other sessions).
- **Gemini quota:** both chat models ran out of free-tier daily requests during this part. `gemini-3.5-flash-lite` used its 500/day and `gemini-3.6-flash` its 20/day, across all sessions' testing. Each resets in about 4.5 h. Two live questions failed with Retry, as designed. So the browser check used **real retrieval** (`retrieve()` against the seeded workspaces; embeddings have their own quota) saved on stored answers, instead of live answers.
- **Browser run:** 12/12 checks, headless Chrome on :3127, with a seeded throwaway user that was deleted afterwards.
  - **A**, "What is the Project Falcon code?": workspace id = A. 5 of 5 kept. `falcon.md › Access codes` at 0.782 is **cited**, and four others are **in prompt**. Tokens and latency are shown.
  - **B**, same question: workspace id = B. Only `injection.txt` (0.663) passed the threshold. Four handbook and IT chunks (0.56–0.59) are **below threshold**. No Falcon chunk is listed, and there's "no citation".
  - A pre-Part 7 record (no file or label) renders with a short chunk id and the cost line.
  - The toggle closes the panel. At 390px the page doesn't scroll sideways (the table scrolls inside the panel). No console errors.
  - Screenshots: `ui-p7-details-A.png`, `ui-p7-details-mobile.png` (session scratchpad).
- **Not done:** failed answers don't get the panel (the error and Retry are what matters there). Streaming is not built (section D).
