# Part 2 plan: Ingestion

Goal: upload `.txt`, `.md` and `.pdf` files into the active workspace. Each file is chunked and embedded, and the chunks are stored in the shared `chunks` table with `workspace_id`. Re-uploading the same content into the same workspace adds nothing.

Checklist lives in `PLAN.md`. Spec: `docs/DESIGN.md` §2 and §3. This file holds the detail.

---

## A. Server

### New dependencies
`multer` (uploads), `pdf-parse` v2 (PDF text, per page), `@google/genai` (embeddings), `@types/multer` (dev).

Checked with real calls before writing code:
- `new PDFParse({ data }).getText()` returns `pages: [{ num, text }]`, so PDF chunks can use `"page N"` as their section.
- `ai.models.embedContent({ contents: [a, b, c], config: { taskType, outputDimensionality: 768 } })` returns one 768-value vector per text. Their length (norm) is about 0.59, not 1, which confirms DESIGN §2: normalize before storing.
- SDK errors are `ApiError` with a numeric `status` (for example 400 for a bad key, 429 for rate limits).

### Files
| File | Purpose |
|---|---|
| `src/config.ts` | Adds `GEMINI_API_KEY` (required) and `GEMINI_EMBED_MODEL` (default `gemini-embedding-001`). |
| `src/services/gemini.ts` | One `GoogleGenAI` client with a 30s request timeout, plus `withRetry(fn)`: on 429, 5xx or a timeout it waits 1s, 2s, 4s and tries again (4 tries in all). Other errors (such as 400 bad key) fail at once. Part 3 reuses this for chat. |
| `src/services/embeddings.ts` | `embedTexts(texts, taskType)`: batches of 20, each batch through `withRetry`, every vector normalized to length 1. `EMBEDDING_DIM = 768` matches `vector(768)` in the schema. |
| `src/services/chunker.ts` | Pure functions, no I/O: `normalizeText`, `chunkMarkdown`, `chunkPages`. Detail below. |
| `src/services/extract.ts` | `extractText(file)`: PDF through pdf-parse (returns pages), others as UTF-8. |
| `src/services/ingest.ts` | `ingestDocument(workspaceId, file)`: the pipeline below. |
| `src/middleware/upload.ts` | multer: memory storage, 5 MB, one file in field `file`, extension allowlist `.txt .md .pdf`. Fixes multer's latin1 decoding of non-ASCII filenames. |
| `src/routes/document.routes.ts` | `GET /`, `POST /` (upload middleware first), `DELETE /:docId`. Mounted in `workspace.routes.ts` as `router.use('/:wsId/documents', documentRoutes)` **after** `loadWorkspace`, so ownership is already checked. |
| `src/controllers/document.controller.ts` | Handlers. They only use `req.workspace!.id`. |
| `src/middleware/error.ts` | Adds `MulterError`: file too large → 413, others → 400. |
| `test/chunker.test.ts` | `node:test` tests for the chunker, run with `npm test`. |

### Routes (all under `/api/workspaces/:wsId/documents`)
| Route | Behaviour |
|---|---|
| `GET /` | This workspace's documents, newest first: `id, filename, status, error, chunk_count, created_at`. |
| `POST /` (multipart, field `file`) | Runs the pipeline. Returns `201 { document, duplicate: false }`, or `200 { document, duplicate: true }` when the same content already exists. If ingestion fails, the document comes back with `status: 'failed'` and `error`, so the UI shows it in the list. |
| `DELETE /:docId` | Deletes `where id = docId and workspace_id = wsId`. Chunks go with it (`ON DELETE CASCADE`). 404 if nothing matched, so another workspace's document id can't be deleted. A malformed id also gets 404. |

### Pipeline (`ingest.ts`)
```
extract text (pdf: per page, else utf-8)
normalize: \r\n → \n, drop NUL bytes (Postgres text can't store them),
           trim line ends, collapse 3+ blank lines, trim
empty? → 400 "No text found" (e.g. a scanned PDF; OCR is out of scope)
hash = sha256(normalized text)
existing = documents where workspace_id = ws and content_hash = hash
  ready or processing → return { document: existing, duplicate: true }
  failed              → delete it and continue (re-uploading retries a failed doc)
chunk → 0 chunks? 400.  > 300 chunks? 400 "too long" (see decisions)
insert document (status 'processing')
  unique violation (two uploads raced) → return the winner as duplicate
try:
  for each batch of 20 chunks:
    embed (RETRIEVAL_DOCUMENT, retry, normalize)
    insert rows { workspace_id, document_id, chunk_index, content, section, embedding }
  update document → status 'ready', chunk_count
catch:
  delete this document's chunks
  update document → status 'failed', error = message (max 500 chars)
```

### Chunker
- **Markdown/text:** walk the lines. A heading line (`# …` to `###### …`) sets the current `section` and starts a new paragraph. Blank lines end a paragraph. The heading text stays at the start of the next chunk, so "Access codes" is part of what gets embedded.
- **Windows** (changed while building; simpler than packing paragraphs): each section is cut into windows of at most **800** characters. A window ends at the last paragraph break in its second half, else line break, else sentence end, else space. The next window starts ~**150** characters earlier, at a word start, so a fact that crosses the cut appears whole in at least one chunk. This gives a hard 800 cap and handles long paragraphs with the same code. A new section always starts a fresh chunk with no overlap, so the section label stays accurate.
- **PDF:** each page is chunked the same way with `section = "page N"`. The hash covers the whole document text.

### Decisions to review
| Decision | Why |
|---|---|
| Re-uploading a `failed` document retries it | Otherwise a document that failed once (for example a Gemini outage) could never be uploaded again, because its hash would block it as a "duplicate". |
| Cap of 300 chunks per document (about 200 KB of text) | Embedding is the slow, rate-limited step. 300 chunks is 15 embedding calls; a 5 MB text file would be about 7,000 chunks and 350 calls inside one HTTP request, which would hit the free-tier rate limit and time out. The seed docs are a few KB. |
| Processing happens inside the request | DESIGN §3: files are small. The client shows a spinner on the row. Background processing with polling stays a "time allows" item. |
| Insert chunks per batch of 20 | Each row carries 768 floats (about 15 KB as JSON), so one insert per batch keeps requests small. Partial chunks are removed if a later batch fails. |
| Heading kept inside chunk text | Retrieval matches the heading words as well, and the citation shows the section. |

---

## B. Client

| File | Purpose |
|---|---|
| `src/types.ts` | `DocumentRow`, `UploadResult`. |
| `src/components/DocumentsPanel.tsx` | Loads `GET /documents` for the active workspace. An "Upload" button opens the file picker (`.txt,.md,.pdf`, several files allowed). Files upload one at a time, each showing a placeholder "Uploading…" row. Toasts: success with chunk count, "already uploaded, skipped" for duplicates, the error for failures. The list shows filename, a status label (Ready / Processing / Failed with the error as a tooltip and a line under the name), chunk count, date and a delete button. |
| `src/components/DeleteDocumentDialog.tsx` | Confirm dialog (the existing `Modal`), danger style. |
| `src/components/Dashboard.tsx` | Replaces the "Nothing here yet" box with `<DocumentsPanel key={active.id} workspaceId={active.id} />`. The `key` gives each workspace a fresh panel, so documents from the previous workspace never flash. |
| `src/index.css` | Styles for the list rows and status labels, using the existing Primer tokens. |

Uploads use `postRequest` with a `FormData` body. axios sets the multipart header itself.

---

## C. How to verify

1. `cd server && npm test`: chunker tests pass.
2. Run both dev servers. In workspace A, upload two files (one `.md`, one `.pdf`). Both show **Ready** with a chunk count.
3. Upload the `.md` again: toast "already uploaded", and the list doesn't change.
4. In Supabase: `select workspace_id, count(*) from chunks group by 1;` shows only A's id, and the counts match the list.
5. Upload the same `.md` into workspace B: it's accepted there (dedup is per workspace).
6. Delete a document: its chunks are gone (`select count(*) from chunks where document_id = '…'` gives 0).
7. Try a `.docx` or a file over 5 MB: a clear error toast, and nothing is stored.

---

## D. Results (2026-11-18, AI session)

- `npm test`: 10 chunker tests pass. They include "every sentence appears whole in at least one chunk", which checks the overlap.
- End-to-end against the real Supabase project and Gemini, using a throwaway user that was deleted afterwards (cascade removed its rows). **19/19 checks passed:**
  - A `.md` upload → 201 `ready`, 3 chunks, about 3.8s. The same file again → 200 duplicate with the same id. The same text with CRLF line endings → also a duplicate (normalization works).
  - A 2-page PDF → 2 chunks with sections `page 1` and `page 2`. The filename `résumé.md` is kept intact.
  - The same file in workspace B → 201 (dedup is per workspace). Chunk rows carry the right `workspace_id`, and the counts match `chunk_count` (A=6, B=3).
  - `.docx` → 400, whitespace-only `.txt` → 400, over 5 MB → 413, no file → 400. None of them leave a row.
  - Deleting A's document through B's URL → 404. A malformed id → 404. An unknown workspace → 404. A real delete → 204 with 0 chunks left.
  - Bad Gemini key → the document is `failed` with "The embedding request was rejected (status 400).", no chunks are left, and the server log has only that line. Re-uploading with a good key → the upload is retried and becomes `ready`, with one row.
- **Finding for Part 3 (threshold):** `match_chunks` scores in workspace A:
  - "What is the Project Falcon code?" → 0.80 / 0.79 / 0.75
  - "What is the capital of France?" (unrelated) → 0.54 / 0.54 / 0.53

  The default `SIMILARITY_THRESHOLD=0.5` would let unrelated chunks into the prompt. The citation guard still protects the answer, but Part 3 should tune the threshold on the seed docs; something around **0.65** looks right.
- Not checked by the AI: how the Documents panel looks in a browser (upload button, drag-and-drop, labels, delete dialog). The client typechecks, passes lint and builds.
