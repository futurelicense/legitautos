import { Link } from 'react-router-dom'
import { BRAND_NAME } from '../components/BrandMark.tsx'
import { useTitle } from '../components/ui.tsx'
import { km, modelYear, money } from '../lib/format.ts'
import { isPublic } from '../lib/selectors.ts'
import { useApp } from '../store.tsx'

export function ComparePage() {
  const { db, compare, toggleCompare } = useApp()
  useTitle(`Compare · ${BRAND_NAME}`)
  const vehicles = compare
    .map((id) => db.vehicles.find((vehicle) => vehicle.id === id))
    .filter((vehicle) => vehicle && isPublic(vehicle))
  return (
    <div className="wrap" style={{ padding: '28px 0 48px' }}>
      <h1>Compare</h1>
      <p className="muted">Up to three listed vehicles. Private cost and VIN stay off this page.</p>
      {vehicles.length === 0 ? (
        <section className="card narrow">
          <h2>Select vehicles to compare</h2>
          <p className="muted">Choose them from the collection.</p>
          <Link className="btn primary" to="/catalogue">
            Browse the collection
          </Link>
        </section>
      ) : (
        <div className="card table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                {['Vehicle', 'Year', 'Body', 'Mileage', 'Condition', 'Location', 'Price', ''].map((header) => (
                  <th key={header || 'remove'}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) =>
                vehicle ? (
                  <tr key={vehicle.id}>
                    <td>
                      <Link to={`/catalogue/${vehicle.id}`}>{vehicle.name}</Link>
                    </td>
                    <td>{modelYear(vehicle.year)}</td>
                    <td>{vehicle.type}</td>
                    <td>{km(vehicle.mileage)}</td>
                    <td>{vehicle.condition}</td>
                    <td>{vehicle.location}</td>
                    <td>{money(vehicle.price)}</td>
                    <td>
                      <button className="btn small ghost" type="button" onClick={() => toggleCompare(vehicle.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
