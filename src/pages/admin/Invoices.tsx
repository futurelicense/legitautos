import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarList, Lens, LensGrid } from '../../components/Insight.tsx'
import { Badge, DataTable, PageHead, saved } from '../../components/ui.tsx'
import { can } from '../../lib/access.ts'
import { money, moneyCompact, prettyDate } from '../../lib/format.ts'
import { invoiceStanding, visibleDeals, visibleInvoices } from '../../lib/selectors.ts'
import { useApp } from '../../store.tsx'

const STANDINGS = ['Issued', 'Settled', 'Void'] as const

export function InvoicesPage() {
  const { db, session, issueInvoice, notify } = useApp()
  const [params] = useSearchParams()
  const [filter, setFilter] = useState('All')
  const [picked, setPicked] = useState(params.get('invoice') ?? '')
  const [promptId, setPromptId] = useState(params.get('deal') ?? '')
  if (!session) return null
  const mine = visibleInvoices(db, session)
  const issuedForDeal = mine.find((invoice) => invoice.dealId === promptId && invoice.status === 'Issued')
  const selected = mine.find((invoice) => invoice.id === picked) ?? issuedForDeal ?? mine[0]
  const rows = mine.filter((invoice) => filter === 'All' || invoiceStanding(invoice, paidOf(db.deals, invoice.dealId)) === filter)
  const outstanding = mine
    .filter((invoice) => invoiceStanding(invoice, paidOf(db.deals, invoice.dealId)) === 'Issued')
    .reduce((sum, invoice) => sum + Math.max(0, invoice.amount - paidOf(db.deals, invoice.dealId)), 0)
  const ready = visibleDeals(db, session).filter(
    (deal) => deal.status !== 'Cancelled' && !db.invoices.some((invoice) => invoice.dealId === deal.id && invoice.status === 'Issued'),
  )
  const prompted = ready.find((deal) => deal.id === promptId) ?? null

  const chosen = ready.some((deal) => deal.id === promptId) ? promptId : ''

  return (
    <>
      <PageHead
        title="Invoices"
        lede="A bill for the agreed price on a reservation. Verified receipts reduce the balance. Voiding an invoice does not move money."
      />
      {can(session.role, 'invoice.issue') && (
        <section className="card no-print" id="create-invoice" style={{ marginBottom: 16 }}>
          <h2>Create invoice</h2>
          {ready.length === 0 ? (
            <p>No reservation is waiting for an invoice. A reservation can have one issued invoice. Void that bill before creating another for the same reservation.</p>
          ) : (
            <>
              <label className="field">
                Reservation
                <select value={chosen} onChange={(event) => setPromptId(event.target.value)} aria-label="Reservation to invoice">
                  <option value="">Choose a reservation</option>
                  {ready.map((deal) => {
                    const lead = db.leads.find((item) => item.id === deal.leadId)
                    const vehicle = db.vehicles.find((item) => item.id === deal.vehicleId)
                    return (
                      <option key={deal.id} value={deal.id}>
                        {lead?.name ?? 'Customer'} · {vehicle?.name ?? deal.id} · {money(deal.amount)}
                      </option>
                    )
                  })}
                </select>
              </label>
              {prompted && (
                <p>
                  {db.leads.find((lead) => lead.id === prompted.leadId)?.name ?? 'Customer'} ·{' '}
                  {db.vehicles.find((vehicle) => vehicle.id === prompted.vehicleId)?.name} · {money(prompted.amount)}
                </p>
              )}
              <button
                className="btn primary"
                type="button"
                disabled={!prompted}
                onClick={() => {
                  if (!prompted) return
                  const error = issueInvoice(prompted.id)
                  if (!error) {
                    setPromptId('')
                    setPicked('')
                  }
                  saved(error, notify, 'Invoice created')
                }}
              >
                Create invoice
              </button>
            </>
          )}
        </section>
      )}
      <LensGrid>
        <Lens title="Where the bills stand" note="Select a standing to narrow the register. Settled means verified receipts cover the billed amount.">
          <BarList
            active={filter === 'All' ? '' : filter}
            onPick={(id) => setFilter(id || 'All')}
            items={STANDINGS.map((label) => {
              const value = mine.filter((invoice) => invoiceStanding(invoice, paidOf(db.deals, invoice.dealId)) === label).length
              return { id: label, label, value, display: String(value) }
            })}
          />
        </Lens>
        <Lens title="Still to collect on issued bills" note="Issued invoices only. A receipt still awaiting review is not collected.">
          <p className="yard-price">{money(outstanding)}</p>
          <p className="lens-empty">{moneyCompact(outstanding)} across bills that are not yet covered.</p>
        </Lens>
        <Lens title="Reservations without a bill" note="A cancelled reservation is left out. One issued invoice at a time.">
          <BarList
            active={promptId}
            onPick={setPromptId}
            items={ready.map((deal) => {
              const vehicle = db.vehicles.find((item) => item.id === deal.vehicleId)
              return { id: deal.id, label: vehicle?.name ?? deal.id, value: deal.amount, display: moneyCompact(deal.amount) }
            })}
          />
        </Lens>
      </LensGrid>
      <DataTable
        headers={['Invoice', 'Buyer', 'Vehicle', 'Billed', 'Verified', 'Balance', 'Standing', 'Action']}
        rows={rows.map((invoice) => {
          const paid = paidOf(db.deals, invoice.dealId)
          const standing = invoiceStanding(invoice, paid)
          return [
            invoice.number,
            invoice.buyer,
            invoice.vehicle,
            money(invoice.amount),
            money(paid),
            money(Math.max(0, invoice.amount - paid)),
            <Badge key={invoice.id} value={standing} />,
            <button key="open" className="btn small" type="button" onClick={() => setPicked(invoice.id)}>
              Open
            </button>,
          ]
        })}
      />
      {selected && <InvoiceSheet invoiceId={selected.id} />}
    </>
  )
}

function InvoiceSheet({ invoiceId }: { invoiceId: string }) {
  const { db, session, voidInvoice, notify, askConfirm } = useApp()
  const invoice = db.invoices.find((item) => item.id === invoiceId)
  if (!invoice || !session) return null
  const deal = db.deals.find((item) => item.id === invoice.dealId)
  const paid = deal?.paid ?? 0
  const standing = invoiceStanding(invoice, paid)
  const receipts = db.money.filter((row) => row.dealId === invoice.dealId && row.type === 'Inflow' && row.status === 'Verified')
  const waiting = db.money.filter((row) => row.dealId === invoice.dealId && row.type === 'Inflow' && row.status === 'Pending')
  const balance = Math.max(0, invoice.amount - paid)

  return (
    <article className="invoice-sheet">
      <header>
        <div className="invoice-brand">
          <img src="/brand/legit-logo.jpg" alt="" />
          <div>
            <p className="eyebrow">Invoice</p>
            <h2>{db.settings.business}</h2>
            <p>Lekki showroom, Lagos</p>
          </div>
        </div>
        <div>
          <strong>{invoice.number}</strong>
          <p>Issued {prettyDate(invoice.issuedOn)}</p>
          <Badge value={standing} />
        </div>
      </header>
      <div className="invoice-party">
        <div>
          <h3>Bill to</h3>
          <p>{invoice.buyer}</p>
          <p>{invoice.contact || 'Contact not stated'}</p>
        </div>
        <div>
          <h3>Reservation</h3>
          <p>{deal?.id ?? invoice.dealId}</p>
          <p>{deal ? deal.status : 'Deal not on record'}</p>
        </div>
      </div>
      <div className="invoice-line">
        <span>{invoice.vehicle}</span>
        <strong>{money(invoice.amount)}</strong>
      </div>
      <h3>Verified receipts</h3>
      {receipts.length === 0 && <p>No verified receipt is on this reservation yet.</p>}
      {receipts.map((row) => (
        <div className="invoice-line" key={row.id}>
          <span>
            {row.ref} · {prettyDate(row.date)}
          </span>
          <span>{money(row.amount)}</span>
        </div>
      ))}
      {waiting.length > 0 && <p className="muted">{waiting.length} receipt{waiting.length === 1 ? ' is' : 's are'} awaiting review and {waiting.length === 1 ? 'is' : 'are'} not on this bill.</p>}
      <div className="invoice-total">
        <span>Balance</span>
        <strong>{money(balance)}</strong>
      </div>
      {deal && deal.amount !== invoice.amount && (
        <p>The reservation is now {money(deal.amount)}. This invoice still shows the amount it was issued for.</p>
      )}
      {standing === 'Void' && <p>This invoice is void. Receipts already verified stay on the reservation.</p>}
      <div className="actions no-print">
        <button className="btn primary" type="button" onClick={() => window.print()}>
          Print
        </button>
        {standing !== 'Void' && can(session.role, 'invoice.void') && (
          <button
            className="btn danger"
            type="button"
            onClick={() =>
              askConfirm('Void this invoice', 'The bill stays on record as void. Receipts and the reservation are left as they are.', () => {
                const error = voidInvoice(invoice.id)
                saved(error, notify, 'Invoice void')
              })
            }
          >
            Void
          </button>
        )}
      </div>
    </article>
  )
}

function paidOf(deals: { id: string; paid: number }[], dealId: string) {
  return deals.find((deal) => deal.id === dealId)?.paid ?? 0
}
