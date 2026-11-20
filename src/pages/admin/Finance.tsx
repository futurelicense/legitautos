import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarList, Lens, LensGrid, StackBar } from '../../components/Insight.tsx'
import { Badge, DataTable, Field, Modal, PageHead, saved } from '../../components/ui.tsx'
import { can } from '../../lib/access.ts'
import { hay, koboFromNaira, money, moneyCompact, prettyDate } from '../../lib/format.ts'
import { verifiedCash } from '../../lib/selectors.ts'
import { personName } from '../../lib/seed.ts'
import type { MoneyType } from '../../lib/types.ts'
import { useApp } from '../../store.tsx'

export function FinancePage() {
  const { db, session, saveMoney, verifyMoney, rejectMoney, notify, askConfirm } = useApp()
  const [params] = useSearchParams()
  const focus = db.money.find((row) => row.id === params.get('money'))
  const [query, setQuery] = useState(focus?.ref ?? '')
  const [filter, setFilter] = useState(focus?.status ?? 'All')
  const [open, setOpen] = useState(false)
  if (!session) return null
  const inflow = verifiedCash(db, 'Inflow')
  const expense = verifiedCash(db, 'Expense')
  const net = inflow - expense
  const rows = db.money.filter((row) => (filter === 'All' || row.status === filter) && hay(row, query))

  return (
    <>
      <PageHead
        title="Financial operations"
        lede="Cash movement with a second reviewer. The person who enters a line cannot verify it."
        action={
          can(session.role, 'money.write') ? (
            <button className="btn primary" type="button" onClick={() => setOpen(true)}>
              Transaction
            </button>
          ) : undefined
        }
      />
      <LensGrid>
        <Lens title="Review state" note="Select a state to narrow the book. Net movement is not accounting profit.">
          <BarList
            active={filter === 'All' ? '' : filter}
            onPick={(id) => setFilter(id || 'All')}
            items={['Pending', 'Verified', 'Rejected'].map((label) => {
              const value = db.money.filter((row) => row.status === label).length
              return { id: label, label, value, display: String(value) }
            })}
          />
          <p className="lens-empty">Verified net movement {moneyCompact(net)}.</p>
        </Lens>
        <Lens title="Verified cash" note="Only lines a second person has confirmed.">
          <StackBar
            parts={[
              { id: 'in', label: 'Inflow', value: inflow, display: money(inflow) },
              { id: 'out', label: 'Outflow', value: expense, display: money(expense) },
            ]}
          />
        </Lens>
        <Lens title="By category" note="Every recorded line, including ones still waiting.">
          <BarList
            items={Object.entries(
              db.money.reduce<Record<string, number>>((sum, row) => {
                sum[row.category] = (sum[row.category] ?? 0) + row.amount
                return sum
              }, {}),
            )
              .map(([label, value]) => ({ id: label, label, value, display: moneyCompact(value) }))
              .sort((a, b) => b.value - a.value)}
          />
        </Lens>
      </LensGrid>
      <div className="toolbar" style={{ marginTop: 16 }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transactions" aria-label="Search transactions" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Review status">
          {['All', 'Pending', 'Verified', 'Rejected'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <DataTable
        headers={['Date', 'Reference', 'Type', 'Category', 'Amount', 'Entered by', 'Status', 'Action']}
        rows={rows.map((row) => {
          const mine = row.createdBy === session.id
          return [
            prettyDate(row.date),
            row.ref,
            row.type,
            row.category,
            money(row.amount),
            personName(row.createdBy),
            <span key={row.id}>
              <Badge value={row.status} />
              {row.reviewedBy && <div className="muted">{personName(row.reviewedBy)}</div>}
            </span>,
            row.status === 'Verified' ? (
              'Posted'
            ) : row.status === 'Rejected' ? (
              'Closed'
            ) : !can(session.role, 'payment.verify') || mine ? (
              'Second reviewer required'
            ) : (
              <div className="actions" key="review">
                <button
                  className="btn small primary"
                  type="button"
                  onClick={() =>
                    askConfirm('Verify this entry', 'Confirm you are the second reviewer and the evidence matches the amount.', () => {
                      const error = verifyMoney(row.id)
                      saved(error, notify, 'Entry verified')
                    })
                  }
                >
                  Verify
                </button>
                <button
                  className="btn small danger"
                  type="button"
                  onClick={() =>
                    askConfirm('Reject this entry', 'The amount will not be added to a deal.', () => {
                      const error = rejectMoney(row.id)
                      saved(error, notify, 'Entry rejected')
                    })
                  }
                >
                  Reject
                </button>
              </div>
            ),
          ]
        })}
      />
      {open && (
        <Modal title="Record transaction" onClose={() => setOpen(false)}>
          <form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const error = saveMoney({
                type: String(data.get('type')) as MoneyType,
                category: String(data.get('category') ?? ''),
                amount: koboFromNaira(Number(data.get('amount'))),
                ref: String(data.get('ref') ?? ''),
              })
              if (saved(error, notify, 'Transaction submitted')) setOpen(false)
            }}
          >
            <div className="form-grid">
              <Field label="Type">
                <select name="type" defaultValue="Expense">
                  <option>Inflow</option>
                  <option>Expense</option>
                </select>
              </Field>
              <Field label="Category">
                <input name="category" required placeholder="Repairs, marketing, supplier" />
              </Field>
              <Field label="Amount (₦)">
                <input name="amount" type="number" min={1} required />
              </Field>
              <Field label="Unique reference">
                <input name="ref" required />
              </Field>
            </div>
            <p className="muted">Deal receipts are recorded from Sales. This form is for other cash movement, and it still needs a second reviewer.</p>
            <button className="btn primary" type="submit">
              Submit
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
