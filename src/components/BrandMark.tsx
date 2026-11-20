import { Link } from 'react-router-dom'

export const BRAND_NAME = 'Legit Luxury NaijaCars'

export function BrandMark({ to, size = 'nav' }: { to: string; size?: 'nav' | 'side' | 'login' }) {
  return (
    <Link className={`brand-mark ${size}`} to={to} aria-label={BRAND_NAME}>
      <img src="/brand/legit-logo.jpg" alt={BRAND_NAME} />
    </Link>
  )
}
