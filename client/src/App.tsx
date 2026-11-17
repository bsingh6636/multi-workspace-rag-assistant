import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Toaster } from 'sonner'
import { supabase } from './lib/supabase'
import AuthForm from './components/AuthForm'
import Dashboard from './components/Dashboard'

// Shows the login form without a session and the dashboard with one.
// onAuthStateChange keeps this in sync with sign-in, sign-out and token refresh.
export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  return (
    <>
      {/* key: remount the dashboard (fresh state) when a different user signs in. */}
      {session ? <Dashboard key={session.user.id} user={session.user} /> : <AuthForm />}
      {/* Toast notifications for the whole app (call toast.success / toast.error anywhere). */}
      <Toaster theme="system" position="bottom-right" closeButton />
    </>
  )
}
