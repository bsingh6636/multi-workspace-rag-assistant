import { ChecklistIcon, SyncIcon } from '@primer/octicons-react'
import { useList } from '../lib/useList'
import type { Task } from '../types'
import RowsSkeleton from './ui/RowsSkeleton'

// Tasks in the active workspace, newest first. They're created by the assistant
// (the save_task tool), so this list is read-only. Dashboard renders it with
// key={workspaceId}, so another workspace's tasks never show here.
export default function TasksPanel({ workspaceId }: { workspaceId: string }) {
  const { rows: tasks, loading, refreshing, error, refresh } = useList<Task>(`/workspaces/${workspaceId}/tasks`)
  const today = localDate()

  return (
    <section className="box panel">
      <header className="box-header">
        <h2>Tasks {!loading && <span className="counter">{tasks.length}</span>}</h2>
        <button type="button" className="btn btn-sm" onClick={refresh} disabled={loading || refreshing}>
          <SyncIcon />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {loading && <RowsSkeleton label="Loading tasks" />}

      {error && (
        <p className="flash flash-error box-flash" role="alert">
          Couldn't load tasks: {error}
        </p>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="blankslate">
          <ChecklistIcon size={24} />
          <h3>No tasks yet</h3>
          <p className="muted">Ask the assistant in the chat, e.g. “Remind me to send the Falcon report on Friday”.</p>
        </div>
      )}

      <ul className="box-list">
        {tasks.map((task) => (
          <li key={task.id} className="box-row">
            <ChecklistIcon className="doc-icon" />
            <div className="doc-main">
              <span className="doc-name">{task.title}</span>
              <span className="doc-meta muted">
                {task.due_date ? `Due ${formatDueDate(task.due_date)} · ` : 'No due date · '}
                Saved {formatDateTime(task.created_at)}
              </span>
            </div>
            <DueLabel dueDate={task.due_date} today={today} />
          </li>
        ))}
      </ul>
    </section>
  )
}

// Only a task that needs attention gets a label. Dates are YYYY-MM-DD strings,
// so comparing them as text compares them as dates.
function DueLabel({ dueDate, today }: { dueDate: string | null; today: string }) {
  if (!dueDate || dueDate > today) return null
  if (dueDate === today) return <span className="label label-attention">Due today</span>
  return <span className="label label-danger">Overdue</span>
}

// Today in the browser's time zone, as YYYY-MM-DD (the chat sends the same zone
// with each message, so "tomorrow" in the chat and "today" here agree).
function localDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// "2026-11-20" → "Fri, 20 Nov 2026". Built from the parts: new Date('2026-11-20')
// would be UTC midnight, which shows as the 19th west of UTC.
function formatDueDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
