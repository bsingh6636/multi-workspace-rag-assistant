// Grey placeholder rows (icon, a name line, a meta line, a pill on the right)
// shown while a panel's list loads, so the panel keeps its height and the
// empty state doesn't flash first.
const NAME_WIDTHS = ['45%', '60%', '35%']

export default function RowsSkeleton({ label }: { label: string }) {
  return (
    <ul className="box-list" aria-busy="true" aria-label={label}>
      {NAME_WIDTHS.map((width, i) => (
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
