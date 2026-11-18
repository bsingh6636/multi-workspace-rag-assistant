import { useState } from 'react'
import { CheckIcon, ChecklistIcon, SyncIcon, TrashIcon } from '@primer/octicons-react'
import { toast } from 'sonner'
import { deleteRequest, errorMessage, patchRequest } from '../lib/http'
import { usePagedList } from '../lib/useList'
import type { Task } from '../types'
import DeleteTaskDialog from './DeleteTaskDialog'
import LoadMore from './ui/LoadMore'
import RowsSkeleton from './ui/RowsSkeleton'

// Tasks in the active workspace, newest first, a page at a time. The assistant
// creates them (save_task) and can mark them done (complete_task); here you can
// tick them done or open again, and delete them (deleting is only possible
// here). Open tasks show by default; "Show done" lists all. Dashboard renders
// it with key={workspaceId}, so another workspace's tasks never show here.
// onChange (after done/not done, a delete or Refresh) makes the Dashboard
// refetch its tab counts.
export default function TasksPanel({ workspaceId, onChange }: { workspaceId: string; onChange: () => void }) {
  const [showDone, setShowDone] = useState(false)
  const base = `/workspaces/${workspaceId}/tasks`
  const list = usePagedList<Task>(showDone ? base : `${base}?done=false`)
  const { rows: tasks, setRows, total, setTotal, loading, refreshing, error, refresh } = list
  const [toDelete, setToDelete] = useState<Task | null>(null)
  const today = localDate()

  // Ticked tasks stay in the list (struck through) until the next refresh, so a
  // mis-click can be unticked straight away. Updated on screen first, put back
  // if the server says no.
  async function setDone(task: Task, done: boolean) {
    const doneAt = done ? new Date().toISOString() : null
    const replace = (doneAt: string | null) =>
      setRows((rows) => rows.map((t) => (t.id === task.id ? { ...t, done_at: doneAt } : t)))
    replace(doneAt)
    // In the "open" view the counter counts open tasks.
    if (!showDone) setTotal((n) => n + (done ? -1 : 1))
    try {
      const saved = await patchRequest<Task>(`${base}/${task.id}`, { done })
      replace(saved.done_at)
    } catch (e) {
      replace(task.done_at)
      if (!showDone) setTotal((n) => n + (done ? 1 : -1))
      toast.error(`Couldn't update “${task.title}”: ${errorMessage(e)}`)
    }
    onChange()
  }

  async function deleteTask() {
    if (!toDelete) return
    await deleteRequest(`${base}/${toDelete.id}`)
    setRows((rows) => rows.filter((t) => t.id !== toDelete.id))
    // An open task, or any task in the "all" view, was part of the count.
    if (showDone || !toDelete.done_at) setTotal((n) => Math.max(0, n - 1))
    onChange()
    toast.success(`Deleted “${toDelete.title}”`)
    setToDelete(null)
  }

  return (
    <section className="box panel">
      <header className="box-header">
        <h2>
          {showDone ? 'All tasks' : 'Open tasks'} {!loading && <span className="counter">{total}</span>}
        </h2>
        <div className="box-header-actions">
          <label className="checkbox-label">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show done
          </label>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              refresh()
              onChange()
            }}
            disabled={loading || refreshing}
          >
            <SyncIcon />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
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
          <h3>{showDone ? 'No tasks yet' : 'No open tasks'}</h3>
          <p className="muted">Ask the assistant in the chat, e.g. “Remind me to send the Falcon report on Friday”.</p>
        </div>
      )}

      <ul className="box-list">
        {tasks.map((task) => (
          <li key={task.id} className={task.done_at ? 'box-row task-done' : 'box-row'}>
            {/* A round "complete" button, not a square checkbox: a square box at
                the start of a row reads as "select this row". */}
            <button
              type="button"
              role="checkbox"
              className="task-check"
              aria-checked={task.done_at !== null}
              onClick={() => setDone(task, task.done_at === null)}
              aria-label={task.done_at ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
              title={task.done_at ? 'Mark as not done' : 'Mark as done'}
            >
              <CheckIcon size={10} />
            </button>
            <div className="doc-main">
              <span className="doc-name">{task.title}</span>
              <span className="doc-meta muted">
                {task.due_date ? `Due ${formatDueDate(task.due_date)} · ` : 'No due date · '}
                {task.done_at ? `Done ${formatDateTime(task.done_at)}` : `Saved ${formatDateTime(task.created_at)}`}
              </span>
            </div>
            {!task.done_at && <DueLabel dueDate={task.due_date} today={today} />}
            <button
              type="button"
              className="btn-octicon btn-octicon-danger"
              aria-label={`Delete ${task.title}`}
              title="Delete"
              onClick={() => setToDelete(task)}
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>

      <LoadMore
        shown={tasks.length}
        total={total}
        noun={showDone ? 'tasks' : 'open tasks'}
        hasMore={list.hasMore}
        loading={list.loadingMore}
        onLoadMore={list.loadMore}
      />

      {toDelete && <DeleteTaskDialog task={toDelete} onConfirm={deleteTask} onClose={() => setToDelete(null)} />}
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
