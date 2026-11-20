import { money, moneyCompact, prettyDate, stockAge } from './format.ts'
import { balanceDue, vehicleName } from './selectors.ts'
import type { DB, Session, Task } from './types.ts'

export type DeskAction = {
  id: string
  title: string
  verb: string
  detail: string
  meta: string
  tone: 'now' | 'soon'
  href: string
  link: string
  taskId?: string
  moneyId?: string
  vehicleId?: string
  leadId?: string
  dealId?: string
}

export function deskActions(db: DB, session: Session, today: string): DeskAction[] {
  const role = session.role
  const tasks = session.role === 'CEO' ? db.tasks : db.tasks.filter((task) => task.owner === session.name)
  const used = new Set<string>()
  const take = (key: string) => {
    const task = tasks.find((item) => item.status === 'Open' && item.key === key)
    if (task) used.add(task.id)
    return task
  }
  const actions: DeskAction[] = []

  if (role === 'CEO' || role === 'Finance') {
    for (const row of db.money.filter((item) => item.status === 'Pending')) {
      const task = take(`finance-${row.id}`)
      const deal = db.deals.find((item) => item.id === row.dealId)
      actions.push({
        id: `money-${row.id}`,
        title: `${row.category} · ${moneyCompact(row.amount)}`,
        verb: `Verify ${row.ref}`,
        detail: task
          ? `${task.owner} is assigned. ${row.ref} is still waiting for a second reviewer.`
          : `${row.ref} was entered and is waiting for a second reviewer.`,
        meta: row.type,
        tone: 'now',
        href: `/app/finance?money=${row.id}`,
        link: 'Open the transaction',
        moneyId: row.id,
        taskId: task?.id,
        vehicleId: deal?.vehicleId,
        dealId: deal?.id,
      })
    }
  }

  if (role === 'CEO' || role === 'Sales') {
    const leads = role === 'CEO' ? db.leads : db.leads.filter((lead) => lead.owner === session.name)
    for (const lead of leads.filter((item) => item.stage !== 'Won' && item.stage !== 'Lost' && item.due <= today)) {
      const task = take(`lead-${lead.id}`)
      actions.push({
        id: `lead-${lead.id}`,
        title: lead.name,
        verb: task?.title ?? `Follow up with ${lead.name}`,
        detail: `${lead.stage} · ${vehicleName(db, lead.vehicleId)} · ${lead.owner} · due ${prettyDate(lead.due)}`,
        meta: lead.due < today ? 'Follow up' : 'Due today',
        tone: 'now',
        href: `/app/crm?lead=${lead.id}`,
        link: 'Open the lead',
        taskId: task?.id,
        vehicleId: lead.vehicleId,
        leadId: lead.id,
      })
    }
  }

  if (role === 'CEO' || role === 'Operations') {
    for (const vehicle of db.vehicles.filter((item) => item.status === 'Available')) {
      const missing = vehicle.price <= 0
      const hidden = !vehicle.published
      const age = stockAge(vehicle, today)
      const old = age > db.settings.threshold
      if (!missing && !hidden && !old) continue
      const task = take(`aging-${vehicle.id}`)
      const verb = missing ? `Record a price for ${vehicle.name}` : hidden ? `Decide the listing for ${vehicle.name}` : `Review the price of ${vehicle.name}`
      const extra = [
        missing ? 'No asking price is on the record.' : '',
        !missing && hidden ? 'It is available and still off the public floor.' : '',
        old ? `${age} days on the floor, past the ${db.settings.threshold}-day review.` : `${age} days on the floor.`,
        task ? `${task.owner} has the pricing task.` : '',
      ].filter(Boolean)
      actions.push({
        id: `stock-${vehicle.id}`,
        title: vehicle.name,
        verb: task && !missing && !hidden ? task.title : verb,
        detail: `${extra.join(' ')} ${vehicle.location}`.trim(),
        meta: missing ? 'Price' : hidden ? 'Unlisted' : 'Aging',
        tone: 'soon',
        href: `/app/inventory?vehicle=${vehicle.id}`,
        link: 'Open the vehicle',
        taskId: task?.id,
        vehicleId: vehicle.id,
      })
    }
  }

  if (role === 'CEO' || role === 'Sales') {
    const deals = role === 'CEO' ? db.deals : db.deals.filter((deal) => db.leads.some((lead) => lead.id === deal.leadId && lead.owner === session.name))
    for (const deal of deals.filter((item) => item.status === 'Reserved')) {
      const due = balanceDue(db, deal)
      actions.push({
        id: `deal-${deal.id}`,
        title: vehicleName(db, deal.vehicleId),
        verb: due > 0 ? `Collect ${moneyCompact(due)} still open on ${vehicleName(db, deal.vehicleId)}` : `Hand over ${vehicleName(db, deal.vehicleId)}`,
        detail: `${money(deal.paid)} received of ${money(deal.amount)}. ${vehicleName(db, deal.vehicleId)} stays reserved until handover.`,
        meta: 'Reserved',
        tone: 'soon',
        href: `/app/sales?deal=${deal.id}`,
        link: 'Open the reservation',
        vehicleId: deal.vehicleId,
        leadId: deal.leadId,
        dealId: deal.id,
      })
      if (!db.invoices.some((invoice) => invoice.dealId === deal.id && invoice.status === 'Issued')) {
        actions.push({
          id: `invoice-${deal.id}`,
          title: vehicleName(db, deal.vehicleId),
          verb: `Issue an invoice for ${vehicleName(db, deal.vehicleId)}`,
          detail: `The reservation is agreed at ${money(deal.amount)}. No invoice is on record yet.`,
          meta: 'Invoice',
          tone: 'soon',
          href: `/app/invoices?deal=${deal.id}`,
          link: 'Open invoices',
          vehicleId: deal.vehicleId,
          leadId: deal.leadId,
          dealId: deal.id,
        })
      }
    }
  }

  for (const task of tasks.filter((item) => item.status === 'Open' && item.due <= today && !used.has(item.id))) {
    actions.push(taskAction(task, today))
  }

  const rank = { now: 0, soon: 1 }
  return actions.sort((a, b) => rank[a.tone] - rank[b.tone])
}

function taskAction(task: Task, today: string): DeskAction {
  return {
    id: `task-${task.id}`,
    title: task.title,
    verb: task.title,
    detail: `${task.owner} · due ${prettyDate(task.due)}`,
    meta: task.due < today ? 'Overdue' : 'Today',
    tone: task.due < today ? 'now' : 'soon',
    href: `/app/tasks?task=${task.id}`,
    link: 'Open the task',
    taskId: task.id,
  }
}
