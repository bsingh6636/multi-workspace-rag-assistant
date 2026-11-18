import { AlertIcon, ChevronRightIcon, FileIcon, SyncIcon } from '@primer/octicons-react'
import type { Citation, Message } from '../types'

type Props = {
  message: Message
  onRetry: (messageId: string) => void
}

// One chat message. Assistant answers show plain text (the model's [c1]
// markers are hidden) with a collapsible list of the documents they came from. A failed answer shows why, with
// a Retry button (the question is already saved on the server).
export default function ChatMessage({ message, onRetry }: Props) {
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

  const sources = groupByDocument(message.citations)

  return (
    <div className="msg msg-assistant">
      <div className="msg-text">{withoutCitationMarkers(message.content ?? '')}</div>
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
    </div>
  )
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
