import { Link } from 'react-router-dom'
import { money, km, modelYear } from '../lib/format.ts'
import type { Vehicle } from '../lib/types.ts'
import { useApp } from '../store.tsx'
import { VehicleMedia } from './CarArt.tsx'
import { Badge } from './ui.tsx'

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const { compare, toggleCompare } = useApp()
  const selected = compare.includes(vehicle.id)
  return (
    <article className="vehicle-card">
      <VehicleMedia vehicle={vehicle} />
      <div className="vehicle-body">
        <div className="vehicle-meta">
          <Badge value="Available" />
          <span className="muted">
            {modelYear(vehicle.year)} · {vehicle.type}
          </span>
        </div>
        <h2>{vehicle.name}</h2>
        <div className="price">{money(vehicle.price)}</div>
        <p className="muted">
          {km(vehicle.mileage)} · {vehicle.condition} · {vehicle.location}
        </p>
        <div className="vehicle-actions">
          <Link className="btn primary" to={`/catalogue/${vehicle.id}`}>
            View vehicle
          </Link>
          <button className="btn ghost" type="button" onClick={() => toggleCompare(vehicle.id)}>
            {selected ? 'Selected' : 'Compare'}
          </button>
        </div>
      </div>
    </article>
  )
}
