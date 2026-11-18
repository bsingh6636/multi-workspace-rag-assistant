import { supabase } from './supabase'

// The one sign-out used by the whole app (the account menu and the 401 handler in http.ts).
//
// scope 'local' removes the session from this browser first, then asks Supabase
// to revoke it. So signing out works even offline. (The default 'global' scope
// asks the server first and keeps the session if that request fails.)
//
// Several failed requests can ask to sign out at the same time; they all share
// the one sign-out already running.
let pending: Promise<void> | null = null

export function signOut(): Promise<void> {
  if (!pending) {
    pending = supabase.auth
      .signOut({ scope: 'local' })
      .then(() => undefined)
      .finally(() => {
        pending = null
      })
  }
  return pending
}
