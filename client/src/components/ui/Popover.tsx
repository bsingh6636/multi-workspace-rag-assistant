import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  /** What the trigger button shows. */
  button: ReactNode
  buttonClassName?: string
  /** Accessible name for the trigger when it has no visible text (icon only). */
  buttonLabel?: string
  /** Which edge of the trigger the panel lines up with. */
  align?: 'left' | 'right'
  /** Panel content. Gets `close` so menu items can close the popover. */
  children: (close: () => void) => ReactNode
}

// A button that opens a floating panel under it (menus, the workspace switcher).
// Closes on a click outside, on Esc, or when an item calls close().
export default function Popover({ button, buttonClassName = 'btn', buttonLabel, align = 'left', children }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="popover-root" ref={rootRef}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={buttonLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {button}
      </button>
      {open && <div className={`popover popover-${align}`}>{children(() => setOpen(false))}</div>}
    </div>
  )
}
