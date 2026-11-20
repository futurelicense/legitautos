import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pipeline } from '../../components/Pipeline.tsx'
import { Badge, DataTable, Field, Modal, PageHead, saved } from '../../components/ui.tsx'
import { can } from '../../lib/access.ts'
import { BarList, Lens, LensGrid } from '../../components/Insight.tsx'
import { hay, koboFromNaira, moneyCompact, nairaFromKobo, prettyDate, todayISO } from '../../lib/format.ts'
import { tally } from '../../lib/picture.ts'
import { vehicleName, visibleLeads } from '../../lib/selectors.ts'
import { LEAD_FORM_STAGES, LEAD_SOURCES, type Lead } from '../../lib/types.ts'
import { useApp } from '../../store.tsx'

export function CrmPage() {
  const app = useApp()
  const { db, session, saveLead, notify } = app
  const [params] = useSearchParams()
  const focus = params.get('lead')
  const stage = params.get('stage')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(stage && ['New', 'Contacted', 'Qualified', 'Inspection', 'Negotiation', 'Won', 'Lost'].includes(stage) ? stage : 'All')
  const [editing, setEditing] = useState<string | null>(focus && db.leads.some((lead) => lead.id === focus) ? focus : null)
  if (!session) return null
  const mine = visibleLeads(db, session)
  const rows = mine.filter((lead) => (filter === 'All' || lead.stage === filter) && hay(lead, query))
  const current = editing && editing !== 'new' ? mine.find((lead) => lead.id === editing) : undefined
  const active = db.staff.filter((person) => person.status === 'Active')

  return (
    <>
      <PageHead
        title="Customer relationships"
        lede={session.role === 'Sales' ? 'Leads assigned to you. Won is set only when a car is delivered.' : 'Every enquiry, owner, and next action. Won is set only when a car is delivered.'}
        action={
          can(session.role, 'lead.write') ? (
            <button className="btn primary" type="button" onClick={() => setEditing('new')}>
              Add lead
            </button>
          ) : undefined
        }
      />
      <LensGrid>
        <Lens title="Stage of the relationship" note="Select a stage to narrow the list. Won is set only at handover.">
          <BarList
            active={filter === 'All' ? '' : filter}
            onPick={(id) => setFilter(id || 'All')}
            items={['New', 'Contacted', 'Qualified', 'Inspection', 'Negotiation', 'Won', 'Lost'].map((label) => {
              const value = mine.filter((lead) => lead.stage === label).length
              return { id: label, label, value, display: String(value) }
            })}
          />
        </Lens>
        <Lens title="Where they came from" note="Counted from the source recorded on each lead.">
          <BarList
            items={tally(mine.map((lead) => lead.source))
              .sort((a, b) => b.value - a.value)
              .map((item) => ({ ...item, display: String(item.value) }))}
          />
        </Lens>
        <Lens title="Who is carrying them" note="Open leads. A due date before today is late.">
          <BarList
            items={tally(mine.filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost').map((lead) => lead.owner))
              .sort((a, b) => b.value - a.value)
              .map((item) => {
                const late = mine.filter((lead) => lead.owner === item.label && lead.stage !== 'Won' && lead.stage !== 'Lost' && lead.due < todayISO()).length
                return { ...item, display: late ? `${item.value} · ${late} late` : String(item.value) }
              })}
          />
          <p className="lens-empty">
            Budget recorded on open leads:{' '}
            {moneyCompact(mine.filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost').reduce((sum, lead) => sum + lead.budget, 0))}
          </p>
        </Lens>
      </LensGrid>
      <div className="toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers" aria-label="Search customers" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Stage">
          {['All', 'New', 'Contacted', 'Qualified', 'Inspection', 'Negotiation', 'Won', 'Lost'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <DataTable
        headers={['Customer', 'Vehicle', 'Source', 'Owner', 'Stage', 'Next action', 'Action']}
        rows={rows.map((lead) => [
          lead.name,
          vehicleName(db, lead.vehicleId),
          lead.source,
          lead.owner,
          <Badge key={lead.id} value={lead.stage} />,
          prettyDate(lead.due),
          can(session.role, 'lead.write') ? (
            <button key="edit" className="btn small" type="button" onClick={() => setEditing(lead.id)}>
              Update
            </button>
          ) : (
            '—'
          ),
        ])}
      />
      <div style={{ marginTop: 16 }}>
        <Pipeline leads={rows} detail={(lead) => vehicleName(db, lead.vehicleId)} onOpen={(id) => setEditing(id)} />
      </div>
      {editing && (editing === 'new' || current) && (
        <LeadForm
          key={editing}
          lead={current}
          vehicles={db.vehicles}
          staff={active.map((person) => person.name)}
          defaultOwner={active.some((person) => person.name === session.name) ? session.name : active[0]?.name ?? ''}
          onClose={() => setEditing(null)}
          onSave={(input, id) => {
            const error = saveLead(input, id)
            if (saved(error, notify, 'Lead saved')) setEditing(null)
          }}
        />
      )}
    </>
  )
}

function LeadForm({
  lead,
  vehicles,
  staff,
  defaultOwner,
  onClose,
  onSave,
}: {
  lead?: Lead
  vehicles: { id: string; name: string }[]
  staff: string[]
  defaultOwner: string
  onClose: () => void
  onSave: (input: import('../../lib/mutations.ts').LeadInput, id?: string) => void
}) {
  const won = lead?.stage === 'Won'
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSave(
      {
        name: String(data.get('name') ?? ''),
        contact: String(data.get('contact') ?? ''),
        vehicleId: String(data.get('vehicleId') ?? ''),
        source: String(data.get('source')) as Lead['source'],
        owner: String(data.get('owner') ?? ''),
        stage: String(data.get('stage')) as Lead['stage'],
        due: String(data.get('due') ?? ''),
        budget: koboFromNaira(Number(data.get('budget'))),
        lostReason: String(data.get('lostReason') ?? ''),
        note: String(data.get('note') ?? ''),
      },
      lead?.id,
    )
  }
  return (
    <Modal title={lead ? 'Update lead' : 'Add lead'} onClose={onClose} wide>
      <form onSubmit={onSubmit}>
        <div className="form-grid two">
          <Field label="Customer name">
            <input name="name" required defaultValue={lead?.name ?? ''} />
          </Field>
          <Field label="Phone or email">
            <input name="contact" required defaultValue={lead?.contact ?? ''} />
          </Field>
          <Field label="Interested vehicle">
            <select name="vehicleId" defaultValue={lead?.vehicleId ?? vehicles[0]?.id} required>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source">
            <select name="source" defaultValue={lead?.source ?? 'Marketplace'}>
              {LEAD_SOURCES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Assigned to">
            <select name="owner" defaultValue={lead?.owner ?? defaultOwner}>
              {staff.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Stage">
            {won ? (
              <>
                <input value="Won" disabled />
                <input type="hidden" name="stage" value="Won" />
              </>
            ) : (
              <select name="stage" defaultValue={lead?.stage ?? 'New'}>
                {LEAD_FORM_STAGES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Next follow-up">
            <input name="due" type="date" required defaultValue={lead?.due ?? todayISO()} />
          </Field>
          <Field label="Budget (₦)">
            <input name="budget" type="number" min={0} defaultValue={lead ? nairaFromKobo(lead.budget) : 0} />
          </Field>
          <Field label="Lost reason" className="span-2">
            <input name="lostReason" defaultValue={lead?.lostReason ?? ''} placeholder="Required only when the stage is Lost" />
          </Field>
          <Field label="Note" className="span-2">
            <textarea name="note" defaultValue={lead?.note ?? ''} />
          </Field>
        </div>
        <div className="actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" type="submit">
            Save lead
          </button>
        </div>
      </form>
    </Modal>
  )
}
