import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTitle } from '../components/ui.tsx'
import { modelYear, money } from '../lib/format.ts'
import { publicVehicles } from '../lib/selectors.ts'
import type { Vehicle } from '../lib/types.ts'
import { useApp } from '../store.tsx'

function lineFor(vehicle: Vehicle) {
  return `${modelYear(vehicle.year)} · ${vehicle.type}`
}

export function LandingPage() {
  const { db } = useApp()
  useTitle(db.settings.business)
  const listed = [...publicVehicles(db)].sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)))
  const photographed = listed.filter((vehicle) => vehicle.image)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = photographed.length
  const active = photographed[count === 0 ? 0 : index % count]
  const behind = count > 1 ? photographed[(index + 1) % count] : undefined

  useEffect(() => {
    if (count < 2 || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % count), 7000)
    return () => window.clearInterval(timer)
  }, [count, paused])

  function step(direction: number) {
    if (count < 2) return
    setPaused(true)
    setIndex((value) => (value + direction + count) % count)
  }

  return (
    <div className="floor">
      <section className="floor-hero" aria-label="Cars on the floor">
        <div className="floor-copy">
          <p className="eyebrow">Lekki showroom</p>
          <h1>
            Choose the car.
            <em>Then see it in person.</em>
          </h1>
          <p>
            {active
              ? `${active.name} is listed at ${active.price > 0 ? money(active.price) : 'a price still to be stated'}. The photograph is from the dealership. Documents are confirmed at Lekki, not on this page.`
              : 'The public floor is being refreshed. A sourcing request is the way to describe a car that is not listed yet.'}
          </p>
          <div className="floor-actions">
            {active ? (
              <Link className="btn gold" to={`/catalogue/${active.id}`}>
                See this car
              </Link>
            ) : (
              <Link className="btn gold" to="/inquire/sourcing">
                Request a vehicle
              </Link>
            )}
          </div>
          {count > 1 && (
            <div className="floor-switch">
              <button type="button" aria-label="Previous car" onClick={() => step(-1)}>
                ←
              </button>
              <span>
                {String((index % count) + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
              </span>
              <button type="button" aria-label="Next car" onClick={() => step(1)}>
                →
              </button>
            </div>
          )}
        </div>

        {active && (
          <div className="floor-stage">
            {behind && (
              <img className="floor-photo back" src={behind.image} alt="" />
            )}
            <img className="floor-photo front" src={active.image} alt={active.name} />
            <div className="floor-caption">
              <div>
                <strong>{active.name}</strong>
                <span>
                  {lineFor(active)} · {active.location}
                </span>
              </div>
              <b>{active.price > 0 ? money(active.price) : 'Price not stated'}</b>
            </div>
          </div>
        )}
      </section>

      <section className="floor-proof" aria-label="What this page confirms">
        <article>
          <ProofIcon name="camera" />
          <strong>{photographed.length} photographed</strong>
          <span>Pictures from the dealership posts, where we have them.</span>
        </article>
        <article>
          <ProofIcon name="price" />
          <strong>The figure on the car</strong>
          <span>The asking price is the one recorded for that listing.</span>
        </article>
        <article>
          <ProofIcon name="pin" />
          <strong>Viewed in Lekki</strong>
          <span>Come to the showroom before a reservation is agreed.</span>
        </article>
        <article>
          <ProofIcon name="key" />
          <strong>Handover waits</strong>
          <span>Collection follows a clear, verified balance.</span>
        </article>
      </section>

      <section className="floor-fleet" id="floor" aria-labelledby="floor-title">
        <div className="floor-fleet-head">
          <div>
            <p className="eyebrow">Our floor</p>
            <h2 id="floor-title">Listed. Photographed. In Lagos.</h2>
          </div>
          <Link to="/catalogue">View the collection →</Link>
        </div>
        {listed.length === 0 ? (
          <p>Nothing is listed right now.</p>
        ) : (
          <div className="floor-rail">
            {listed.map((vehicle) => (
              <Link className="floor-card" key={vehicle.id} to={`/catalogue/${vehicle.id}`}>
                {vehicle.image ? (
                  <img src={vehicle.image} alt="" />
                ) : (
                  <div className="floor-card-empty">Photograph not on file</div>
                )}
                <div>
                  <h3>{vehicle.name}</h3>
                  <p>
                    {lineFor(vehicle)}
                    <br />
                    {vehicle.price > 0 ? money(vehicle.price) : 'Price not stated'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="floor-ways">
        <article>
          <b>01</b>
          <h3>Trade in</h3>
          <p>Tell us what you drive. A consultant follows up. Nothing is valued on this page.</p>
          <Link to="/inquire/trade-in">Start a trade-in</Link>
        </article>
        <article>
          <b>02</b>
          <h3>Financing</h3>
          <p>Send an enquiry. Lending decisions stay with a finance partner.</p>
          <Link to="/inquire/finance">Ask about financing</Link>
        </article>
        <article>
          <b>03</b>
          <h3>Sourcing</h3>
          <p>If it is not on the floor, describe the vehicle and we will look.</p>
          <Link to="/inquire/sourcing">Request a vehicle</Link>
        </article>
        <article>
          <b>04</b>
          <h3>In person</h3>
          <p>Inspect the car and confirm documents at the Lekki showroom.</p>
          <Link to="/catalogue">Browse listed stock</Link>
        </article>
      </section>

      <footer className="floor-footer">
        <div>
          <strong>{db.settings.business}</strong>
          <p>Lekki, Lagos · The sample catalogue lives in this browser.</p>
        </div>
        <div className="floor-footer-links">
          <Link to="/catalogue">Collection</Link>
          <Link to="/login">Staff sign in</Link>
        </div>
      </footer>
    </div>
  )
}

function ProofIcon({ name }: { name: 'camera' | 'price' | 'pin' | 'key' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {name === 'camera' && (
        <>
          <rect {...common} x="4" y="9" width="24" height="16" rx="3" />
          <circle {...common} cx="16" cy="17" r="4" />
          <path {...common} d="M12 9l1.5-3h5L20 9" />
        </>
      )}
      {name === 'price' && (
        <>
          <circle {...common} cx="16" cy="16" r="11" />
          <path {...common} d="M16 9v14M12.5 12.5h5a2.5 2.5 0 0 1 0 5h-5a2.5 2.5 0 0 0 0 5H19" />
        </>
      )}
      {name === 'pin' && (
        <>
          <path {...common} d="M16 28s8-7.2 8-13a8 8 0 1 0-16 0c0 5.8 8 13 8 13z" />
          <circle {...common} cx="16" cy="15" r="2.5" />
        </>
      )}
      {name === 'key' && (
        <>
          <circle {...common} cx="11" cy="15" r="5" />
          <path {...common} d="M15.5 15H28l-2 2.5 2 2.5h-3" />
        </>
      )}
    </svg>
  )
}
