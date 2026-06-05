import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setErr('')
    setMsg('')
    if (!email || !pw) return
    setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase!.auth.signInWithPassword({ email, password: pw })
        if (error) throw error
      } else {
        const { data, error } = await supabase!.auth.signUp({ email, password: pw })
        if (error) throw error
        if (!data.session) setMsg('Account created. Check your email to confirm, then sign in.')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <svg width="20" height="18" viewBox="0 0 22 20">
            <path d="M11 0 22 20 0 20Z" />
          </svg>
          <h1>Flowdeck</h1>
        </div>
        <div className="sub">{mode === 'in' ? 'Sign in to your workspace.' : 'Create an account.'}</div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="••••••••"
          />
        </div>
        {err && <div className="auth-err">{err}</div>}
        {msg && <div className="auth-err" style={{ color: 'var(--grn)' }}>{msg}</div>}
        <div style={{ marginTop: 18 }}>
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy} onClick={submit}>
            {busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
        </div>
        <div className="auth-toggle">
          {mode === 'in' ? "No account? " : 'Have an account? '}
          <button
            onClick={() => {
              setMode(mode === 'in' ? 'up' : 'in')
              setErr('')
              setMsg('')
            }}
          >
            {mode === 'in' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
