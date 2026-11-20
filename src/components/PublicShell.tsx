import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { BrandMark } from './BrandMark.tsx'
import { useApp } from '../store.tsx'

export function PublicShell() {
  const { session, compare, clearCompare } = useApp()
  const { pathname } = useLocation()
  const home = pathname === '/'
  const dark = home || pathname === '/catalogue'
  const [menu, setMenu] = useState(false)
  useEffect(() => setMenu(false), [pathname])
  const account = session ? (
    <Link to="/app/overview" onClick={() => setMenu(false)}>
      Workspace
    </Link>
  ) : (
    <Link to="/login" onClick={() => setMenu(false)}>
      Sign in
    </Link>
  )
  return (
    <div className={dark ? `pub dark${home ? ' home' : ''}` : 'pub'}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="pub-header">
        <BrandMark to="/" />
        <nav id="public-nav" className={menu ? 'nav-links open' : 'nav-links'} aria-label="Public">
          <Link to="/catalogue" aria-current={pathname === '/catalogue' ? 'page' : undefined} onClick={() => setMenu(false)}>
            Collection
          </Link>
          <Link to="/inquire/trade-in" onClick={() => setMenu(false)}>
            Trade-in
          </Link>
          <Link to="/inquire/finance" onClick={() => setMenu(false)}>
            Finance
          </Link>
          {dark ? account : session ? <Link className="nav-account" to="/app/overview">Workspace</Link> : <Link className="nav-account" to="/login">Sign in</Link>}
        </nav>
        {dark && (
          <div className="nav-end">
            {home && (
              <Link className="nav-floor" to="/catalogue">
                The collection
              </Link>
            )}
            <button
              className="nav-menu"
              type="button"
              aria-expanded={menu}
              aria-controls="public-nav"
              onClick={() => setMenu((open) => !open)}
            >
              {menu ? 'Close' : 'Menu'}
            </button>
          </div>
        )}
      </header>
      <main id="main">
        <Outlet />
      </main>
      {compare.length > 0 && (
        <div className="compare-bar">
          <span>{compare.length} selected</span>
          <Link className="btn light small" to="/compare">
            Compare
          </Link>
          <button className="btn ghost small" type="button" onClick={clearCompare}>
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
