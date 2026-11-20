import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { can } from '../../lib/access.ts'
import { BarList, Lens, LensGrid, StackBar } from '../../components/Insight.tsx'
import { hay, koboFromNaira, modelYear, money, moneyCompact, nairaFromKobo, stockAge, todayISO } from '../../lib/format.ts'
import { ageBand, askingSum, priceBand, tally } from '../../lib/picture.ts'
import { Badge, DataTable, Field, Modal, PageHead, saved } from '../../components/ui.tsx'
import { type VehicleInput } from '../../lib/mutations.ts'
import { BODY_TYPES, CONDITIONS, MANUAL_STATUSES, type Vehicle } from '../../lib/types.ts'
import { useApp } from '../../store.tsx'

const MODEL_YEAR = new Date().getFullYear()

export function InventoryPage() {
  const { db, session, saveVehicle, publishVehicle, approvePrice, notify } = useApp()
  const [params] = useSearchParams()
  const focus = params.get('vehicle')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [editing, setEditing] = useState<string | null>(focus && db.vehicles.some((vehicle) => vehicle.id === focus) ? focus : null)
  if (!session) return null
  const rows = db.vehicles.filter((vehicle) => (filter === 'All' || vehicle.status === filter) && hay(vehicle, query))
  const current = editing && editing !== 'new' ? db.vehicles.find((vehicle) => vehicle.id === editing) : undefined
  const today = todayISO()
  const companyAsk = askingSum(db.vehicles.filter((vehicle) => vehicle.owner === 'Company'))
  const consignAsk = askingSum(db.vehicles.filter((vehicle) => vehicle.owner === 'Consignment'))
  const ageLabels = ['0–30 days', '31–60 days', `61–${db.settings.threshold} days`, `Past ${db.settings.threshold} days`]

  return (
    <>
      <PageHead
        title="Vehicle inventory"
        lede="Stock, ownership, price approval, and what the public catalogue is allowed to show."
        action={
          can(session.role, 'vehicle.write') ? (
            <button className="btn primary" type="button" onClick={() => setEditing('new')}>
              Register vehicle
            </button>
          ) : undefined
        }
      />
      <LensGrid>
        <Lens title="Where the stock sits" note="Select a status to narrow the register.">
          <BarList
            active={filter === 'All' ? '' : filter}
            onPick={(id) => setFilter(id || 'All')}
            items={tally(db.vehicles.map((vehicle) => vehicle.status))
              .sort((a, b) => b.value - a.value)
              .map((item) => ({ ...item, display: String(item.value) }))}
          />
        </Lens>
        <Lens title="Days on the floor" note={`A review is due after ${db.settings.threshold} days.`}>
          <BarList
            items={ageLabels.map((label) => {
              const value = db.vehicles.filter((vehicle) => ageBand(stockAge(vehicle, today), db.settings.threshold) === label).length
              return { id: label, label, value, display: String(value) }
            })}
          />
        </Lens>
        <Lens title="Asking price on record" note="A blank price stays out of the naira total. Consignment asking prices are not dealership revenue.">
          <StackBar
            parts={[
              { id: 'company', label: 'Company holding', value: companyAsk, display: moneyCompact(companyAsk) },
              { id: 'consign', label: 'Consignment', value: consignAsk, display: moneyCompact(consignAsk) },
            ]}
          />
          <BarList items={tally(db.vehicles.map((vehicle) => priceBand(vehicle.price))).map((item) => ({ ...item, display: String(item.value) }))} />
        </Lens>
      </LensGrid>
      <div className="toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stock" aria-label="Search stock" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Status">
          {['All', 'Draft', 'Inspection', 'Ready', 'Available', 'Hold', 'Reserved', 'Sold', 'Withdrawn'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <DataTable
        headers={['Vehicle', 'VIN', 'Year', 'Ownership', 'Asking price', 'Age', 'Status', 'Listing', 'Action']}
        rows={rows.map((vehicle) => [
          vehicle.image ? (
            <span key="name" className="stock-name">
              <img src={vehicle.image} alt="" />
              {vehicle.name}
            </span>
          ) : (
            vehicle.name
          ),
          vehicle.vin,
          modelYear(vehicle.year),
          vehicle.owner,
          <span key="price">
            {vehicle.price > 0 ? money(vehicle.price) : 'Price not stated'}
            {!vehicle.priceApproved && (
              <>
                {' '}
                <Badge value="Pending" />
              </>
            )}
          </span>,
          <span key="age" title={vehicle.ageFrom === 'availability' ? 'From the availability date' : 'From the acquisition date'}>
            {stockAge(vehicle, todayISO())}d
          </span>,
          <Badge key="status" value={vehicle.status} />,
          <Badge key="list" value={vehicle.published ? 'Listed' : 'Hidden'} />,
          <div className="actions" key="actions">
            {can(session.role, 'vehicle.write') && (
              <button className="btn small" type="button" onClick={() => setEditing(vehicle.id)}>
                Edit
              </button>
            )}
            {can(session.role, 'vehicle.approvePrice') && !vehicle.priceApproved && vehicle.status !== 'Sold' && (
              <button
                className="btn small"
                type="button"
                onClick={() => {
                  const error = approvePrice(vehicle.id)
                  saved(error, notify, 'Price approved')
                }}
              >
                Approve price
              </button>
            )}
            {can(session.role, 'vehicle.publish') && vehicle.status === 'Available' && (
              <button
                className="btn small ghost"
                type="button"
                onClick={() => {
                  const error = publishVehicle(vehicle.id)
                  saved(error, notify, vehicle.published ? 'Listing hidden' : 'Listing published')
                }}
              >
                {vehicle.published ? 'Hide' : 'Publish'}
              </button>
            )}
          </div>,
        ])}
      />
      {editing && (editing === 'new' || current) && (
        <VehicleForm
          key={editing}
          vehicle={current}
          onClose={() => setEditing(null)}
          onSave={(input, id) => {
            const error = saveVehicle(input, id)
            if (saved(error, notify, 'Vehicle saved')) setEditing(null)
          }}
        />
      )}
    </>
  )
}

function VehicleForm({
  vehicle,
  onClose,
  onSave,
}: {
  vehicle?: Vehicle
  onClose: () => void
  onSave: (input: VehicleInput, id?: string) => void
}) {
  const locked = vehicle?.status === 'Reserved' || vehicle?.status === 'Sold'
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSave(
      {
        name: String(data.get('name') ?? ''),
        year: Number(data.get('year')),
        type: String(data.get('type')) as Vehicle['type'],
        vin: String(data.get('vin') ?? ''),
        mileage: Number(data.get('mileage')),
        condition: String(data.get('condition')) as Vehicle['condition'],
        location: String(data.get('location') ?? ''),
        color: String(data.get('color') ?? '#52645d'),
        cost: koboFromNaira(Number(data.get('cost'))),
        price: koboFromNaira(Number(data.get('price'))),
        owner: String(data.get('owner')) as Vehicle['owner'],
        status: String(data.get('status')) as Vehicle['status'],
        acquiredOn: String(data.get('acquiredOn') ?? ''),
        availableOn: String(data.get('availableOn') ?? ''),
        ageFrom: String(data.get('ageFrom')) as Vehicle['ageFrom'],
        summary: String(data.get('summary') ?? ''),
        commissionNote: String(data.get('commissionNote') ?? ''),
      },
      vehicle?.id,
    )
  }
  return (
    <Modal title={vehicle ? 'Edit vehicle' : 'Register vehicle'} onClose={onClose} wide>
      <form onSubmit={onSubmit}>
        <div className="form-grid two">
          <Field label="Make and model">
            <input name="name" required defaultValue={vehicle?.name ?? ''} />
          </Field>
          <Field label="Model year">
            <input name="year" type="number" min={1980} max={2035} required defaultValue={vehicle?.year ?? MODEL_YEAR} />
          </Field>
          <Field label="Body">
            <select name="type" defaultValue={vehicle?.type ?? 'SUV'}>
              {BODY_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="VIN / chassis">
            <input name="vin" required defaultValue={vehicle?.vin ?? ''} />
          </Field>
          <Field label="Mileage (km)">
            <input name="mileage" type="number" min={0} required defaultValue={vehicle?.mileage ?? 0} />
          </Field>
          <Field label="Condition">
            <select name="condition" defaultValue={vehicle?.condition ?? 'Good'}>
              {CONDITIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <input name="location" defaultValue={vehicle?.location ?? 'Lekki, Lagos'} />
          </Field>
          <Field label="Paint sample">
            <input name="color" type="color" defaultValue={vehicle?.color ?? '#52645d'} />
          </Field>
          <Field label="Acquisition cost (₦)">
            <input name="cost" type="number" min={0} required defaultValue={vehicle ? nairaFromKobo(vehicle.cost) : 0} />
          </Field>
          <Field label="Asking price (₦)">
            <input name="price" type="number" min={0} required defaultValue={vehicle ? nairaFromKobo(vehicle.price) : 0} />
          </Field>
          <Field label="Ownership">
            <select name="owner" defaultValue={vehicle?.owner ?? 'Company'}>
              <option>Company</option>
              <option>Consignment</option>
            </select>
          </Field>
          {locked ? (
            <Field label="Status">
              <input value={vehicle?.status ?? ''} disabled />
              <input type="hidden" name="status" value={vehicle?.status ?? 'Available'} />
            </Field>
          ) : (
            <Field label="Status">
              <select name="status" defaultValue={vehicle && MANUAL_STATUSES.includes(vehicle.status as (typeof MANUAL_STATUSES)[number]) ? vehicle.status : 'Inspection'}>
                {MANUAL_STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Acquired on">
            <input name="acquiredOn" type="date" required defaultValue={vehicle?.acquiredOn ?? todayISO()} />
          </Field>
          <Field label="Available on">
            <input name="availableOn" type="date" defaultValue={vehicle?.availableOn ?? todayISO()} />
          </Field>
          <Field label="Measure age from" className="span-2">
            <select name="ageFrom" defaultValue={vehicle?.ageFrom ?? 'availability'}>
              <option value="availability">Availability date</option>
              <option value="acquisition">Acquisition date</option>
            </select>
          </Field>
          <Field label="Public summary" className="span-2">
            <textarea name="summary" defaultValue={vehicle?.summary ?? ''} />
          </Field>
          <Field label="Consignment note" className="span-2">
            <textarea name="commissionNote" defaultValue={vehicle?.commissionNote ?? ''} placeholder="For consignment, state the fee. The full price is not dealership revenue." />
          </Field>
        </div>
        <div className="actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" type="submit">
            Save vehicle
          </button>
        </div>
      </form>
    </Modal>
  )
}
