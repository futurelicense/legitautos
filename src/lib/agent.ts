import { money, stockAge, todayISO } from './format.ts'
import { agedVehicles, overdueTasks, verifiedCash } from './selectors.ts'
import type { DB } from './types.ts'

export function briefing(db: DB, today = todayISO()) {
  const aged = agedVehicles(db, today)
  const overdue = overdueTasks(db, today)
  const pending = db.money.filter((row) => row.status === 'Pending')
  const available = db.vehicles.filter((vehicle) => vehicle.status === 'Available').length
  const active = db.leads.filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost').length
  const net = verifiedCash(db, 'Inflow') - verifiedCash(db, 'Expense')
  return [
    `Executive briefing · ${today}`,
    `${available} vehicles available.`,
    `${active} active leads.`,
    `Verified receipts ${money(verifiedCash(db, 'Inflow'))}. Net cash movement ${money(net)}.`,
    pending.length ? `Pending review: ${pending.map((row) => row.id).join(', ')}.` : 'No transactions waiting for review.',
    overdue.length ? `Overdue tasks: ${overdue.map((task) => task.id).join(', ')}.` : 'No overdue tasks.',
    aged.length ? `Aged stock: ${aged.map((vehicle) => `${vehicle.id} ${vehicle.name}`).join('; ')}.` : 'No available vehicle is past the aging threshold.',
    'Deposits are cash movement, not recognized sales revenue.',
    'Recommended: review aged stock, follow up open leads, and verify pending transactions with a second person.',
  ].join('\n')
}

export function answerQuestion(db: DB, question: string, today = todayISO()) {
  const q = question.trim()
  if (/transfer|delete|disburse|approve payment|change price|mark sold|waive/i.test(q)) {
    return 'That action is restricted. The agent cannot transfer funds, delete records, approve payments, change prices, or mark a vehicle sold. Use Finance, Inventory, or Sales with the right role.'
  }
  if (/assign|remind|follow/i.test(q)) {
    return 'I can propose an automation scan for overdue leads, aged stock, and pending expenses. Confirm it on Automations. I will not message customers.'
  }
  if (/aging|aged|stock|inventory|vehicle/i.test(q)) {
    const lines = db.vehicles.map((vehicle) => {
      const age = stockAge(vehicle, today)
      const flag = vehicle.status === 'Available' && age > db.settings.threshold ? ' · review required' : ''
      return `${vehicle.id} ${vehicle.name}: ${vehicle.status}, ${age} days, ${money(vehicle.price)}${flag}`
    })
    return `Inventory as of ${today}:\n${lines.join('\n')}`
  }
  if (/finance|revenue|cash|profit|expense|payment/i.test(q)) {
    const pending = db.money.filter((row) => row.status === 'Pending')
    return [
      `Verified receipts: ${money(verifiedCash(db, 'Inflow'))}`,
      `Verified expenses: ${money(verifiedCash(db, 'Expense'))}`,
      `Net cash movement: ${money(verifiedCash(db, 'Inflow') - verifiedCash(db, 'Expense'))}`,
      `Pending review: ${pending.map((row) => `${row.id} ${row.ref}`).join(', ') || 'none'}`,
      'Deposits are cash movement, not recognized sales revenue. Accounting profit needs a delivered deal and its cost.',
    ].join('\n')
  }
  if (/staff|employee|task/i.test(q)) {
    return db.staff
      .map((person) => {
        const open = db.tasks.filter((task) => task.owner === person.name && task.status === 'Open').length
        return `${person.id} ${person.name} (${person.status}): ${open} open tasks`
      })
      .join('\n')
  }
  return briefing(db, today)
}
