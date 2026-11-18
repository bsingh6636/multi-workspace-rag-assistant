import type { User } from '@supabase/supabase-js'
import { SignOutIcon } from '@primer/octicons-react'
import { supabase } from '../lib/supabase'
import Popover from './ui/Popover'

// Avatar button in the top-right. Opens a menu with an account card (picture,
// name, email) and Sign out.
export default function UserMenu({ user }: { user: User }) {
  const email = user.email ?? ''
  // Google sign-in fills these; email/password accounts have neither.
  const name: string | undefined = user.user_metadata?.full_name ?? user.user_metadata?.name
  const avatarUrl: string | undefined = user.user_metadata?.avatar_url

  return (
    <Popover
      align="right"
      buttonClassName="avatar-button"
      buttonLabel="Open account menu"
      button={<Avatar url={avatarUrl} letter={(name || email).charAt(0)} />}
    >
      {() => (
        <div className="menu-panel" role="menu">
          <div className="menu-account">
            <Avatar url={avatarUrl} letter={(name || email).charAt(0)} className="avatar-lg" />
            <div className="menu-account-text">
              <strong title={name || email}>{name || email}</strong>
              {name && <span title={email}>{email}</span>}
            </div>
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

// The Google picture when there is one, otherwise the first letter.
function Avatar({ url, letter, className = '' }: { url?: string; letter: string; className?: string }) {
  if (url) return <img className={`avatar ${className}`} src={url} alt="" referrerPolicy="no-referrer" />
  return <span className={`avatar avatar-letter ${className}`}>{letter.toUpperCase() || '?'}</span>
}
