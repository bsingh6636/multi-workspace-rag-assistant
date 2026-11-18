type Props = {
  shown: number
  total: number
  noun: string // plural, e.g. "tasks"
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}

// Footer under a paged list: "Showing 25 of 60 tasks" and a Load more button.
// Hidden when everything is already on screen.
export default function LoadMore({ shown, total, noun, hasMore, loading, onLoadMore }: Props) {
  if (!hasMore) return null
  return (
    <footer className="box-footer load-more">
      <span className="muted">
        Showing {shown} of {Math.max(total, shown)} {noun}
      </span>
      <button type="button" className="btn btn-sm" onClick={onLoadMore} disabled={loading}>
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </footer>
  )
}
