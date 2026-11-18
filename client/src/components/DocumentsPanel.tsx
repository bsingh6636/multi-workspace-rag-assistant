import { useEffect, useRef, useState, type DragEvent } from 'react'
import { FileIcon, TrashIcon, UploadIcon } from '@primer/octicons-react'
import { toast } from 'sonner'
import { deleteRequest, errorMessage, getRequest, postRequest } from '../lib/http'
import type { DocumentRow, DocumentStatus, UploadResult } from '../types'
import DeleteDocumentDialog from './DeleteDocumentDialog'

// Same limits as the server (server/src/middleware/upload.ts). Checked here only
// to give instant feedback; the server enforces them anyway.
const ACCEPT = '.txt,.md,.pdf'
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.pdf']
const MAX_BYTES = 5 * 1024 * 1024

// Documents in the active workspace: list, upload (button or drag-and-drop) and
// delete. Dashboard renders it with key={workspaceId}, so switching workspaces
// mounts a fresh panel and the previous workspace's list never shows.
export default function DocumentsPanel({ workspaceId }: { workspaceId: string }) {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string[]>([]) // filenames in progress
  const [dragging, setDragging] = useState(false)
  const [toDelete, setToDelete] = useState<DocumentRow | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const base = `/workspaces/${workspaceId}/documents`

  useEffect(() => {
    getRequest<DocumentRow[]>(base)
      .then(setDocuments)
      .catch((e) => setLoadError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [base])

  // Uploads one file at a time: each one is chunked and embedded on the server
  // inside the request, and parallel uploads would only compete for rate limits.
  async function uploadFiles(files: File[]) {
    for (const file of files) {
      const problem = checkFile(file)
      if (problem) {
        toast.error(`“${file.name}”: ${problem}`)
        continue
      }

      setUploading((list) => [...list, file.name])
      try {
        const form = new FormData()
        form.append('file', file)
        const { document, duplicate } = await postRequest<UploadResult>(base, form)

        if (duplicate) {
          toast.info(`“${file.name}” is already in this workspace, so it was skipped`)
        } else if (document.status === 'failed') {
          toast.error(`“${file.name}” couldn't be processed: ${document.error}`)
        } else {
          toast.success(`Added “${file.name}” (${plural(document.chunk_count, 'chunk')})`)
        }
        // Replace the row if it's already listed, otherwise add it at the top.
        setDocuments((list) => [document, ...list.filter((d) => d.id !== document.id)])
      } catch (e) {
        toast.error(`Couldn't upload “${file.name}”: ${errorMessage(e)}`)
      } finally {
        setUploading((list) => list.filter((name) => name !== file.name))
      }
    }
  }

  async function deleteDocument() {
    if (!toDelete) return
    await deleteRequest(`${base}/${toDelete.id}`)
    setDocuments((list) => list.filter((d) => d.id !== toDelete.id))
    toast.success(`Deleted “${toDelete.filename}”`)
    setToDelete(null)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    uploadFiles(Array.from(e.dataTransfer.files))
  }

  const isEmpty = !loading && !loadError && documents.length === 0 && uploading.length === 0

  return (
    <section
      className={dragging ? 'box panel dropzone-active' : 'box panel'}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      // Moving over a child element also fires dragleave; only react when the
      // pointer actually leaves the panel.
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={handleDrop}
    >
      <header className="box-header">
        <h2>
          Documents {!loading && <span className="counter">{documents.length}</span>}
        </h2>
        <button type="button" className="btn btn-sm" onClick={() => fileInput.current?.click()}>
          <UploadIcon />
          Upload
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            uploadFiles(Array.from(e.target.files ?? []))
            e.target.value = '' // so choosing the same file again still fires onChange
          }}
        />
      </header>

      {loading && <DocumentsSkeleton />}

      {loadError && (
        <p className="flash flash-error box-flash" role="alert">
          Couldn't load documents: {loadError}
        </p>
      )}

      {isEmpty && (
        <div className="blankslate">
          <FileIcon size={24} />
          <h3>No documents yet</h3>
          <p className="muted">
            Upload or drop .txt, .md or .pdf files (up to 5 MB, roughly 20 pages of text each). The assistant answers only from this workspace's
            documents.
          </p>
        </div>
      )}

      <ul className="box-list">
        {uploading.map((name) => (
          <li key={`uploading-${name}`} className="box-row">
            <span className="spinner spinner-sm" aria-hidden="true" />
            <div className="doc-main">
              <span className="doc-name">{name}</span>
              <span className="doc-meta muted">Uploading, chunking and embedding…</span>
            </div>
            <StatusLabel status="processing" />
          </li>
        ))}

        {documents.map((doc) => (
          <li key={doc.id} className="box-row">
            <FileIcon className="doc-icon" />
            <div className="doc-main">
              <span className="doc-name">{doc.filename}</span>
              <span className="doc-meta muted">
                {doc.status === 'ready' ? `${plural(doc.chunk_count, 'chunk')} · ` : ''}
                {formatDate(doc.created_at)}
              </span>
              {doc.status === 'failed' && doc.error && <span className="doc-error">{doc.error}</span>}
            </div>
            <StatusLabel status={doc.status} />
            <button
              type="button"
              className="btn-octicon btn-octicon-danger"
              aria-label={`Delete ${doc.filename}`}
              title="Delete"
              onClick={() => setToDelete(doc)}
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>

      {toDelete && (
        <DeleteDocumentDialog document={toDelete} onConfirm={deleteDocument} onClose={() => setToDelete(null)} />
      )}
    </section>
  )
}

// Only states that need attention get a badge. "ready" is the normal state, so no badge means ready.
const STATUS_LABELS: Record<Exclude<DocumentStatus, 'ready'>, { text: string; className: string }> = {
  processing: { text: 'Processing', className: 'label label-attention' },
  failed: { text: 'Failed', className: 'label label-danger' },
}

function StatusLabel({ status }: { status: DocumentStatus }) {
  if (status === 'ready') return null
  const { text, className } = STATUS_LABELS[status]
  return <span className={className}>{text}</span>
}

// Returns why a file can't be uploaded, or null if it's fine.
function checkFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) return 'only .txt, .md and .pdf files are supported'
  if (file.size > MAX_BYTES) return 'the file is larger than 5 MB'
  return null
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Placeholder rows shaped like document rows (icon, name, meta, status), so the
// panel keeps its height when the real list arrives.
const SKELETON_NAME_WIDTHS = ['45%', '60%', '35%']

function DocumentsSkeleton() {
  return (
    <ul className="box-list" aria-busy="true" aria-label="Loading documents">
      {SKELETON_NAME_WIDTHS.map((width, i) => (
        <li key={i} className="box-row" aria-hidden="true">
          <div className="skeleton doc-skeleton-icon" />
          <div className="doc-main doc-skeleton-text">
            <div className="skeleton doc-skeleton-name" style={{ width }} />
            <div className="skeleton doc-skeleton-meta" />
          </div>
          <div className="skeleton doc-skeleton-status" />
        </li>
      ))}
    </ul>
  )
}
