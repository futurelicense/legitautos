import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrandMark, BRAND_NAME } from '../components/BrandMark.tsx'
import { Field, useTitle } from '../components/ui.tsx'
import { USERS } from '../lib/seed.ts'
import { useApp } from '../store.tsx'

export function LoginPage() {
  const { session, login } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  useTitle(`Sign in · ${BRAND_NAME}`)
  if (session) return <Navigate to="/app/overview" replace />

  function enter(email: string, password: string) {
    const failure = login(email, password)
    if (failure) {
      setError(failure)
      return
    }
    const from = (location.state as { from?: string } | null)?.from
    navigate(from && from.startsWith('/app') ? from : '/app/overview')
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    enter(String(data.get('email') ?? ''), String(data.get('password') ?? ''))
  }

  return (
    <div className="login">
      <section className="login-brand">
        <div>
          <BrandMark to="/" size="login" />
          <h1>The dealership, in one workspace.</h1>
          <p>Inventory, customers, reservations, and cash movement. The public catalogue is a separate door.</p>
        </div>
        <p>Demo access for {BRAND_NAME}. This is not production authentication.</p>
      </section>
      <section className="login-panel">
        <h2>Sign in</h2>
        <p className="muted">Shared demo password: legit-demo</p>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            {error && <div className="form-error">{error}</div>}
            <Field label="Email">
              <input name="email" type="email" autoComplete="username" required placeholder="ceo@legit.auto" />
            </Field>
            <Field label="Password">
              <input name="password" type="password" autoComplete="current-password" required placeholder="legit-demo" />
            </Field>
          </div>
          <button className="btn primary" type="submit">
            Enter workspace
          </button>
        </form>
        <div className="demo-grid" style={{ marginTop: 18 }}>
          {USERS.map((user) => (
            <button key={user.id} className="demo-card" type="button" onClick={() => enter(user.email, user.password)}>
              <strong>{user.name}</strong>
              <span>{user.role}</span>
              <small>{user.email}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
