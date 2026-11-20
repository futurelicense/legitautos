import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BrandMark, BRAND_NAME } from './BrandMark.tsx'
import { canSee, navigation, PAGE_LABEL } from '../lib/access.ts'
import type { PageId } from '../lib/types.ts'

const ANALYTICAL = new Set<PageId>(['overview', 'inventory', 'crm', 'sales', 'invoices', 'finance', 'people', 'reports', 'agent', 'automations'])
import { visibleTasks } from '../lib/selectors.ts'
import { useApp } from '../store.tsx'

export function RequireAuth() {
  const { session } = useApp()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <AdminShell />
}

export function Gate({ page, children }: { page: PageId; children: ReactNode }) {
  const { session } = useApp()
  if (!session || !canSee(session.role, page)) {
    return (
      <section className="card denied">
        <h1>This workspace is outside your role</h1>
        <p>Your sign-in does not include this area. Go back to the overview, or sign in with another demo role.</p>
        <Link className="btn primary" to="/app/overview">
          Back to overview
        </Link>
      </section>
    )
  }
  return children
}

export function AdminShell() {
  const { session, logout, db } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const page = (location.pathname.split('/')[2] ?? 'overview') as PageId
  const label = PAGE_LABEL[page] ?? 'Workspace'
  const open = menuPath === location.pathname

  useEffect(() => {
    document.title = `${label} · ${BRAND_NAME}`
  }, [label])

  if (!session) return <Navigate to="/login" replace />
  const groups = navigation(session.role)
  const openTasks = visibleTasks(db, session).filter((task) => task.status === 'Open').length

  return (
    <div className="admin">
      <a className="skip" href="#main">
        Skip to content
      </a>
      {open && (
        <button className="scrim" type="button" aria-label="Close menu" onClick={() => setMenuPath(null)} />
      )}
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <BrandMark to="/app/overview" size="side" />
        <p className="side-kicker">{db.settings.business}</p>
        <div className="side-scroll">
          {groups.map((group) => (
            <div key={group.group}>
              <div className="nav-label">{group.group}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={`/app/${item.id}`}
                  className={({ isActive }) => (isActive ? 'nav-btn active' : 'nav-btn')}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
        <div className="side-foot">
          <Link className="btn ghost" to="/catalogue">
            Public catalogue
          </Link>
        </div>
      </aside>
      <div className="workspace">
        <header className={ANALYTICAL.has(page) ? 'topbar desk-bar' : 'topbar'}>
          <div className="top-title">
            <strong>{label}</strong>
            <span>{BRAND_NAME}</span>
          </div>
          <div className="actions">
            <button className="menu-btn btn ghost small" type="button" aria-expanded={open} onClick={() => setMenuPath(open ? null : location.pathname)}>
              Menu
            </button>
            <span className="badge muted">{session.role}</span>
            <Link className="btn ghost small" to="/app/tasks">
              {openTasks} open
            </Link>
            {session.role === 'CEO' && (
              <Link className="btn primary small" to="/app/agent">
                Legit AI
              </Link>
            )}
            <button
              className="btn ghost small"
              type="button"
              onClick={() => {
                navigate('/', { replace: true })
                window.setTimeout(() => logout(), 0)
              }}
            >
              Sign out
            </button>
          </div>
        </header>
        <div className={ANALYTICAL.has(page) ? 'content desk-content' : 'content'} id="main">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
