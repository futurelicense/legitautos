import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BarList, Lens, LensGrid } from '../../components/Insight.tsx'
import { Badge, DataTable, Field, Modal, PageHead, saved } from '../../components/ui.tsx'
import { can } from '../../lib/access.ts'
import { hay, koboFromNaira, money, moneyCompact, nairaFromKobo } from '../../lib/format.ts'
import { balanceDue, leadName, pendingInflow, vehicleName, visibleDeals, visibleLeads } from '../../lib/selectors.ts'
import { useApp } from '../../store.tsx'

export function SalesPage() {
  const app = useApp()
  const { db, session, notify, askConfirm } = app
  const [params] = useSearchParams()
  const focus = db.deals.find((deal) => deal.id === params.get('deal'))
  const [query, setQuery] = useState(focus?.id ?? '')
  const [filter, setFilter] = useState(focus?.status ?? 'All')
  const [mode, setMode] = useState<null | 'deal' | { payment: string } | { revise: string }>(null)
  if (!session) return null
  const deals = visibleDeals(db, session).filter((deal) => (filter === 'All' || deal.status === filter) && hay(deal, query))
  const leads = visibleLeads(db, session).filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost')
  const available = db.vehicles.filter((vehicle) => vehicle.status === 'Available')

  function act(error: string | null, message: string) {
    if (saved(error, notify, message)) setMode(null)
  }

  return (
    <>
      <PageHead
        title="Sales and reservations"
        lede="Agreed price, verified receipts, and handover. Versioned quotations are the next release."
        action={
          can(session.role, 'deal.create') ? (
            <button className="btn primary" type="button" onClick={() => setMode('deal')}>
              New reservation
            </button>
          ) : undefined
        }
      />
      <LensGrid>
        <Lens title="Reservation book" note="Select a status to narrow the deals.">
          <BarList
            active={filter === 'All' ? '' : filter}
            onPick={(id) => setFilter(id || 'All')}
            items={['Reserved', 'Delivered', 'Cancelled'].map((label) => {
              const value = visibleDeals(db, session).filter((deal) => deal.status === label).length
              return { id: label, label, value, display: String(value) }
            })}
          />
        </Lens>
        <Lens title="Collected against the agreed price" note="Verified receipts only. Awaiting review is not counted as collected.">
          <BarList
            shareOf={Math.max(1, ...visibleDeals(db, session).filter((deal) => deal.status === 'Reserved').map((deal) => deal.amount))}
            items={visibleDeals(db, session)
              .filter((deal) => deal.status === 'Reserved')
              .map((deal) => ({
                id: deal.id,
                label: vehicleName(db, deal.vehicleId),
                value: deal.paid,
                display: `${moneyCompact(deal.paid)} of ${moneyCompact(deal.amount)}`,
              }))}
          />
        </Lens>
        <Lens title="Still to collect" note="Agreed price minus verified receipts and receipts waiting for review.">
          <BarList
            items={visibleDeals(db, session)
              .filter((deal) => deal.status === 'Reserved')
              .map((deal) => ({
                id: deal.id,
                label: leadName(db, deal.leadId),
                value: balanceDue(db, deal),
                display: moneyCompact(balanceDue(db, deal)),
              }))
              .sort((a, b) => b.value - a.value)}
          />
        </Lens>
      </LensGrid>
      <div className="toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search deals" aria-label="Search deals" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Deal status">
          {['All', 'Reserved', 'Delivered', 'Cancelled'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <DataTable
        headers={['Deal', 'Customer', 'Vehicle', 'Agreed', 'Verified', 'Awaiting review', 'Remaining', 'Status', 'Action']}
        rows={deals.map((deal) => {
          const waiting = pendingInflow(db, deal.id)
          return [
            deal.id,
            leadName(db, deal.leadId),
            vehicleName(db, deal.vehicleId),
            money(deal.amount),
            money(deal.paid),
            money(waiting),
            money(balanceDue(db, deal)),
            <Badge key={deal.id} value={deal.status} />,
            <div className="actions" key="a">
              {(() => {
                const live = db.invoices.find((invoice) => invoice.dealId === deal.id && invoice.status === 'Issued')
                if (live) {
                  return (
                    <Link className="btn small" to={`/app/invoices?invoice=${live.id}`}>
                      Invoice
                    </Link>
                  )
                }
                if (deal.status !== 'Cancelled' && can(session.role, 'invoice.issue')) {
                  return (
                    <Link className="btn small" to={`/app/invoices?deal=${deal.id}`}>
                      Create invoice
                    </Link>
                  )
                }
                return null
              })()}
              {deal.status === 'Reserved' && (
                <>
                {can(session.role, 'payment.submit') && (
                  <button className="btn small" type="button" onClick={() => setMode({ payment: deal.id })}>
                    Payment
                  </button>
                )}
                {can(session.role, 'deal.create') && (
                  <button className="btn small ghost" type="button" onClick={() => setMode({ revise: deal.id })}>
                    Revise
                  </button>
                )}
                {can(session.role, 'deal.deliver') && (
                  <button
                    className="btn small primary"
                    type="button"
                    onClick={() =>
                      askConfirm('Confirm handover', 'The vehicle leaves the floor only if the verified balance is clear.', () => {
                        const error = app.deliverDeal(deal.id)
                        saved(error, notify, 'Vehicle delivered')
                      })
                    }
                  >
                    Deliver
                  </button>
                )}
                {can(session.role, 'deal.cancel') && (
                  <button
                    className="btn small danger"
                    type="button"
                    onClick={() =>
                      askConfirm('Cancel reservation', 'The vehicle returns to available stock. An issued invoice for this reservation is voided. Verified receipts have to be cleared first.', () => {
                        const error = app.cancelDeal(deal.id)
                        saved(error, notify, 'Reservation cancelled')
                      })
                    }
                  >
                    Cancel
                  </button>
                )}
                </>
              )}
            </div>,
          ]
        })}
      />
      {mode === 'deal' && (
        <Modal title="Create reservation" onClose={() => setMode(null)}>
          <form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              act(
                app.createDeal({
                  leadId: String(data.get('leadId') ?? ''),
                  vehicleId: String(data.get('vehicleId') ?? ''),
                  amount: koboFromNaira(Number(data.get('amount'))),
                }),
                'Vehicle reserved',
              )
            }}
          >
            <div className="form-grid">
              <Field label="Customer">
                <select name="leadId" required defaultValue={leads[0]?.id}>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Available vehicle">
                <select name="vehicleId" required defaultValue={available[0]?.id}>
                  {available.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Agreed price (₦)">
                <input name="amount" type="number" min={1} required />
              </Field>
            </div>
            <button className="btn primary" type="submit">
              Reserve
            </button>
          </form>
        </Modal>
      )}
      {mode && mode !== 'deal' && 'payment' in mode && (
        <PaymentForm
          remaining={nairaFromKobo(balanceDue(db, db.deals.find((deal) => deal.id === mode.payment)!))}
          onClose={() => setMode(null)}
          onSave={(amount, ref) => act(app.submitPayment(mode.payment, { amount: koboFromNaira(amount), ref }), 'Payment sent for review')}
        />
      )}
      {mode && mode !== 'deal' && 'revise' in mode && (
        <Modal title="Revise agreed price" onClose={() => setMode(null)}>
          <form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const amount = koboFromNaira(Number(new FormData(event.currentTarget).get('amount')))
              act(app.reviseDeal(mode.revise, amount), 'Agreed price revised')
            }}
          >
            <div className="form-grid">
              <Field label="Agreed price (₦)">
                <input name="amount" type="number" min={1} required defaultValue={nairaFromKobo(db.deals.find((deal) => deal.id === mode.revise)?.amount ?? 0)} />
              </Field>
            </div>
            <button className="btn primary" type="submit">
              Save price
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}

function PaymentForm({ remaining, onClose, onSave }: { remaining: number; onClose: () => void; onSave: (amount: number, ref: string) => void }) {
  return (
    <Modal title="Record customer payment" onClose={onClose}>
      <p className="muted">Still open after receipts already waiting for review: {money(koboFromNaira(remaining))}.</p>
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          onSave(Number(data.get('amount')), String(data.get('ref') ?? ''))
        }}
      >
        <div className="form-grid">
          <Field label="Amount (₦)">
            <input name="amount" type="number" min={1} required />
          </Field>
          <Field label="Payment reference">
            <input name="ref" required />
          </Field>
        </div>
        <button className="btn primary" type="submit">
          Submit for review
        </button>
      </form>
    </Modal>
  )
}
