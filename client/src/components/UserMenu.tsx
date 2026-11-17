import type { User } from '@supabase/supabase-js'
import { SignOutIcon } from '@primer/octicons-react'
import { supabase } from '../lib/supabase'
import Popover from './ui/Popover'

// Avatar button in the top-right. Shows the Google picture when there is one,
// otherwise the first letter of the email. Opens a menu with Sign out.
export default function UserMenu({ user }: { user: User }) {
  const email = user.email ?? ''
  const avatarUrl: string | undefined = user.user_metadata?.avatar_url

  return (
    <Popover
      align="right"
      buttonClassName="avatar-button"
      buttonLabel="Open account menu"
      button={
        avatarUrl ? (
          <img className="avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar avatar-letter">{email.charAt(0).toUpperCase() || '?'}</span>
        )
      }
    >
      {() => (
        <div className="menu-panel" role="menu">
          <div className="menu-header">
            Signed in as <strong>{email}</strong>
          </div>
          <div className="menu-divider" role="separator" />
          <button type="button" role="menuitem" className="menu-item" onClick={() => supabase.auth.signOut()}>
            <span className="menu-check">
              <SignOutIcon />
            </span>
            <span className="menu-text">Sign out</span>
          </button>
        </div>
      )}
    </Popover>
  )
}
