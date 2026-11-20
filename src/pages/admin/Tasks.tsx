import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, DataTable, Field, Modal, PageHead, saved } from '../../components/ui.tsx'
import { hay, prettyDate, todayISO } from '../../lib/format.ts'
import { taskLabel, visibleTasks } from '../../lib/selectors.ts'
import { useApp } from '../../store.tsx'

export function TasksPage() {
  const { db, session, saveTask, toggleTask, notify } = useApp()
  const [params] = useSearchParams()
  const focus = db.tasks.find((task) => task.id === params.get('task'))
  const [query, setQuery] = useState(focus?.title ?? '')
  const [filter, setFilter] = useState('All')
  const [open, setOpen] = useState(false)
  if (!session) return null
  const today = todayISO()
  const rows = visibleTasks(db, session).filter((task) => {
    const label = taskLabel(task, today)
    const statusMatch = filter === 'All' || label === filter || task.status === filter
    return statusMatch && hay(task, query)
  })
  const staff = db.staff.filter((person) => person.status === 'Active')

  return (
    <>
      <PageHead
        title="Tasks and follow-ups"
        lede={session.role === 'CEO' ? 'Every open commitment in the dealership.' : 'Work assigned to you.'}
        action={
          <button className="btn primary" type="button" onClick={() => setOpen(true)}>
            Assign task
          </button>
        }
      />
      <div className="toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" aria-label="Search tasks" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Task status">
          {['All', 'Open', 'Overdue', 'Done'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <DataTable
        headers={['Task', 'Owner', 'Due', 'Status', 'Action']}
        rows={rows.map((task) => {
          const label = taskLabel(task, today)
          const mine = session.role === 'CEO' || task.owner === session.name
          return [
            task.title,
            task.owner,
            prettyDate(task.due),
            <Badge key={task.id} value={label} />,
            mine ? (
              <button key="toggle" className="btn small" type="button" onClick={() => saved(toggleTask(task.id), notify, task.status === 'Open' ? 'Task completed' : 'Task reopened')}>
                {task.status === 'Open' ? 'Complete' : 'Reopen'}
              </button>
            ) : (
              '—'
            ),
          ]
        })}
      />
      {open && (
        <Modal title="Assign task" onClose={() => setOpen(false)}>
          <form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const error = saveTask({
                title: String(data.get('title') ?? ''),
                owner: String(data.get('owner') ?? ''),
                due: String(data.get('due') ?? ''),
              })
              if (saved(error, notify, 'Task assigned')) setOpen(false)
            }}
          >
            <div className="form-grid">
              <Field label="Task">
                <input name="title" required />
              </Field>
              <Field label="Assigned to">
                <select name="owner" defaultValue={staff.find((person) => person.name === session.name)?.name ?? staff[0]?.name}>
                  {staff.map((person) => (
                    <option key={person.id}>{person.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Due date">
                <input name="due" type="date" required defaultValue={today} />
              </Field>
            </div>
            <button className="btn primary" type="submit">
              Assign
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
