import type { PageId, Role } from './types.ts'

const ACCESS: Record<PageId, Role[]> = {
  overview: ['CEO', 'Operations', 'Sales', 'Finance'],
  inventory: ['CEO', 'Operations'],
  procurement: ['CEO', 'Operations'],
  crm: ['CEO', 'Sales'],
  sales: ['CEO', 'Sales'],
  invoices: ['CEO', 'Sales', 'Finance'],
  finance: ['CEO', 'Finance'],
  people: ['CEO'],
  tasks: ['CEO', 'Operations', 'Sales', 'Finance'],
  automations: ['CEO'],
  documents: ['CEO', 'Operations'],
  partners: ['CEO', 'Operations'],
  marketing: ['CEO'],
  reports: ['CEO', 'Finance'],
  agent: ['CEO'],
  settings: ['CEO'],
}

export const PAGE_LABEL: Record<PageId, string> = {
  overview: 'Overview',
  inventory: 'Vehicle inventory',
  procurement: 'Procurement',
  crm: 'Customer relationships',
  sales: 'Sales and reservations',
  invoices: 'Invoices',
  finance: 'Financial operations',
  people: 'People and performance',
  tasks: 'Tasks',
  automations: 'Automations',
  documents: 'Documents',
  partners: 'Partners',
  marketing: 'Marketing',
  reports: 'Business intelligence',
  agent: 'Legit AI',
  settings: 'Settings',
}

const GROUPS: { group: string; ids: PageId[] }[] = [
  { group: 'Workspace', ids: ['overview', 'inventory', 'procurement', 'crm', 'sales', 'invoices'] },
  { group: 'Business', ids: ['finance', 'people', 'tasks', 'automations', 'documents', 'partners', 'marketing'] },
  { group: 'Intelligence', ids: ['reports', 'agent', 'settings'] },
]

export type Ability =
  | 'vehicle.write'
  | 'vehicle.publish'
  | 'vehicle.approvePrice'
  | 'lead.write'
  | 'deal.create'
  | 'deal.deliver'
  | 'deal.cancel'
  | 'invoice.issue'
  | 'invoice.void'
  | 'payment.submit'
  | 'payment.verify'
  | 'money.write'
  | 'staff.write'
  | 'task.write'
  | 'rules.run'
  | 'settings.write'
  | 'ops.records'
  | 'marketing.write'

const ABILITY: Record<Ability, Role[]> = {
  'vehicle.write': ['CEO', 'Operations'],
  'vehicle.publish': ['CEO', 'Operations'],
  'vehicle.approvePrice': ['CEO'],
  'lead.write': ['CEO', 'Sales'],
  'deal.create': ['CEO', 'Sales'],
  'deal.deliver': ['CEO', 'Sales'],
  'deal.cancel': ['CEO', 'Sales'],
  'invoice.issue': ['CEO', 'Sales'],
  'invoice.void': ['CEO', 'Sales'],
  'payment.submit': ['CEO', 'Sales', 'Finance'],
  'payment.verify': ['CEO', 'Finance'],
  'money.write': ['CEO', 'Finance'],
  'staff.write': ['CEO'],
  'task.write': ['CEO', 'Operations', 'Sales', 'Finance'],
  'rules.run': ['CEO'],
  'settings.write': ['CEO'],
  'ops.records': ['CEO', 'Operations'],
  'marketing.write': ['CEO'],
}

export function canSee(role: Role, page: PageId) {
  return ACCESS[page].includes(role)
}

export function can(role: Role, ability: Ability) {
  return ABILITY[ability].includes(role)
}

export function navigation(role: Role) {
  return GROUPS.map((group) => ({
    group: group.group,
    items: group.ids.filter((id) => canSee(role, id)).map((id) => ({ id, label: PAGE_LABEL[id] })),
  })).filter((group) => group.items.length > 0)
}
