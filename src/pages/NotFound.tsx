import { Link } from 'react-router-dom'
import { BRAND_NAME } from '../components/BrandMark.tsx'
import { useTitle } from '../components/ui.tsx'

export function NotFoundPage() {
  useTitle(`Not found · ${BRAND_NAME}`)
  return (
    <div className="wrap">
      <section className="card narrow">
        <h1>That page is not here</h1>
        <p className="muted">The catalogue and the staff workspace are the two doors into {BRAND_NAME}.</p>
        <div className="actions">
          <Link className="btn primary" to="/">
            Public site
          </Link>
          <Link className="btn ghost" to="/login">
            Staff sign in
          </Link>
        </div>
      </section>
    </div>
  )
}
