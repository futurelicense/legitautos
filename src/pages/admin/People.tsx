import { useState, type FormEvent } from 'react'
import { BarList, Lens, LensGrid } from '../../components/Insight.tsx'
import { Badge, DataTable, Field, Modal, PageHead, saved } from '../../components/ui.tsx'
import { hay, todayISO } from '../../lib/format.ts'
import type { Staff } from '../../lib/types.ts'
import { useApp } from '../../store.tsx'

export function PeoplePage() {
  const { db, saveStaff, notify } = useApp()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [editing, setEditing] = useState<string | null>(null)
  const rows = db.staff.filter((person) => (filter === 'All' || person.status === filter) && hay(person, query))
  const current = editing && editing !== 'new' ? db.staff.find((person) => person.id === editing) : undefined

  return (
    <>
      <PageHead
        title="People and performance"
        lede="Sign-in exists for CEO, Chidi, Amaka, and Ngozi. Other staff can still receive tasks. Deactivating a linked account blocks that sign-in."
        action={
          <button className="btn primary" type="button" onClick={() => setEditing('new')}>
            Add employee
          </button>
        }
      />
      <LensGrid>
        <Lens title="Open work against the recorded target" note="The target is the number stored on the employee. It is not a calculated quota.">
          <BarList
            onPick={(id) => setQuery(query === id ? '' : id)}
            active={query}
            shareOf={Math.max(1, ...db.staff.map((person) => person.target))}
            items={db.staff.map((person) => {
              const open = db.tasks.filter((task) => task.owner === person.name && task.status === 'Open').length
              return { id: person.name, label: person.name, value: open, display: `${open} open · target ${person.target}` }
            })}
          />
        </Lens>
        <Lens title="Customers they carry" note="Select a name to search the register. Lost leads are left out.">
          <BarList
            onPick={(id) => setQuery(query === id ? '' : id)}
            active={query}
            items={db.staff.map((person) => {
              const owned = db.leads.filter((lead) => lead.owner === person.name && lead.stage !== 'Lost')
              const late = owned.filter((lead) => lead.stage !== 'Won' && lead.due < todayISO()).length
              return { id: person.name, label: person.name, value: owned.length, display: late ? `${owned.length} · ${late} late` : String(owned.length) }
            })}
          />
        </Lens>
        <Lens title="Tasks closed" note="Done against everything assigned to that name.">
          <BarList
            items={db.staff.map((person) => {
              const owned = db.tasks.filter((task) => task.owner === person.name)
              const done = owned.filter((task) => task.status === 'Done').length
              return { id: person.id, label: person.name, value: done, display: `${done} of ${owned.length}` }
            })}
          />
        </Lens>
      </LensGrid>
      <div className="toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" aria-label="Search people" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Status">
          {['All', 'Active', 'Inactive'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <DataTable
        headers={['Employee', 'Role', 'Email', 'Target', 'Open tasks', 'Status', 'Action']}
        rows={rows.map((person) => [
          person.name,
          person.role,
          person.email || '—',
          person.target,
          db.tasks.filter((task) => task.owner === person.name && task.status === 'Open').length,
          <Badge key={person.id} value={person.status} />,
          <button key="edit" className="btn small" type="button" onClick={() => setEditing(person.id)}>
            Edit
          </button>,
        ])}
      />
      {editing && (editing === 'new' || current) && (
        <StaffForm
          key={editing}
          person={current}
          onClose={() => setEditing(null)}
          onSave={(input, id) => {
            const error = saveStaff(input, id)
            if (saved(error, notify, 'Staff saved')) setEditing(null)
          }}
        />
      )}
    </>
  )
}

function StaffForm({
  person,
  onClose,
  onSave,
}: {
  person?: Staff
  onClose: () => void
  onSave: (input: { name: string; role: string; status: 'Active' | 'Inactive'; target: number; email: string }, id?: string) => void
}) {
  return (
    <Modal title={person ? 'Edit employee' : 'Add employee'} onClose={onClose}>
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          onSave(
            {
              name: String(data.get('name') ?? ''),
              role: String(data.get('role') ?? ''),
              status: String(data.get('status')) as 'Active' | 'Inactive',
              target: Number(data.get('target')),
              email: String(data.get('email') ?? ''),
            },
            person?.id,
          )
        }}
      >
        <div className="form-grid">
          <Field label="Full name">
            <input name="name" required defaultValue={person?.name ?? ''} />
          </Field>
          <Field label="Job role">
            <input name="role" required defaultValue={person?.role ?? ''} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={person?.email ?? ''} />
          </Field>
          <Field label="Monthly target">
            <input name="target" type="number" min={0} required defaultValue={person?.target ?? 0} />
          </Field>
          <Field label="Account status">
            <select name="status" defaultValue={person?.status ?? 'Active'}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </Field>
        </div>
        <button className="btn primary" type="submit">
          Save employee
        </button>
      </form>
    </Modal>
  )
}
