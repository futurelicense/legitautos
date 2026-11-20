export type Role = 'CEO' | 'Operations' | 'Sales' | 'Finance'

export type PageId =
  | 'overview'
  | 'inventory'
  | 'procurement'
  | 'crm'
  | 'sales'
  | 'invoices'
  | 'finance'
  | 'people'
  | 'tasks'
  | 'automations'
  | 'documents'
  | 'partners'
  | 'marketing'
  | 'reports'
  | 'agent'
  | 'settings'

export const MANUAL_STATUSES = ['Draft', 'Inspection', 'Ready', 'Available', 'Hold', 'Withdrawn'] as const
export type ManualStatus = (typeof MANUAL_STATUSES)[number]
export type VehicleStatus = ManualStatus | 'Reserved' | 'Sold'

export const BODY_TYPES = ['SUV', 'Sedan', 'Coupe', 'Pickup'] as const
export type BodyType = (typeof BODY_TYPES)[number]

export const CONDITIONS = ['Excellent', 'Good', 'Fair'] as const
export type Condition = (typeof CONDITIONS)[number]

export type Ownership = 'Company' | 'Consignment'
export type AgeFrom = 'acquisition' | 'availability'

export const LEAD_SOURCES = ['Marketplace', 'WhatsApp', 'Phone', 'Walk-in', 'Referral', 'Website'] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export const LEAD_FORM_STAGES = ['New', 'Contacted', 'Qualified', 'Inspection', 'Negotiation', 'Lost'] as const
export const PIPELINE_STAGES = ['New', 'Contacted', 'Qualified', 'Inspection', 'Negotiation', 'Won'] as const
export type LeadStage = (typeof LEAD_FORM_STAGES)[number] | 'Won'

export type DealStatus = 'Reserved' | 'Delivered' | 'Cancelled'
export type InvoiceStatus = 'Issued' | 'Void'
export type MoneyType = 'Inflow' | 'Expense'
export type MoneyStatus = 'Pending' | 'Verified' | 'Rejected'
export type TaskStatus = 'Open' | 'Done'

export const INQUIRIES = {
  inspection: 'Book an inspection',
  quote: 'Request a quote',
  offer: 'Make an offer',
  reservation: 'Reservation inquiry',
  'trade-in': 'Trade in your vehicle',
  finance: 'Financing inquiry',
  sourcing: 'Request a vehicle',
  contact: 'Contact the dealership',
} as const

export type InquiryKind = keyof typeof INQUIRIES

export type Vehicle = {
  id: string
  name: string
  year: number
  type: BodyType
  vin: string
  mileage: number
  condition: Condition
  location: string
  color: string
  cost: number
  price: number
  status: VehicleStatus
  owner: Ownership
  acquiredOn: string
  availableOn: string
  ageFrom: AgeFrom
  published: boolean
  priceApproved: boolean
  summary: string
  commissionNote: string
  image?: string
}

export type Lead = {
  id: string
  name: string
  contact: string
  vehicleId: string
  source: LeadSource
  owner: string
  stage: LeadStage
  due: string
  budget: number
  lostReason: string
  note: string
}

export type Deal = {
  id: string
  leadId: string
  vehicleId: string
  amount: number
  paid: number
  status: DealStatus
}

export type Invoice = {
  id: string
  number: string
  dealId: string
  issuedOn: string
  buyer: string
  contact: string
  vehicle: string
  amount: number
  status: InvoiceStatus
}

export type Money = {
  id: string
  type: MoneyType
  category: string
  amount: number
  status: MoneyStatus
  ref: string
  dealId: string
  createdBy: string
  reviewedBy: string
  date: string
}

export type Staff = {
  id: string
  name: string
  role: string
  status: 'Active' | 'Inactive'
  target: number
  email: string
}

export type Task = {
  id: string
  title: string
  owner: string
  due: string
  status: TaskStatus
  key?: string
}

export type Rule = {
  id: string
  name: string
  trigger: string
  enabled: boolean
}

export type Doc = {
  id: string
  name: string
  type: 'Vehicle' | 'Customer' | 'Finance' | 'Internal'
  reference: string
  status: 'Pending' | 'Verified' | 'Expired'
}

export type Partner = {
  id: string
  name: string
  type: 'Supplier' | 'Broker' | 'Dealer' | 'Finance partner'
  contact: string
  status: 'Active' | 'Inactive'
}

export type Campaign = {
  id: string
  name: string
  channel: 'Instagram' | 'WhatsApp' | 'Website' | 'Referral' | 'Other'
  budget: number
  status: 'Draft' | 'Active' | 'Closed'
}

export type Procurement = {
  id: string
  name: string
  supplier: string
  budget: number
  status: 'Requested' | 'Sourced' | 'Received' | 'Closed'
}

export type Audit = {
  id: string
  time: string
  action: string
  actor: string
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

export type Settings = {
  business: string
  threshold: number
}

export type DB = {
  version: 5
  vehicles: Vehicle[]
  leads: Lead[]
  deals: Deal[]
  invoices: Invoice[]
  money: Money[]
  staff: Staff[]
  tasks: Task[]
  rules: Rule[]
  docs: Doc[]
  partners: Partner[]
  campaigns: Campaign[]
  procurement: Procurement[]
  audit: Audit[]
  settings: Settings
  chat: ChatMessage[]
}

export type Session = {
  id: string
  name: string
  email: string
  role: Role
  staffId?: string
}

export type DemoUser = Session & { password: string }

export type Mut = { ok: true; audit: string } | { ok: false; error: string }

export type RecordBucket = 'docs' | 'partners' | 'campaigns' | 'procurement'
