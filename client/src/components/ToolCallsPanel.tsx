import { useState } from 'react'
import { CheckCircleFillIcon, SyncIcon, ToolsIcon, XCircleFillIcon } from '@primer/octicons-react'
import { usePagedList } from '../lib/useList'
import type { ToolCallRow, ToolCallStatus } from '../types'
import LoadMore from './ui/LoadMore'
import RowsSkeleton from './ui/RowsSkeleton'

const FAILED_LABELS: Record<Exclude<ToolCallStatus, 'success'>, string> = {
  invalid_args: 'Invalid arguments',
  unknown_tool: 'Unknown tool',
  error: 'Error',
}

// Every tool call the model asked for in the active workspace, newest first and
// a page at a time, including failures (bad arguments, unknown tools, errors).
// "Failed only" asks the server for failures (?failed=true), so paging and the
// count cover all of them, not just the rows loaded so far. Each row expands to
// the full arguments and result. Dashboard renders it with key={workspaceId}.
export default function ToolCallsPanel({ workspaceId }: { workspaceId: string }) {
  const [failedOnly, setFailedOnly] = useState(false)
  const list = usePagedList<ToolCallRow>(
    `/workspaces/${workspaceId}/tool-calls${failedOnly ? '?failed=true' : ''}`,
  )
  const { rows: shown, total, loading, refreshing, error, refresh } = list

  return (
    <section className="box panel">
      <header className="box-header">
        <h2>Tool calls {!loading && <span className="counter">{total}</span>}</h2>
        <div className="box-header-actions">
          <label className="checkbox-label">
            <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} />
            Failed only
          </label>
          <button type="button" className="btn btn-sm" onClick={refresh} disabled={loading || refreshing}>
            <SyncIcon />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {loading && <RowsSkeleton label="Loading tool calls" />}

      {error && (
        <p className="flash flash-error box-flash" role="alert">
          Couldn't load tool calls: {error}
        </p>
      )}

      {!loading && !error && shown.length === 0 && (
        <div className="blankslate">
          <ToolsIcon size={24} />
          <h3>{failedOnly ? 'No failed tool calls' : 'No tool calls yet'}</h3>
          <p className="muted">Calls appear here when the assistant saves a task, lists tasks or posts to Discord.</p>
        </div>
      )}

      <ul className="box-list">
        {shown.map((call) => (
          <ToolCallItem key={call.id} call={call} />
        ))}
      </ul>

      <LoadMore
        shown={shown.length}
        total={total}
        noun={failedOnly ? 'failed calls' : 'calls'}
        hasMore={list.hasMore}
        loading={list.loadingMore}
        onLoadMore={list.loadMore}
      />
    </section>
  )
}

function ToolCallItem({ call }: { call: ToolCallRow }) {
  const ok = call.status === 'success'
  const args = JSON.stringify(call.args ?? {})

  return (
    <li className="box-row tool-row">
      {ok ? (
        <CheckCircleFillIcon className="tool-icon tool-icon-success" aria-label="Succeeded" />
      ) : (
        <XCircleFillIcon className="tool-icon tool-icon-failed" aria-label="Failed" />
      )}
      <div className="doc-main">
        <span className="tool-head">
          <code className="tool-name">{call.tool_name}</code>
          {call.status !== 'success' && <span className="label label-danger">{FAILED_LABELS[call.status]}</span>}
          {/* Pushed to the right; wraps under the name on a phone. */}
          <span className="tool-when doc-meta muted">
            {call.latency_ms !== null && `${call.latency_ms} ms · `}
            <time dateTime={call.created_at} title={new Date(call.created_at).toLocaleString()}>
              {formatDateTime(call.created_at)}
            </time>
          </span>
        </span>
        <span className="tool-args" title={args}>
          {args}
        </span>
        {call.error && <span className="doc-error tool-error">{call.error}</span>}
        {/* Native <details>: collapsed by default, opens on click or Enter/Space. */}
        <details className="tool-details">
          <summary>Details</summary>
          <h4>Arguments</h4>
          <pre>{JSON.stringify(call.args ?? {}, null, 2)}</pre>
          {ok && (
            <>
              <h4>Result</h4>
              <pre>{JSON.stringify(call.result ?? null, null, 2)}</pre>
            </>
          )}
        </details>
      </div>
    </li>
  )
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
