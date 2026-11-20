import { BarList, Lens, LensGrid, StackBar } from '../../components/Insight.tsx'
import { PageHead } from '../../components/ui.tsx'
import { money, moneyCompact, stockAge, todayISO } from '../../lib/format.ts'
import { ageBand, askingSum, tally } from '../../lib/picture.ts'
import { agedVehicles, verifiedCash } from '../../lib/selectors.ts'
import { PIPELINE_STAGES } from '../../lib/types.ts'
import { useApp } from '../../store.tsx'

export function ReportsPage() {
  const { db } = useApp()
  const today = todayISO()
  const delivered = db.deals.filter((deal) => deal.status === 'Delivered')
  const companyMargin = delivered.reduce((sum, deal) => {
    const vehicle = db.vehicles.find((item) => item.id === deal.vehicleId)
    if (!vehicle || vehicle.owner !== 'Company') return sum
    return sum + (deal.amount - vehicle.cost)
  }, 0)
  const openBalance = db.deals.filter((deal) => deal.status === 'Reserved').reduce((sum, deal) => sum + (deal.amount - deal.paid), 0)
  const inflow = verifiedCash(db, 'Inflow')
  const expense = verifiedCash(db, 'Expense')

  function exportCsv() {
    const header = ['Reference', 'Type', 'Category', 'Amount NGN', 'Status', 'Date']
    const body = db.money.map((row) => [row.ref, row.type, row.category, String(Math.round(row.amount / 100)), row.status, row.date])
    const csv = [header, ...body].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = 'legit-finance.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <>
      <PageHead
        title="Business intelligence"
        lede="Calculated from the records in this workspace. Internal management view, not statutory accounts."
        action={
          <button className="btn primary" type="button" onClick={exportCsv}>
            Export finance CSV
          </button>
        }
      />
      <LensGrid>
        <Lens title="Asking price by status" note="Blank prices are excluded. Consignment asking prices are not revenue.">
          <BarList
            items={tally(db.vehicles.map((vehicle) => vehicle.status))
              .map((item) => {
                const group = db.vehicles.filter((vehicle) => vehicle.status === item.label)
                return { ...item, value: askingSum(group), display: `${moneyCompact(askingSum(group))} · ${item.value}` }
              })
              .sort((a, b) => b.value - a.value)}
          />
        </Lens>
        <Lens title="How demand is spread" note={`${delivered.length} delivered. Company margin on those handovers is ${moneyCompact(companyMargin)}.`}>
          <BarList
            items={PIPELINE_STAGES.map((label) => ({
              id: label,
              label,
              value: db.leads.filter((lead) => lead.stage === label).length,
              display: String(db.leads.filter((lead) => lead.stage === label).length),
            }))}
          />
          <p className="lens-empty" style={{ marginTop: 14 }}>Lead source</p>
          <BarList
            items={tally(db.leads.map((lead) => lead.source))
              .sort((a, b) => b.value - a.value)
              .map((item) => ({ ...item, display: String(item.value) }))}
          />
        </Lens>
        <Lens title="Cash and what is still open" note="Deposits stay in cash movement until a deal is delivered.">
          <StackBar
            parts={[
              { id: 'in', label: 'Verified inflow', value: inflow, display: money(inflow) },
              { id: 'out', label: 'Verified outflow', value: expense, display: money(expense) },
              { id: 'open', label: 'Open balances', value: openBalance, display: moneyCompact(openBalance) },
            ]}
          />
          <p className="lens-empty">
            {agedVehicles(db, today).length} available {agedVehicles(db, today).length === 1 ? 'vehicle is' : 'vehicles are'} past {db.settings.threshold} days.
          </p>
        </Lens>
      </LensGrid>
      <LensGrid>
        <Lens title="Age of every vehicle" note="Counted from the date the record uses for stock age.">
          <BarList
            items={['0–30 days', '31–60 days', `61–${db.settings.threshold} days`, `Past ${db.settings.threshold} days`].map((label) => {
              const value = db.vehicles.filter((vehicle) => ageBand(stockAge(vehicle, today), db.settings.threshold) === label).length
              return { id: label, label, value, display: String(value) }
            })}
          />
        </Lens>
        <Lens title="Open balance by reservation" note="Agreed price minus verified receipts.">
          <BarList
            items={db.deals
              .filter((deal) => deal.status === 'Reserved')
              .map((deal) => {
                const vehicle = db.vehicles.find((item) => item.id === deal.vehicleId)
                return { id: deal.id, label: vehicle?.name ?? deal.id, value: deal.amount - deal.paid, display: moneyCompact(deal.amount - deal.paid) }
              })}
          />
        </Lens>
        <Lens title="Body mix on the floor" note="Available stock only.">
          <BarList
            items={tally(db.vehicles.filter((vehicle) => vehicle.status === 'Available').map((vehicle) => vehicle.type))
              .sort((a, b) => b.value - a.value)
              .map((item) => ({ ...item, display: String(item.value) }))}
          />
        </Lens>
      </LensGrid>
    </>
  )
}
