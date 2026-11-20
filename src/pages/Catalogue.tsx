import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND_NAME } from '../components/BrandMark.tsx'
import { useTitle } from '../components/ui.tsx'
import { km, koboFromNaira, modelYear, money } from '../lib/format.ts'
import { publicVehicles } from '../lib/selectors.ts'
import type { BodyType } from '../lib/types.ts'
import { BODY_TYPES } from '../lib/types.ts'
import { useApp } from '../store.tsx'

const PRICE_CAPS = [
  { id: 'any', label: 'Any price', cap: 0 },
  { id: '70', label: 'Up to ₦70m', cap: koboFromNaira(70_000_000) },
  { id: '120', label: 'Up to ₦120m', cap: koboFromNaira(120_000_000) },
  { id: '220', label: 'Up to ₦220m', cap: koboFromNaira(220_000_000) },
] as const

export function CataloguePage() {
  const { db, compare, toggleCompare } = useApp()
  useTitle(`Collection · ${BRAND_NAME}`)
  const listed = publicVehicles(db)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'All' | BodyType>('All')
  const [max, setMax] = useState<(typeof PRICE_CAPS)[number]['id']>('any')
  const [sort, setSort] = useState('featured')

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const cap = PRICE_CAPS.find((item) => item.id === max)?.cap ?? 0
    const rows = listed.filter((vehicle) => {
      const text = `${vehicle.name} ${vehicle.year} ${vehicle.type} ${vehicle.location}`.toLowerCase()
      if (needle && !text.includes(needle)) return false
      if (type !== 'All' && vehicle.type !== type) return false
      if (cap > 0 && (vehicle.price <= 0 || vehicle.price > cap)) return false
      return true
    })
    if (sort === 'featured') rows.sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)))
    if (sort === 'price-asc') rows.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') rows.sort((a, b) => b.price - a.price)
    if (sort === 'year') rows.sort((a, b) => b.year - a.year)
    return rows
  }, [listed, query, type, max, sort])

  const filtering = query.trim() !== '' || type !== 'All' || max !== 'any'

  return (
    <div className="lot">
      <header className="lot-head">
        <p className="eyebrow">Lekki showroom</p>
        <h1>The collection</h1>
        <p>
          {listed.length} {listed.length === 1 ? 'car is' : 'cars are'} listed. The figure on each one is the asking price on record.
        </p>
      </header>

      <div className="lot-tools">
        <input
          className="lot-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search make or model"
          aria-label="Search the collection"
        />
        <div className="lot-chips" role="group" aria-label="Body type">
          <button type="button" className={type === 'All' ? 'on' : ''} onClick={() => setType('All')}>
            All
          </button>
          {BODY_TYPES.map((item) => (
            <button key={item} type="button" className={type === item ? 'on' : ''} onClick={() => setType(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="lot-row">
          <div className="lot-chips" role="group" aria-label="Maximum price">
            {PRICE_CAPS.map((item) => (
              <button key={item.id} type="button" className={max === item.id ? 'on' : ''} onClick={() => setMax(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort">
            <option value="featured">Photographed first</option>
            <option value="price-asc">Price, low to high</option>
            <option value="price-desc">Price, high to low</option>
            <option value="year">Newest year</option>
          </select>
        </div>
      </div>

      <p className="lot-count">
        {filtering ? `${list.length} of ${listed.length}` : `${list.length} on the floor`}
      </p>

      {list.length === 0 ? (
        <div className="lot-empty">
          <p>No listed car matches that.</p>
          <button
            className="btn gold"
            type="button"
            onClick={() => {
              setQuery('')
              setType('All')
              setMax('any')
            }}
          >
            Clear the search
          </button>
        </div>
      ) : (
        <div className="lot-grid">
          {list.map((vehicle) => (
            <article className="lot-card" key={vehicle.id}>
              <Link to={`/catalogue/${vehicle.id}`}>
                {vehicle.image ? <img src={vehicle.image} alt="" /> : <div className="lot-empty-photo">Photograph not on file</div>}
                <div>
                  <h2>{vehicle.name}</h2>
                  <p>
                    {modelYear(vehicle.year)} · {vehicle.type}
                    <br />
                    {km(vehicle.mileage)} · {vehicle.location}
                  </p>
                  <b>{vehicle.price > 0 ? money(vehicle.price) : 'Price not stated'}</b>
                </div>
              </Link>
              <button className={compare.includes(vehicle.id) ? 'on' : ''} type="button" onClick={() => toggleCompare(vehicle.id)}>
                {compare.includes(vehicle.id) ? 'Selected' : 'Compare'}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
