import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Toaster, toast } from 'sonner'
import { supabase } from './lib/supabase'
import AuthForm from './components/AuthForm'
import Dashboard from './components/Dashboard'

// Shows the login form without a signed-in user and the dashboard with one.
// onAuthStateChange is the only source: its first event (INITIAL_SESSION)
// carries the session saved in the browser, and later events follow sign-in
// and sign-out, in this tab and in other tabs.
export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Toasts from the old session (e.g. a failed request) don't belong on the login screen.
      if (event === 'SIGNED_OUT') toast.dismiss()

      // A token refresh (about once an hour) brings a new user object for the
      // same user. Keep the old one so the dashboard doesn't re-render for it.
      // http.ts reads the fresh token itself on every request.
      const next = session?.user ?? null
      setUser((prev) => (prev && next && prev.id === next.id && prev.updated_at === next.updated_at ? prev : next))
      setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <>
      {!ready ? (
        <div className="blankslate" aria-busy="true">
          <span className="spinner" aria-hidden="true" />
        </div>
      ) : user ? (
        // key: remount the dashboard (fresh state) when a different user signs in.
        <Dashboard key={user.id} user={user} />
      ) : (
        <AuthForm />
      )}
      {/* Toast notifications for the whole app (call toast.success / toast.error / toast.info anywhere).
          Top right, just under the 64px header. richColors: success green, error red, info blue, warning yellow. */}
      <Toaster theme="system" position="top-right" offset={{ top: 76, right: 16 }} richColors closeButton />
    </>
  )
}
