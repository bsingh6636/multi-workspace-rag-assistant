import { useEffect, useState } from 'react'
import {
  AlertIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  FileIcon,
  InfoIcon,
  PulseIcon,
  SyncIcon,
  XIcon,
} from '@primer/octicons-react'
import { toast } from 'sonner'
import type { Citation, Message, ToolCallSummary } from '../types'

type Props = {
  message: Message
  onRetry: (messageId: string) => void
  /** The newest answer in the chat: its Copy button is always shown, not only on hover. */
  latest?: boolean
}

// One chat message. Assistant answers show plain text (the model's [c1]
// markers are hidden) with a collapsible list of the documents they came from. A failed answer shows why, with
// a Retry button (the question is already saved on the server).
export default function ChatMessage({ message, onRetry, latest = false }: Props) {
  if (message.role === 'user') {
    return (
      <div className="msg msg-user">
        <div className="msg-bubble">{message.content}</div>
      </div>
    )
  }

  if (message.status === 'pending') {
    return (
      <div className="msg msg-assistant" aria-live="polite">
        <span className="spinner spinner-sm" aria-hidden="true" />
        <span className="muted">Thinking…</span>
      </div>
    )
  }

  if (message.status === 'failed') {
    return (
      <div className="msg msg-assistant">
        {/* A tool may have run before the answer failed (e.g. the task was saved). */}
        <ToolCalls calls={message.tool_calls} />
        <div className="flash flash-error flash-row msg-failed" role="alert">
          <span className="msg-failed-text">
            <AlertIcon />
            {message.error ?? 'This answer failed.'}
          </span>
          <button type="button" className="btn btn-sm" onClick={() => onRetry(message.id)}>
            <SyncIcon />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return <Answer message={message} latest={latest} />
}

// A finished answer: text, tool lines, sources, then Copy and Details.
// Its own component so it can hold the Details panel's open/closed state.
function Answer({ message, latest }: { message: Message; latest: boolean }) {
  const [showDetails, setShowDetails] = useState(false)
  const sources = groupByDocument(message.citations)
  const text = withoutCitationMarkers(message.content ?? '')
  const classes = ['msg', 'msg-assistant', latest && 'msg-latest', showDetails && 'msg-details-open'].filter(Boolean)

  return (
    <div className={classes.join(' ')}>
      <div className="msg-text">{text}</div>
      <ToolCalls calls={message.tool_calls} />
      {sources.length > 0 && (
        // Native <details>: collapsed by default, opens on click or Enter/Space, no state needed.
        <details className="msg-sources">
          <summary>
            <ChevronRightIcon className="msg-sources-chevron" />
            Sources · {plural(sources.length, 'document')}
          </summary>
          <ol>
            {sources.map((src) => (
              <li key={src.documentId}>
                <FileIcon />
                <span className="source-name">{src.filename}</span>
                {src.sections.length > 0 && <span className="muted"> › {src.sections.join(', ')}</span>}
                <span className="source-score" title="Best similarity between the question and this document's chunks">
                  {src.similarity.toFixed(2)}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
      <div className="msg-actions">
        {text && <CopyButton text={text} />}
        <button
          type="button"
          className="btn-octicon btn-octicon-sm"
          onClick={() => setShowDetails((open) => !open)}
          aria-expanded={showDetails}
          aria-label={showDetails ? 'Hide details' : 'Show details: retrieval, tokens and latency'}
          title="Details"
        >
          <PulseIcon size={14} />
        </button>
      </div>
      {showDetails && <AnswerDetails message={message} />}
    </div>
  )
}

// The retrieval debug panel: which workspace was searched, every chunk the
// search ranked (kept or below the threshold, and whether the answer cited it),
// and what the answer cost. All of it comes from the message row.
function AnswerDetails({ message }: { message: Message }) {
  const r = message.retrieval
  const cited = new Set(message.citations.map((c) => c.chunk_id))

  return (
    <div className="msg-details" role="region" aria-label="Answer details">
      {r ? (
        <>
          <p className="msg-details-line">
            Workspace <code title={r.workspace_id}>{shortId(r.workspace_id)}</code> · threshold {r.threshold} · top{' '}
            {r.k} · {r.kept} of {r.retrieved.length} kept · {r.hit ? 'cited' : 'no citation'}
          </p>
          {r.retrieved.length === 0 ? (
            <p className="msg-details-line muted">This workspace has no chunks to search.</p>
          ) : (
            <table className="msg-details-table">
              <thead>
                <tr>
                  <th scope="col">Label</th>
                  <th scope="col">Chunk</th>
                  <th scope="col">Similarity</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {r.retrieved.map((chunk) => (
                  <tr key={chunk.chunk_id}>
                    <td>{chunk.label ?? '—'}</td>
                    <td title={`Chunk ${chunk.chunk_id}`}>
                      {chunk.filename ?? shortId(chunk.chunk_id)}
                      {chunk.section && <span className="muted"> › {chunk.section}</span>}
                    </td>
                    <td>{chunk.similarity.toFixed(3)}</td>
                    <td>
                      <ChunkStatus kept={chunk.kept} cited={cited.has(chunk.chunk_id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <p className="msg-details-line muted">No retrieval record for this answer.</p>
      )}
      <p className="msg-details-line">
        Tokens {formatCount(message.tokens_in)} in · {formatCount(message.tokens_out)} out · latency{' '}
        {message.latency_ms != null ? `${(message.latency_ms / 1000).toFixed(1)} s` : '—'}
      </p>
    </div>
  )
}

function ChunkStatus({ kept, cited }: { kept: boolean; cited: boolean }) {
  if (cited) return <span className="label label-success">cited</span>
  if (kept) return <span className="label">in prompt</span>
  return <span className="muted">below threshold</span>
}

// "9c628c5a-9656-…" → "9c628c5a…" (the full id is in the title).
function shortId(id: string): string {
  return `${id.slice(0, 8)}…`
}

function formatCount(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString()
}

// Copies the answer (without the [c1] markers). The icon turns into a check
// for a moment so the click visibly did something.
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      toast.error("Couldn't copy. Your browser blocked clipboard access.")
    }
  }

  return (
    <button
      type="button"
      className="btn-octicon btn-octicon-sm"
      onClick={copy}
      aria-label={copied ? 'Copied' : 'Copy answer'}
      title={copied ? 'Copied' : 'Copy'}
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
    </button>
  )
}

// One small line per tool call the answer made: ✓ what was done, or ✕ what
// failed and why. Every attempt is logged on the server; a Retry can repeat an
// identical call (the tool then returns the earlier result), so repeats show once.
function ToolCalls({ calls = [] }: { calls?: ToolCallSummary[] }) {
  const seen = new Set<string>()
  const unique = calls.filter((c) => {
    const key = JSON.stringify([c.tool_name, c.status, c.error, c.args])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (unique.length === 0) return null

  return (
    <ul className="msg-tools" aria-label="Actions">
      {unique.map((c) => {
        const ok = c.status === 'success'
        const reason = c.error ? shortReason(c.error) : null
        return (
          <li
            key={`${c.created_at}-${c.tool_name}`}
            className={ok ? 'msg-tool' : 'msg-tool msg-tool-failed'}
            title={c.error ?? undefined}
          >
            {ok ? <CheckIcon size={12} /> : <XIcon size={12} />}
            <span>{describeToolCall(c)}</span>
            {reason && <span className="msg-tool-reason">{` · ${reason}`}</span>}
            {/* The listed tasks are text the model wrote, so they can't be ticked here. */}
            {ok && c.tool_name === 'list_tasks' && (
              <span className="msg-tool-info" title={TASKS_TAB_HINT} aria-label={TASKS_TAB_HINT} role="img">
                <InfoIcon size={12} />
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

const TASKS_TAB_HINT = 'To mark tasks done or delete them, use the Tasks tab.'

function describeToolCall(c: ToolCallSummary): string {
  const args = (c.args ?? {}) as Record<string, unknown>
  const ok = c.status === 'success'
  switch (c.tool_name) {
    case 'save_task': {
      if (!ok) return "Couldn't save the task"
      const due = typeof args.due_date === 'string' ? ` (due ${args.due_date})` : ''
      return `Saved task “${String(args.title ?? '')}”${due}`
    }
    case 'list_tasks':
      return ok ? 'Listed tasks' : "Couldn't list tasks"
    case 'complete_task':
      return ok ? 'Marked a task done' : "Couldn't mark the task done"
    case 'send_discord_summary':
      return ok ? 'Posted to Discord' : "Couldn't post to Discord"
    default:
      return `Asked for unknown tool “${c.tool_name}”`
  }
}

// zod's messages are multi-line ("✖ Invalid ISO date\n  → at due_date"); one line fits here.
function shortReason(error: string): string {
  return error.replace(/✖\s*/g, '').replace(/\s*\n\s*/g, ' ').trim()
}

type Source = { documentId: string; filename: string; sections: string[]; similarity: number }

// Several cited chunks can come from the same file: list each document once,
// with the pages/sections it was cited from and its best similarity score.
// Order follows the first time each document was cited.
function groupByDocument(citations: Citation[]): Source[] {
  const byDocument = new Map<string, Source>()
  for (const c of citations) {
    const src = byDocument.get(c.document_id) ?? {
      documentId: c.document_id,
      filename: c.filename,
      sections: [],
      similarity: c.similarity,
    }
    if (c.section && !src.sections.includes(c.section)) src.sections.push(c.section)
    src.similarity = Math.max(src.similarity, c.similarity)
    byDocument.set(c.document_id, src)
  }
  return [...byDocument.values()]
}

// The model marks facts with [c1], [c2]… (the server's citation guard needs
// them). They're hidden here, together with the space before them:
// "code is 7731 [c1]." → "code is 7731."
function withoutCitationMarkers(text: string): string {
  return text.replace(/\s*\[c\d+\]/g, '')
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
