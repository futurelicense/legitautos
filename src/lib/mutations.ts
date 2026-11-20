import { can } from './access.ts'
import { contactKey, isIsoDate, stockAge, todayISO, uid } from './format.ts'
import { balanceDue, pendingInflow } from './selectors.ts'
import { USERS } from './seed.ts'
import type {
  Campaign,
  DB,
  Doc,
  Lead,
  LeadStage,
  MoneyType,
  Mut,
  Partner,
  Procurement,
  RecordBucket,
  Session,
  Vehicle,
  VehicleStatus,
} from './types.ts'
import { MANUAL_STATUSES } from './types.ts'

const fail = (error: string): Mut => ({ ok: false, error })
const ok = (audit: string): Mut => ({ ok: true, audit })

export type VehicleInput = {
  name: string
  year: number
  type: Vehicle['type']
  vin: string
  mileage: number
  condition: Vehicle['condition']
  location: string
  color: string
  cost: number
  price: number
  owner: Vehicle['owner']
  status: VehicleStatus
  acquiredOn: string
  availableOn: string
  ageFrom: Vehicle['ageFrom']
  summary: string
  commissionNote: string
}

export type LeadInput = {
  name: string
  contact: string
  vehicleId: string
  source: Lead['source']
  owner: string
  stage: LeadStage
  due: string
  budget: number
  lostReason: string
  note: string
}

function activeNames(draft: DB) {
  return draft.staff.filter((person) => person.status === 'Active').map((person) => person.name)
}

function namedRole(draft: DB, fragment: string) {
  return draft.staff.find((person) => person.status === 'Active' && person.role.toLowerCase().includes(fragment))?.name
}

export function mutateVehicle(draft: DB, session: Session, input: VehicleInput, id?: string): Mut {
  if (!can(session.role, 'vehicle.write')) return fail('You cannot edit inventory.')
  const name = input.name.trim()
  const vin = input.vin.trim()
  if (!name || !vin) return fail('Name and VIN are required.')
  if (!Number.isFinite(input.year) || input.year < 1980 || input.year > 2035) return fail('Enter a valid model year.')
  if (!Number.isFinite(input.price) || !Number.isFinite(input.cost) || !Number.isFinite(input.mileage)) return fail('Enter valid numbers.')
  if (input.price < 0 || input.cost < 0 || input.mileage < 0) return fail('Amounts cannot be negative.')
  if (!isIsoDate(input.acquiredOn)) return fail('Choose the acquisition date.')
  const availableOn = isIsoDate(input.availableOn) ? input.availableOn : input.acquiredOn
  if (draft.vehicles.some((vehicle) => vehicle.vin.toLowerCase() === vin.toLowerCase() && vehicle.id !== id)) {
    return fail('A vehicle with this VIN already exists.')
  }
  const manual = new Set<string>(MANUAL_STATUSES)
  const next: Omit<Vehicle, 'id' | 'published' | 'priceApproved'> = {
    name,
    year: input.year,
    type: input.type,
    vin,
    mileage: input.mileage,
    condition: input.condition,
    location: input.location.trim() || 'Lekki, Lagos',
    color: input.color || '#52645d',
    cost: input.cost,
    price: input.price,
    status: input.status,
    owner: input.owner,
    acquiredOn: input.acquiredOn,
    availableOn,
    ageFrom: input.ageFrom,
    summary: input.summary.trim(),
    commissionNote: input.commissionNote.trim(),
  }
  if (!id) {
    if (!manual.has(next.status)) return fail('Choose a workshop status. Reserved and sold come from a deal.')
    draft.vehicles.unshift({
      ...next,
      id: uid('V'),
      published: false,
      priceApproved: session.role === 'CEO',
    })
    return ok(`Vehicle registered: ${name}`)
  }
  const vehicle = draft.vehicles.find((item) => item.id === id)
  if (!vehicle) return fail('Vehicle not found.')
  const locked = vehicle.status === 'Reserved' || vehicle.status === 'Sold'
  if (locked && next.status !== vehicle.status) return fail('An open deal controls this vehicle status.')
  if (!locked && !manual.has(next.status)) return fail('Use the sales desk to reserve or sell this vehicle.')
  if (locked && next.price !== vehicle.price) return fail('The list price stays fixed once a deal is open or the car is sold.')
  const priceChanged = next.price !== vehicle.price
  Object.assign(vehicle, next)
  if (priceChanged && session.role !== 'CEO') {
    vehicle.priceApproved = false
    vehicle.published = false
  }
  if (priceChanged && session.role === 'CEO') vehicle.priceApproved = true
  if (vehicle.status !== 'Available') vehicle.published = false
  return ok(`Vehicle saved: ${name}`)
}

export function mutatePublish(draft: DB, session: Session, id: string): Mut {
  if (!can(session.role, 'vehicle.publish')) return fail('You cannot change the public listing.')
  const vehicle = draft.vehicles.find((item) => item.id === id)
  if (!vehicle) return fail('Vehicle not found.')
  if (vehicle.published) {
    vehicle.published = false
    return ok(`Unpublished ${vehicle.name}`)
  }
  if (vehicle.status !== 'Available') return fail('Only available vehicles can be listed.')
  if (!vehicle.priceApproved) return fail('A CEO must approve the price before listing.')
  if (vehicle.price <= 0) return fail('Set an asking price before listing.')
  vehicle.published = true
  return ok(`Published ${vehicle.name}`)
}

export function mutateApprovePrice(draft: DB, session: Session, id: string): Mut {
  if (!can(session.role, 'vehicle.approvePrice')) return fail('Only the CEO can approve a price.')
  const vehicle = draft.vehicles.find((item) => item.id === id)
  if (!vehicle) return fail('Vehicle not found.')
  vehicle.priceApproved = true
  return ok(`Price approved: ${vehicle.name}`)
}

export function mutateLead(draft: DB, session: Session, input: LeadInput, id?: string): Mut {
  if (!can(session.role, 'lead.write')) return fail('You cannot edit leads.')
  const name = input.name.trim()
  const contact = input.contact.trim()
  if (name.length < 2) return fail('Enter the customer name.')
  if (contact.length < 3) return fail('Enter a phone number or email.')
  if (!draft.vehicles.some((vehicle) => vehicle.id === input.vehicleId)) return fail('Choose a vehicle.')
  if (!activeNames(draft).includes(input.owner)) return fail('Assign the lead to an active employee.')
  if (!isIsoDate(input.due)) return fail('Choose a follow-up date.')
  if (!Number.isFinite(input.budget) || input.budget < 0) return fail('Budget cannot be negative.')
  const existing = id ? draft.leads.find((lead) => lead.id === id) : undefined
  if (id && !existing) return fail('Lead not found.')
  if (session.role === 'Sales' && existing && existing.owner !== session.name) return fail('This lead is assigned to someone else.')
  if (existing?.stage === 'Won' && input.stage !== 'Won') return fail('A won lead stays won.')
  if (input.stage === 'Won' && existing?.stage !== 'Won') return fail('Won is set when the vehicle is delivered.')
  if (input.stage === 'Lost' && !input.lostReason.trim()) return fail('Add a lost reason before closing the lead.')
  const key = contactKey(contact)
  if (draft.leads.some((lead) => lead.id !== id && contactKey(lead.contact) === key)) {
    return fail('This contact already has a lead. Update that record so the history stays in one place.')
  }
  const next = {
    name,
    contact,
    vehicleId: input.vehicleId,
    source: input.source,
    owner: input.owner,
    stage: input.stage,
    due: input.due,
    budget: input.budget,
    lostReason: input.lostReason.trim(),
    note: input.note.trim(),
  }
  if (existing) {
    Object.assign(existing, next)
    return ok(`Lead saved: ${name}`)
  }
  draft.leads.unshift({ ...next, id: uid('L') })
  return ok(`Lead added: ${name}`)
}

export function mutateDeal(draft: DB, session: Session, input: { leadId: string; vehicleId: string; amount: number }): Mut {
  if (!can(session.role, 'deal.create')) return fail('You cannot open a reservation.')
  const lead = draft.leads.find((item) => item.id === input.leadId)
  const vehicle = draft.vehicles.find((item) => item.id === input.vehicleId)
  if (!lead || !vehicle) return fail('Choose a customer and a vehicle.')
  if (session.role === 'Sales' && lead.owner !== session.name) return fail('This lead is assigned to someone else.')
  if (lead.stage === 'Lost' || lead.stage === 'Won') return fail('This lead is already closed.')
  if (vehicle.status !== 'Available') return fail('That vehicle is not available.')
  if (!Number.isFinite(input.amount) || input.amount <= 0) return fail('Enter the agreed price.')
  if (draft.deals.some((deal) => deal.leadId === lead.id && deal.status === 'Reserved')) return fail('This customer already has an open reservation.')
  if (draft.deals.some((deal) => deal.vehicleId === vehicle.id && deal.status === 'Reserved')) return fail('This vehicle already has an open reservation.')
  draft.deals.unshift({ id: uid('D'), leadId: lead.id, vehicleId: vehicle.id, amount: input.amount, paid: 0, status: 'Reserved' })
  vehicle.status = 'Reserved'
  vehicle.published = false
  lead.stage = 'Negotiation'
  return ok(`Vehicle reserved: ${vehicle.name}`)
}

export function mutateReviseDeal(draft: DB, session: Session, id: string, amount: number): Mut {
  if (!can(session.role, 'deal.create')) return fail('You cannot revise a deal.')
  const deal = draft.deals.find((item) => item.id === id)
  if (!deal) return fail('Deal not found.')
  if (deal.status !== 'Reserved') return fail('Only an open reservation can be revised.')
  const lead = draft.leads.find((item) => item.id === deal.leadId)
  if (session.role === 'Sales' && lead?.owner !== session.name) return fail('This deal is assigned to someone else.')
  if (!Number.isFinite(amount) || amount <= 0) return fail('Enter the agreed price.')
  if (amount < deal.paid + pendingInflow(draft, deal.id)) {
    return fail('The agreed price cannot fall below verified receipts plus receipts awaiting review.')
  }
  deal.amount = amount
  return ok(`Deal revised: ${deal.id}`)
}

export function mutatePayment(draft: DB, session: Session, dealId: string, input: { amount: number; ref: string }): Mut {
  if (!can(session.role, 'payment.submit')) return fail('You cannot record a receipt.')
  const deal = draft.deals.find((item) => item.id === dealId)
  if (!deal) return fail('Deal not found.')
  if (deal.status !== 'Reserved') return fail('Payments can only be added to an open reservation.')
  const lead = draft.leads.find((item) => item.id === deal.leadId)
  if (session.role === 'Sales' && lead?.owner !== session.name) return fail('This deal is assigned to someone else.')
  const ref = input.ref.trim()
  if (!Number.isFinite(input.amount) || input.amount <= 0) return fail('Enter an amount.')
  if (!ref) return fail('Enter a payment reference.')
  if (draft.money.some((row) => row.ref.toLowerCase() === ref.toLowerCase())) return fail('That reference is already used.')
  if (input.amount > balanceDue(draft, deal)) return fail('That amount is higher than the remaining balance.')
  draft.money.unshift({
    id: uid('F'),
    type: 'Inflow',
    category: 'Customer payment',
    amount: input.amount,
    status: 'Pending',
    ref,
    dealId: deal.id,
    createdBy: session.id,
    reviewedBy: '',
    date: todayISO(),
  })
  return ok(`Payment submitted for review ${ref}`)
}

export function mutateMoney(draft: DB, session: Session, input: { type: MoneyType; category: string; amount: number; ref: string }): Mut {
  if (!can(session.role, 'money.write')) return fail('You cannot record this transaction.')
  const ref = input.ref.trim()
  const category = input.category.trim()
  if (!category) return fail('Enter a category.')
  if (!Number.isFinite(input.amount) || input.amount <= 0) return fail('Enter a positive amount.')
  if (!ref) return fail('Enter a unique reference.')
  if (draft.money.some((row) => row.ref.toLowerCase() === ref.toLowerCase())) return fail('That reference is already used.')
  draft.money.unshift({
    id: uid('F'),
    type: input.type,
    category,
    amount: input.amount,
    status: 'Pending',
    ref,
    dealId: '',
    createdBy: session.id,
    reviewedBy: '',
    date: todayISO(),
  })
  return ok(`Transaction submitted: ${ref}`)
}

function reviewGuard(draft: DB, session: Session, id: string): { error: string } | { row: DB['money'][number] } {
  if (!can(session.role, 'payment.verify')) return { error: 'A finance reviewer has to do this.' }
  const row = draft.money.find((item) => item.id === id)
  if (!row) return { error: 'Transaction not found.' }
  if (row.status !== 'Pending') return { error: 'This entry is already reviewed.' }
  if (row.createdBy === session.id) return { error: 'A different person must review this entry.' }
  return { row }
}

export function mutateVerify(draft: DB, session: Session, id: string): Mut {
  const guard = reviewGuard(draft, session, id)
  if ('error' in guard) return fail(guard.error)
  const row = guard.row
  if (row.dealId && row.type === 'Inflow') {
    const deal = draft.deals.find((item) => item.id === row.dealId)
    if (deal && deal.status === 'Reserved') {
      if (deal.paid + row.amount > deal.amount) return fail('This receipt would exceed the agreed price.')
      deal.paid += row.amount
    }
  }
  row.status = 'Verified'
  row.reviewedBy = session.id
  return ok(`Finance reviewer verified ${row.ref}`)
}

export function mutateReject(draft: DB, session: Session, id: string): Mut {
  const guard = reviewGuard(draft, session, id)
  if ('error' in guard) return fail(guard.error)
  guard.row.status = 'Rejected'
  guard.row.reviewedBy = session.id
  return ok(`Finance reviewer rejected ${guard.row.ref}`)
}

export function mutateDeliver(draft: DB, session: Session, id: string): Mut {
  if (!can(session.role, 'deal.deliver')) return fail('You cannot confirm handover.')
  const deal = draft.deals.find((item) => item.id === id)
  if (!deal) return fail('Deal not found.')
  if (deal.status !== 'Reserved') return fail('This deal is already closed.')
  const lead = draft.leads.find((item) => item.id === deal.leadId)
  const vehicle = draft.vehicles.find((item) => item.id === deal.vehicleId)
  if (!lead || !vehicle) return fail('The deal is missing its customer or vehicle.')
  if (session.role === 'Sales' && lead.owner !== session.name) return fail('This deal is assigned to someone else.')
  if (pendingInflow(draft, deal.id) > 0) return fail('Verify or reject receipts that are still awaiting review.')
  if (deal.paid < deal.amount) return fail('Delivery is blocked while a balance is outstanding.')
  deal.status = 'Delivered'
  vehicle.status = 'Sold'
  vehicle.published = false
  lead.stage = 'Won'
  draft.tasks.unshift({
    id: uid('T'),
    title: `After-sales follow-up: ${lead.name}`,
    owner: activeNames(draft).includes(lead.owner) ? lead.owner : 'CEO',
    due: todayISO(),
    status: 'Open',
  })
  return ok(`Delivered ${vehicle.name}`)
}

export function mutateCancelDeal(draft: DB, session: Session, id: string): Mut {
  if (!can(session.role, 'deal.cancel')) return fail('You cannot cancel this reservation.')
  const deal = draft.deals.find((item) => item.id === id)
  if (!deal) return fail('Deal not found.')
  if (deal.status !== 'Reserved') return fail('This deal is already closed.')
  const lead = draft.leads.find((item) => item.id === deal.leadId)
  if (session.role === 'Sales' && lead?.owner !== session.name) return fail('This deal is assigned to someone else.')
  if (deal.paid > 0) return fail('Refund the verified receipts before cancelling. This demo does not post a reversal yet.')
  deal.status = 'Cancelled'
  for (const invoice of draft.invoices) {
    if (invoice.dealId === deal.id && invoice.status === 'Issued') invoice.status = 'Void'
  }
  const vehicle = draft.vehicles.find((item) => item.id === deal.vehicleId)
  if (vehicle && vehicle.status === 'Reserved') {
    vehicle.status = 'Available'
    vehicle.published = false
  }
  const voided = draft.invoices.filter((invoice) => invoice.dealId === deal.id && invoice.status === 'Void').length
  return ok(voided ? `Reservation cancelled: ${deal.id}. The invoice is void.` : `Reservation cancelled: ${deal.id}`)
}

export function mutateIssueInvoice(draft: DB, session: Session, dealId: string): Mut {
  if (!can(session.role, 'invoice.issue')) return fail('You cannot issue an invoice.')
  const deal = draft.deals.find((item) => item.id === dealId)
  if (!deal) return fail('Deal not found.')
  if (deal.status === 'Cancelled') return fail('A cancelled reservation cannot be invoiced.')
  const lead = draft.leads.find((item) => item.id === deal.leadId)
  const vehicle = draft.vehicles.find((item) => item.id === deal.vehicleId)
  if (!lead || !vehicle) return fail('The deal is missing its customer or vehicle.')
  if (session.role === 'Sales' && lead.owner !== session.name) return fail('This deal is assigned to someone else.')
  if (draft.invoices.some((invoice) => invoice.dealId === deal.id && invoice.status === 'Issued')) {
    return fail('This reservation already has an invoice. Void it before issuing another.')
  }
  const number = nextInvoiceNumber(draft)
  draft.invoices.unshift({
    id: uid('INV'),
    number,
    dealId: deal.id,
    issuedOn: todayISO(),
    buyer: lead.name,
    contact: lead.contact,
    vehicle: vehicle.name,
    amount: deal.amount,
    status: 'Issued',
  })
  return ok(`Invoice issued: ${number}`)
}

export function mutateVoidInvoice(draft: DB, session: Session, id: string): Mut {
  if (!can(session.role, 'invoice.void')) return fail('You cannot void an invoice.')
  const invoice = draft.invoices.find((item) => item.id === id)
  if (!invoice) return fail('Invoice not found.')
  if (invoice.status !== 'Issued') return fail('This invoice is already void.')
  const deal = draft.deals.find((item) => item.id === invoice.dealId)
  const lead = deal ? draft.leads.find((item) => item.id === deal.leadId) : undefined
  if (session.role === 'Sales' && lead && lead.owner !== session.name) return fail('This invoice belongs to another salesperson.')
  invoice.status = 'Void'
  return ok(`Invoice void: ${invoice.number}`)
}

function nextInvoiceNumber(draft: DB) {
  const used = new Set(draft.invoices.map((invoice) => invoice.number))
  let sequence = draft.invoices.length + 1
  let number = `INV-${String(sequence).padStart(3, '0')}`
  while (used.has(number)) {
    sequence += 1
    number = `INV-${String(sequence).padStart(3, '0')}`
  }
  return number
}

export function mutateStaff(
  draft: DB,
  session: Session,
  input: { name: string; role: string; status: 'Active' | 'Inactive'; target: number; email: string },
  id?: string,
): Mut {
  if (!can(session.role, 'staff.write')) return fail('Only the CEO can edit staff.')
  const name = input.name.trim()
  if (name.length < 2) return fail('Enter the employee name.')
  if (!input.role.trim()) return fail('Enter a job role.')
  if (!Number.isFinite(input.target) || input.target < 0) return fail('Enter a monthly target.')
  if (input.email && !input.email.includes('@')) return fail('Enter a valid email or leave it blank.')
  if (draft.staff.some((person) => person.name.toLowerCase() === name.toLowerCase() && person.id !== id)) {
    return fail('An employee with this name already exists.')
  }
  if (id) {
    const person = draft.staff.find((item) => item.id === id)
    if (!person) return fail('Employee not found.')
    Object.assign(person, { name, role: input.role.trim(), status: input.status, target: input.target, email: input.email.trim() })
    return ok(`Staff updated: ${name}`)
  }
  draft.staff.unshift({ id: uid('S'), name, role: input.role.trim(), status: input.status, target: input.target, email: input.email.trim() })
  return ok(`Staff added: ${name}`)
}

export function mutateTask(draft: DB, session: Session, input: { title: string; owner: string; due: string }): Mut {
  if (!can(session.role, 'task.write')) return fail('You cannot assign tasks.')
  const title = input.title.trim()
  if (!title) return fail('Describe the task.')
  if (!activeNames(draft).includes(input.owner)) return fail('Assign the task to an active employee.')
  if (!isIsoDate(input.due)) return fail('Choose a due date.')
  draft.tasks.unshift({ id: uid('T'), title, owner: input.owner, due: input.due, status: 'Open' })
  return ok(`Task assigned: ${title}`)
}

export function mutateToggleTask(draft: DB, session: Session, id: string): Mut {
  if (!can(session.role, 'task.write')) return fail('You cannot update tasks.')
  const task = draft.tasks.find((item) => item.id === id)
  if (!task) return fail('Task not found.')
  if (session.role !== 'CEO' && task.owner !== session.name) return fail('You can only update your own tasks.')
  task.status = task.status === 'Open' ? 'Done' : 'Open'
  return ok(`Task ${task.status.toLowerCase()}: ${task.title}`)
}

export function mutateToggleRule(draft: DB, session: Session, id: string): Mut {
  if (!can(session.role, 'rules.run')) return fail('Only the CEO can change automation rules.')
  const rule = draft.rules.find((item) => item.id === id)
  if (!rule) return fail('Rule not found.')
  rule.enabled = !rule.enabled
  return ok(`Rule ${rule.enabled ? 'enabled' : 'disabled'}: ${rule.name}`)
}

export type AutomationMatch = {
  ruleId: string
  key: string
  title: string
  owner: string
  recordId: string
}

export function automationMatches(draft: DB, today = todayISO()): AutomationMatch[] {
  const hits: AutomationMatch[] = []
  const ops = namedRole(draft, 'operations') ?? 'CEO'
  const finance = namedRole(draft, 'finance') ?? 'CEO'
  const names = activeNames(draft)
  for (const lead of draft.leads) {
    if (!(lead.due < today && lead.stage !== 'Won' && lead.stage !== 'Lost')) continue
    hits.push({
      ruleId: 'R-001',
      key: `lead-${lead.id}`,
      title: `Follow up with ${lead.name}`,
      owner: names.includes(lead.owner) ? lead.owner : 'CEO',
      recordId: lead.id,
    })
  }
  for (const vehicle of draft.vehicles) {
    if (!(vehicle.status === 'Available' && stockAge(vehicle, today) > draft.settings.threshold)) continue
    hits.push({
      ruleId: 'R-002',
      key: `aging-${vehicle.id}`,
      title: `Review pricing: ${vehicle.name}`,
      owner: ops,
      recordId: vehicle.id,
    })
  }
  for (const row of draft.money) {
    if (row.status !== 'Pending') continue
    const creator = USERS.find((user) => user.id === row.createdBy)?.name
    const owner = creator && creator === finance ? 'CEO' : finance
    hits.push({
      ruleId: 'R-003',
      key: `finance-${row.id}`,
      title: `Review transaction ${row.ref}`,
      owner,
      recordId: row.id,
    })
  }
  return hits
}

export function mutateRunRules(draft: DB, session: Session, today = todayISO()): Mut {
  if (!can(session.role, 'rules.run')) return fail('Only the CEO can run automations.')
  let created = 0
  for (const hit of automationMatches(draft, today)) {
    const rule = draft.rules.find((item) => item.id === hit.ruleId)
    if (!rule?.enabled) continue
    if (draft.tasks.some((task) => task.key === hit.key)) continue
    draft.tasks.unshift({ id: uid('T'), key: hit.key, title: hit.title, owner: hit.owner, due: today, status: 'Open' })
    created += 1
  }
  return ok(`Automation scan: ${created} new tasks. Duplicates were skipped.`)
}

export function mutateRecord(draft: DB, session: Session, bucket: RecordBucket, values: Record<string, string | number>, id?: string): Mut {
  const ability = bucket === 'campaigns' ? 'marketing.write' : 'ops.records'
  if (!can(session.role, ability)) return fail('You cannot edit these records.')
  const name = String(values.name ?? '').trim()
  if (!name) return fail('Name is required.')
  if (bucket === 'docs') return saveDoc(draft, values, name, id)
  if (bucket === 'partners') return savePartner(draft, values, name, id)
  if (bucket === 'campaigns') return saveCampaign(draft, values, name, id)
  return saveProcurement(draft, values, name, id)
}

function saveDoc(draft: DB, values: Record<string, string | number>, name: string, id?: string): Mut {
  const row: Doc = {
    id: id ?? uid('DOC'),
    name,
    type: String(values.type ?? 'Internal') as Doc['type'],
    reference: String(values.reference ?? ''),
    status: String(values.status ?? 'Pending') as Doc['status'],
  }
  return upsert(draft.docs, row, id, `Document saved: ${name}`)
}

function savePartner(draft: DB, values: Record<string, string | number>, name: string, id?: string): Mut {
  const row: Partner = {
    id: id ?? uid('P'),
    name,
    type: String(values.type ?? 'Supplier') as Partner['type'],
    contact: String(values.contact ?? ''),
    status: String(values.status ?? 'Active') as Partner['status'],
  }
  return upsert(draft.partners, row, id, `Partner saved: ${name}`)
}

function saveCampaign(draft: DB, values: Record<string, string | number>, name: string, id?: string): Mut {
  const budget = Number(values.budget)
  if (!Number.isFinite(budget) || budget < 0) return fail('Enter a campaign budget.')
  const row: Campaign = {
    id: id ?? uid('C'),
    name,
    channel: String(values.channel ?? 'Other') as Campaign['channel'],
    budget,
    status: String(values.status ?? 'Draft') as Campaign['status'],
  }
  return upsert(draft.campaigns, row, id, `Campaign saved: ${name}`)
}

function saveProcurement(draft: DB, values: Record<string, string | number>, name: string, id?: string): Mut {
  const budget = Number(values.budget)
  if (!Number.isFinite(budget) || budget < 0) return fail('Enter a budget.')
  const row: Procurement = {
    id: id ?? uid('PO'),
    name,
    supplier: String(values.supplier ?? ''),
    budget,
    status: String(values.status ?? 'Requested') as Procurement['status'],
  }
  return upsert(draft.procurement, row, id, `Procurement saved: ${name}`)
}

function upsert<T extends { id: string }>(list: T[], row: T, id: string | undefined, audit: string): Mut {
  if (id) {
    const index = list.findIndex((item) => item.id === id)
    if (index < 0) return fail('Record not found.')
    list[index] = row
    return ok(audit)
  }
  list.unshift(row)
  return ok(audit)
}

export function mutateSettings(draft: DB, session: Session, business: string, threshold: number): Mut {
  if (!can(session.role, 'settings.write')) return fail('Only the CEO can change workspace settings.')
  const name = business.trim()
  if (!name) return fail('Business name is required.')
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 365) return fail('Use a threshold between 1 and 365 days.')
  draft.settings.business = name
  draft.settings.threshold = Math.round(threshold)
  return ok(`Settings saved. Aging threshold is ${draft.settings.threshold} days.`)
}

export function captureInquiry(draft: DB, input: { name: string; contact: string; note: string; vehicleId: string; kind: string }): Mut {
  const name = input.name.trim()
  const contact = input.contact.trim()
  const note = input.note.trim()
  const kind = input.kind.trim() || 'Enquiry'
  if (name.length < 2) return fail('Enter your name.')
  if (contact.length < 3) return fail('Enter a phone number or email.')
  if (!note) return fail('Tell us what you need.')
  const vehicleId = draft.vehicles.some((vehicle) => vehicle.id === input.vehicleId) ? input.vehicleId : ''
  const key = contactKey(contact)
  let lead = draft.leads.find((item) => contactKey(item.contact) === key)
  if (lead) {
    lead.note = `${lead.note}\n${kind}: ${note}`.trim().slice(-2000)
    lead.due = todayISO()
    if (vehicleId) lead.vehicleId = vehicleId
  } else {
    lead = {
      id: uid('L'),
      name,
      contact,
      vehicleId,
      source: 'Marketplace',
      owner: namedRole(draft, 'sales') ?? 'CEO',
      stage: 'New',
      due: todayISO(),
      budget: 0,
      lostReason: '',
      note: `${kind}: ${note}`.slice(0, 2000),
    }
    draft.leads.unshift(lead)
  }
  const taskKey = `inquiry-${lead.id}`
  if (!draft.tasks.some((task) => task.key === taskKey && task.status === 'Open')) {
    draft.tasks.unshift({
      id: uid('T'),
      key: taskKey,
      title: `${kind}: ${name}`,
      owner: activeNames(draft).includes(lead.owner) ? lead.owner : 'CEO',
      due: todayISO(),
      status: 'Open',
    })
  }
  return ok(`Marketplace inquiry: ${kind}`)
}
