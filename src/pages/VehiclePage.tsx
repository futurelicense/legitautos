import { Link, useParams } from 'react-router-dom'
import { VehicleMedia } from '../components/CarArt.tsx'
import { BRAND_NAME } from '../components/BrandMark.tsx'
import { useTitle } from '../components/ui.tsx'
import { km, modelYear, money } from '../lib/format.ts'
import { isPublic } from '../lib/selectors.ts'
import { useApp } from '../store.tsx'

const ACTIONS = [
  ['inspection', 'Book inspection'],
  ['quote', 'Request quote'],
  ['offer', 'Make offer'],
  ['reservation', 'Reservation inquiry'],
] as const

export function VehiclePage() {
  const { id = '' } = useParams()
  const { db, compare, toggleCompare } = useApp()
  const vehicle = db.vehicles.find((item) => item.id === id)
  useTitle(vehicle ? `${vehicle.name} · ${BRAND_NAME}` : `Vehicle · ${BRAND_NAME}`)
  if (!vehicle || !isPublic(vehicle)) {
    return (
      <div className="wrap">
        <section className="card narrow">
          <h1>This vehicle is not on the public list</h1>
          <p className="muted">It may be reserved, in inspection, or withdrawn. The catalogue only shows cars that are available.</p>
          <Link className="btn primary" to="/catalogue">
            Back to the collection
          </Link>
        </section>
      </div>
    )
  }
  return (
    <div className="wrap">
      <article className="detail">
        <VehicleMedia vehicle={vehicle} />
        <div className="card">
          <p className="eyebrow">Available · {vehicle.location}</p>
          <h1>{vehicle.name}</h1>
          <p className="price">{money(vehicle.price)}</p>
          <p>{vehicle.summary}</p>
          <div className="spec-grid">
            <div>
              <span>Year</span>
              <strong>{modelYear(vehicle.year)}</strong>
            </div>
            <div>
              <span>Body</span>
              <strong>{vehicle.type}</strong>
            </div>
            <div>
              <span>Mileage</span>
              <strong>{km(vehicle.mileage)}</strong>
            </div>
            <div>
              <span>Condition</span>
              <strong>{vehicle.condition}</strong>
            </div>
            <div>
              <span>Paint</span>
              <strong>
                <i className="swatch" style={{ background: vehicle.color }} /> Sample
              </strong>
            </div>
            <div>
              <span>Showroom</span>
              <strong>{vehicle.location}</strong>
            </div>
          </div>
          <p className="muted">Asking price only. Documents, VIN, and our cost are confirmed with the dealership, not published here.</p>
          <div className="actions" style={{ marginTop: 14 }}>
            {ACTIONS.map(([key, label]) => (
              <Link key={key} className="btn primary" to={`/inquire/${key}?vehicle=${vehicle.id}`}>
                {label}
              </Link>
            ))}
            <button className="btn ghost" type="button" onClick={() => toggleCompare(vehicle.id)}>
              {compare.includes(vehicle.id) ? 'Selected' : 'Compare'}
            </button>
          </div>
        </div>
      </article>
    </div>
  )
}
