import { useState, type FormEvent } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { BRAND_NAME } from '../components/BrandMark.tsx'
import { Field, saved, useTitle } from '../components/ui.tsx'
import { INQUIRIES, type InquiryKind } from '../lib/types.ts'
import { isPublic } from '../lib/selectors.ts'
import { useApp } from '../store.tsx'

function isKind(value: string): value is InquiryKind {
  return value in INQUIRIES
}

export function InquirePage() {
  const { kind = '' } = useParams()
  const [params] = useSearchParams()
  const { db, inquiry, notify } = useApp()
  const [done, setDone] = useState(false)
  const title = isKind(kind) ? INQUIRIES[kind] : 'Contact the dealership'
  useTitle(`${title} · ${BRAND_NAME}`)
  if (!isKind(kind)) return <Navigate to="/inquire/contact" replace />
  const requested = params.get('vehicle') ?? ''
  const vehicle = db.vehicles.find((item) => item.id === requested)
  const listed = vehicle && isPublic(vehicle) ? vehicle : undefined

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const error = inquiry({
      name: String(data.get('name') ?? ''),
      contact: String(data.get('contact') ?? ''),
      note: String(data.get('note') ?? ''),
      vehicleId: listed?.id ?? '',
      kind: title,
    })
    if (saved(error, notify, 'Enquiry received')) setDone(true)
  }

  if (done) {
    return (
      <div className="wrap">
        <section className="card narrow">
          <h1>We have your request.</h1>
          <p>A consultant will follow up on the contact you gave us. This demo keeps the enquiry in the dealership workspace on this browser.</p>
          <Link className="btn primary" to="/catalogue">
            Back to the collection
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="wrap">
      <section className="card narrow">
        <p className="eyebrow">{BRAND_NAME}</p>
        <h1>{title}</h1>
        <p className="muted">
          {listed
            ? `About the ${listed.name}. We will confirm specification before anything is reserved.`
            : 'Tell us what you need. Private stock details are not shown here.'}
        </p>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <Field label="Full name">
              <input name="name" required autoComplete="name" />
            </Field>
            <Field label="Phone or email">
              <input name="contact" required autoComplete="email" />
            </Field>
            <Field label="Your request">
              <textarea name="note" required placeholder={listed ? `I am interested in the ${listed.name}` : 'Preferred vehicle, budget, or question'} />
            </Field>
          </div>
          <button className="btn primary" type="submit">
            Send enquiry
          </button>
        </form>
      </section>
    </div>
  )
}
