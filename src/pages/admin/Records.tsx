import { useState, type FormEvent } from 'react'
import { Badge, DataTable, Field, Modal, PageHead, saved } from '../../components/ui.tsx'
import type { Ability } from '../../lib/access.ts'
import { can } from '../../lib/access.ts'
import { hay, koboFromNaira, money, nairaFromKobo } from '../../lib/format.ts'
import type { RecordBucket } from '../../lib/types.ts'
import { useApp } from '../../store.tsx'

type FieldKind = 'text' | 'money' | 'select'
type FieldDef = { key: string; label: string; kind: FieldKind; options?: readonly string[] }
type Config = {
  title: string
  lede: string
  bucket: RecordBucket
  ability: Ability
  fields: FieldDef[]
}

const configs = {
  procurement: {
    title: 'Vehicle procurement',
    lede: 'Sourcing requests before a car exists as stock. Empty until you add the first one.',
    bucket: 'procurement',
    ability: 'ops.records',
    fields: [
      { key: 'name', label: 'Vehicle requested', kind: 'text' },
      { key: 'supplier', label: 'Supplier', kind: 'text' },
      { key: 'budget', label: 'Budget (₦)', kind: 'money' },
      { key: 'status', label: 'Status', kind: 'select', options: ['Requested', 'Sourced', 'Received', 'Closed'] },
    ],
  },
  documents: {
    title: 'Document register',
    lede: 'Titles, status, and which record they belong to. File upload arrives with private storage.',
    bucket: 'docs',
    ability: 'ops.records',
    fields: [
      { key: 'name', label: 'Document title', kind: 'text' },
      { key: 'type', label: 'Category', kind: 'select', options: ['Vehicle', 'Customer', 'Finance', 'Internal'] },
      { key: 'reference', label: 'Record reference', kind: 'text' },
      { key: 'status', label: 'Status', kind: 'select', options: ['Pending', 'Verified', 'Expired'] },
    ],
  },
  partners: {
    title: 'Partner network',
    lede: 'Suppliers, brokers, and finance partners.',
    bucket: 'partners',
    ability: 'ops.records',
    fields: [
      { key: 'name', label: 'Business name', kind: 'text' },
      { key: 'type', label: 'Partner type', kind: 'select', options: ['Supplier', 'Broker', 'Dealer', 'Finance partner'] },
      { key: 'contact', label: 'Contact', kind: 'text' },
      { key: 'status', label: 'Status', kind: 'select', options: ['Active', 'Inactive'] },
    ],
  },
  marketing: {
    title: 'Marketing campaigns',
    lede: 'Spend and channel. Attribution to closed deals comes later.',
    bucket: 'campaigns',
    ability: 'marketing.write',
    fields: [
      { key: 'name', label: 'Campaign name', kind: 'text' },
      { key: 'channel', label: 'Channel', kind: 'select', options: ['Instagram', 'WhatsApp', 'Website', 'Referral', 'Other'] },
      { key: 'budget', label: 'Budget (₦)', kind: 'money' },
      { key: 'status', label: 'Status', kind: 'select', options: ['Draft', 'Active', 'Closed'] },
    ],
  },
} satisfies Record<string, Config>

export function ProcurementPage() {
  return <RecordScreen config={configs.procurement} />
}
export function DocumentsPage() {
  return <RecordScreen config={configs.documents} />
}
export function PartnersPage() {
  return <RecordScreen config={configs.partners} />
}
export function MarketingPage() {
  return <RecordScreen config={configs.marketing} />
}

function RecordScreen({ config }: { config: Config }) {
  const { db, session, saveRecord, notify } = useApp()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [editing, setEditing] = useState<string | null>(null)
  if (!session) return null
  const source = db[config.bucket] as unknown as Record<string, string | number>[]
  const statusField = config.fields.find((field) => field.key === 'status')
  const rows = source.filter((row) => (filter === 'All' || row.status === filter) && hay(row, query))
  const current = editing && editing !== 'new' ? source.find((row) => row.id === editing) : undefined
  const allowed = can(session.role, config.ability)

  return (
    <>
      <PageHead
        title={config.title}
        lede={config.lede}
        action={
          allowed ? (
            <button className="btn primary" type="button" onClick={() => setEditing('new')}>
              New record
            </button>
          ) : undefined
        }
      />
      <div className="toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" aria-label="Search records" />
        {statusField?.options && (
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Status">
            <option>All</option>
            {statusField.options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        )}
      </div>
      <DataTable
        headers={[...config.fields.map((field) => field.label), 'Action']}
        rows={rows.map((row) => [
          ...config.fields.map((field) => {
            const value = row[field.key]
            if (field.key === 'status') return <Badge key={field.key} value={String(value)} />
            if (field.kind === 'money') return money(Number(value))
            return String(value ?? '')
          }),
          allowed ? (
            <button key="edit" className="btn small" type="button" onClick={() => setEditing(String(row.id))}>
              Edit
            </button>
          ) : (
            '—'
          ),
        ])}
      />
      {editing && (editing === 'new' || current) && (
        <Modal key={editing} title={config.title} onClose={() => setEditing(null)}>
          <form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const values: Record<string, string | number> = {}
              for (const field of config.fields) {
                const raw = String(data.get(field.key) ?? '')
                values[field.key] = field.kind === 'money' ? koboFromNaira(Number(raw)) : raw
              }
              const error = saveRecord(config.bucket, values, editing === 'new' ? undefined : editing)
              if (saved(error, notify, 'Record saved')) setEditing(null)
            }}
          >
            <div className="form-grid">
              {config.fields.map((field) => (
                <Field key={field.key} label={field.label}>
                  {field.kind === 'select' ? (
                    <select name={field.key} defaultValue={String(current?.[field.key] ?? field.options?.[0] ?? '')}>
                      {field.options?.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={field.key}
                      required={field.key === 'name'}
                      type={field.kind === 'money' ? 'number' : 'text'}
                      min={field.kind === 'money' ? 0 : undefined}
                      defaultValue={field.kind === 'money' ? nairaFromKobo(Number(current?.[field.key] ?? 0)) : String(current?.[field.key] ?? '')}
                    />
                  )}
                </Field>
              ))}
            </div>
            <button className="btn primary" type="submit">
              Save
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
