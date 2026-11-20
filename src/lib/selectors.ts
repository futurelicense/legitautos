import { stockAge, todayISO } from './format.ts'
import type { DB, Deal, Lead, Session, Task, Vehicle } from './types.ts'

export function isPublic(vehicle: Vehicle) {
  return vehicle.published && vehicle.status === 'Available'
}

export function publicVehicles(db: DB) {
  return db.vehicles.filter(isPublic)
}

export function vehicleName(db: DB, id: string) {
  return db.vehicles.find((vehicle) => vehicle.id === id)?.name ?? 'Not selected'
}

export function leadName(db: DB, id: string) {
  return db.leads.find((lead) => lead.id === id)?.name ?? 'Unknown'
}

export function pendingInflow(db: DB, dealId: string) {
  return db.money
    .filter((row) => row.dealId === dealId && row.type === 'Inflow' && row.status === 'Pending')
    .reduce((sum, row) => sum + row.amount, 0)
}

export function balanceDue(db: DB, deal: Deal) {
  return deal.amount - deal.paid - pendingInflow(db, dealIdOf(deal))
}

function dealIdOf(deal: Deal) {
  return deal.id
}

export function verifiedCash(db: DB, type: 'Inflow' | 'Expense') {
  return db.money.filter((row) => row.type === type && row.status === 'Verified').reduce((sum, row) => sum + row.amount, 0)
}

export function agedVehicles(db: DB, today = todayISO()) {
  return db.vehicles.filter((vehicle) => vehicle.status === 'Available' && stockAge(vehicle, today) > db.settings.threshold)
}

export function overdueTasks(db: DB, today = todayISO()) {
  return db.tasks.filter((task) => task.status === 'Open' && task.due < today)
}

export function visibleLeads(db: DB, session: Session) {
  if (session.role === 'CEO') return db.leads
  if (session.role === 'Sales') return db.leads.filter((lead) => lead.owner === session.name)
  return []
}

export function invoiceStanding(invoice: { status: 'Issued' | 'Void'; amount: number }, paid: number) {
  if (invoice.status === 'Void') return 'Void'
  if (paid >= invoice.amount) return 'Settled'
  return 'Issued'
}

export function visibleInvoices(db: DB, session: Session) {
  if (session.role === 'CEO' || session.role === 'Finance') return db.invoices
  if (session.role === 'Sales') {
    const mine = new Set(db.leads.filter((lead) => lead.owner === session.name).map((lead) => lead.id))
    return db.invoices.filter((invoice) => {
      const deal = db.deals.find((item) => item.id === invoice.dealId)
      return Boolean(deal && mine.has(deal.leadId))
    })
  }
  return []
}

export function visibleDeals(db: DB, session: Session) {
  if (session.role === 'CEO') return db.deals
  if (session.role === 'Sales') {
    const mine = new Set(db.leads.filter((lead) => lead.owner === session.name).map((lead) => lead.id))
    return db.deals.filter((deal) => mine.has(deal.leadId))
  }
  return []
}

export function visibleTasks(db: DB, session: Session) {
  if (session.role === 'CEO') return db.tasks
  return db.tasks.filter((task) => task.owner === session.name)
}

export function openLeadCount(leads: Lead[]) {
  return leads.filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost').length
}

export function taskLabel(task: Task, today = todayISO()) {
  if (task.status === 'Open' && task.due < today) return 'Overdue'
  return task.status
}
