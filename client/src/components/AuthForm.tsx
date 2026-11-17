import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'

// Email + password sign-in and sign-up through Supabase Auth, plus Google OAuth.
// On success supabase-js stores the session, and App.tsx switches to the dashboard.
export default function AuthForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      // No session means Supabase wants the email confirmed first.
      else if (!data.session) setInfo('Check your email to confirm your account, then sign in.')
    }

    setBusy(false)
  }

  // Redirects to Google, then back to this page. supabase-js reads the session
  // from the return URL, and onAuthStateChange in App.tsx shows the dashboard.
  async function signInWithGoogle() {
    setError(null)
    setInfo(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    // On success the browser is already leaving the page, so only errors need handling.
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  // Switching modes clears messages so a sign-in error doesn't linger on the sign-up form.
  function switchMode() {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setError(null)
    setInfo(null)
  }

  const isSignIn = mode === 'signin'

  return (
    <div className="auth">
      <div className="auth-inner">
        <header className="auth-head">
          <div className="auth-mark" aria-hidden="true">W</div>
          <h1>{isSignIn ? 'Sign in to Workspace Assistant' : 'Create your account'}</h1>
        </header>

        <div className="auth-card">
          {error && <p className="flash flash-error" role="alert">{error}</p>}
          {info && <p className="flash flash-info" role="status">{info}</p>}

          <form onSubmit={handleSubmit}>
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />

            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
            />
            {!isSignIn && <p className="auth-hint muted">At least 6 characters.</p>}

            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : isSignIn ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="auth-divider" role="separator">or</div>

          <button type="button" className="btn auth-oauth" onClick={signInWithGoogle} disabled={busy}>
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <p className="auth-alt">
          {isSignIn ? 'New to Workspace Assistant?' : 'Already have an account?'}{' '}
          <button type="button" className="btn-link" onClick={switchMode}>
            {isSignIn ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}

// Google's multicolour "G", sized to sit next to the button text.
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
