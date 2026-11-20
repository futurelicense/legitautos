import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { can } from './lib/access.ts'
import { answerQuestion } from './lib/agent.ts'
import { todayISO, uid } from './lib/format.ts'
import {
  captureInquiry,
  mutateApprovePrice,
  mutateCancelDeal,
  mutateDeal,
  mutateDeliver,
  mutateIssueInvoice,
  mutateVoidInvoice,
  mutateLead,
  mutateMoney,
  mutatePayment,
  mutatePublish,
  mutateRecord,
  mutateReject,
  mutateReviseDeal,
  mutateRunRules,
  mutateSettings,
  mutateStaff,
  mutateTask,
  mutateToggleRule,
  mutateToggleTask,
  mutateVehicle,
  mutateVerify,
  type LeadInput,
  type VehicleInput,
} from './lib/mutations.ts'
import { isPublic } from './lib/selectors.ts'
import { createSeed, USERS } from './lib/seed.ts'
import type { DB, MoneyType, RecordBucket, Session } from './lib/types.ts'

const DB_KEY = 'legit-autoos-app-v1'
const SESSION_KEY = 'legit-autoos-session-v1'
const COMPARE_KEY = 'legit-autoos-compare'

type Toast = { id: string; text: string; tone: 'ok' | 'error' }
type ConfirmState = { title: string; body: string; onYes: () => void }

function loadDb(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; vehicles?: unknown; settings?: unknown; invoices?: DB['invoices'] }
      if ((parsed.version === 4 || parsed.version === 5) && Array.isArray(parsed.vehicles) && parsed.settings) {
        const next = parsed as DB
        if (!Array.isArray(next.invoices)) next.invoices = []
        if (next.settings?.business === 'Legit Luxury Naija Cars') next.settings.business = 'Legit Luxury NaijaCars'
        next.version = 5
        return next
      }
    }
  } catch {
    /* replace with a fresh sample workspace */
  }
  const fresh = createSeed()
  localStorage.setItem(DB_KEY, JSON.stringify(fresh))
  return fresh
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    const user = USERS.find((item) => item.id === parsed.id)
    if (!user) return null
    return { id: user.id, name: user.name, email: user.email, role: user.role, staffId: user.staffId }
  } catch {
    return null
  }
}

function loadCompare(): string[] {
  try {
    const raw = sessionStorage.getItem(COMPARE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDb)
  const [session, setSession] = useState<Session | null>(loadSession)
  const [toast, setToast] = useState<Toast | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>(loadCompare)
  const dbRef = useRef(db)
  const sessionRef = useRef(session)
  dbRef.current = db
  sessionRef.current = session

  const compare = useMemo(
    () =>
      compareIds.filter((id) => {
        const vehicle = db.vehicles.find((item) => item.id === id)
        return Boolean(vehicle && isPublic(vehicle))
      }),
    [compareIds, db.vehicles],
  )

  useEffect(() => {
    sessionStorage.setItem(COMPARE_KEY, JSON.stringify(compare))
  }, [compare])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!session?.staffId) return
    const staff = db.staff.find((person) => person.id === session.staffId)
    if (staff && staff.status === 'Active') return
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setToast({ id: uid('N'), text: 'This account is deactivated.', tone: 'error' })
  }, [db.staff, session])

  useEffect(() => {
    if (!confirm) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setConfirm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm])

  function notify(text: string, tone: 'ok' | 'error' = 'ok') {
    setToast({ id: uid('N'), text, tone })
  }

  function askConfirm(title: string, body: string, onYes: () => void) {
    setConfirm({ title, body, onYes })
  }

  function apply(run: (draft: DB, actor: Session) => { ok: true; audit: string } | { ok: false; error: string }) {
    const actor = sessionRef.current
    if (!actor) return 'Sign in to continue.'
    const next = structuredClone(dbRef.current)
    const result = run(next, actor)
    if (!result.ok) return result.error
    next.audit.unshift({
      id: uid('A'),
      time: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      action: result.audit,
      actor: actor.name,
    })
    next.audit = next.audit.slice(0, 100)
    dbRef.current = next
    localStorage.setItem(DB_KEY, JSON.stringify(next))
    setDb(next)
    return null
  }

  function login(email: string, password: string) {
    const user = USERS.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password)
    if (!user) return 'Those credentials do not match a demo account.'
    if (user.staffId) {
      const staff = dbRef.current.staff.find((person) => person.id === user.staffId)
      if (!staff || staff.status !== 'Active') return 'This account is deactivated.'
    }
    const next = { id: user.id, name: user.name, email: user.email, role: user.role, staffId: user.staffId }
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    setSession(next)
    return null
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  function toggleCompare(id: string) {
    if (compareIds.includes(id)) {
      setCompareIds(compareIds.filter((item) => item !== id))
      return
    }
    if (compare.length >= 3) {
      notify('Compare up to 3 vehicles.', 'error')
      return
    }
    setCompareIds([...compare, id])
  }

  function clearCompare() {
    setCompareIds([])
  }

  function saveVehicle(input: VehicleInput, id?: string) {
    return apply((draft, actor) => mutateVehicle(draft, actor, input, id))
  }
  function publishVehicle(id: string) {
    return apply((draft, actor) => mutatePublish(draft, actor, id))
  }
  function approvePrice(id: string) {
    return apply((draft, actor) => mutateApprovePrice(draft, actor, id))
  }
  function saveLead(input: LeadInput, id?: string) {
    return apply((draft, actor) => mutateLead(draft, actor, input, id))
  }
  function createDeal(input: { leadId: string; vehicleId: string; amount: number }) {
    return apply((draft, actor) => mutateDeal(draft, actor, input))
  }
  function reviseDeal(id: string, amount: number) {
    return apply((draft, actor) => mutateReviseDeal(draft, actor, id, amount))
  }
  function submitPayment(dealId: string, input: { amount: number; ref: string }) {
    return apply((draft, actor) => mutatePayment(draft, actor, dealId, input))
  }
  function verifyMoney(id: string) {
    return apply((draft, actor) => mutateVerify(draft, actor, id))
  }
  function rejectMoney(id: string) {
    return apply((draft, actor) => mutateReject(draft, actor, id))
  }
  function deliverDeal(id: string) {
    return apply((draft, actor) => mutateDeliver(draft, actor, id))
  }
  function issueInvoice(dealId: string) {
    return apply((draft, actor) => mutateIssueInvoice(draft, actor, dealId))
  }
  function voidInvoice(id: string) {
    return apply((draft, actor) => mutateVoidInvoice(draft, actor, id))
  }
  function cancelDeal(id: string) {
    return apply((draft, actor) => mutateCancelDeal(draft, actor, id))
  }
  function saveMoney(input: { type: MoneyType; category: string; amount: number; ref: string }) {
    return apply((draft, actor) => mutateMoney(draft, actor, input))
  }
  function saveStaff(input: { name: string; role: string; status: 'Active' | 'Inactive'; target: number; email: string }, id?: string) {
    return apply((draft, actor) => mutateStaff(draft, actor, input, id))
  }
  function saveTask(input: { title: string; owner: string; due: string }) {
    return apply((draft, actor) => mutateTask(draft, actor, input))
  }
  function toggleTask(id: string) {
    return apply((draft, actor) => mutateToggleTask(draft, actor, id))
  }
  function toggleRule(id: string) {
    return apply((draft, actor) => mutateToggleRule(draft, actor, id))
  }
  function runRules() {
    return apply((draft, actor) => mutateRunRules(draft, actor, todayISO()))
  }
  function saveRecord(bucket: RecordBucket, values: Record<string, string | number>, id?: string) {
    return apply((draft, actor) => mutateRecord(draft, actor, bucket, values, id))
  }
  function saveSettings(business: string, threshold: number) {
    return apply((draft, actor) => mutateSettings(draft, actor, business, threshold))
  }

  function inquiry(input: { name: string; contact: string; note: string; vehicleId: string; kind: string }) {
    const next = structuredClone(dbRef.current)
    const result = captureInquiry(next, input)
    if (!result.ok) return result.error
    next.audit.unshift({
      id: uid('A'),
      time: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      action: result.audit,
      actor: sessionRef.current?.name ?? 'Marketplace',
    })
    next.audit = next.audit.slice(0, 100)
    dbRef.current = next
    localStorage.setItem(DB_KEY, JSON.stringify(next))
    setDb(next)
    return null
  }

  function ask(question: string) {
    if (sessionRef.current?.role !== 'CEO') return 'The executive agent is limited to the CEO.'
    const text = question.trim()
    if (!text) return 'Enter a question.'
    const answer = answerQuestion(dbRef.current, text, todayISO())
    return apply((draft) => {
      draft.chat.push({ role: 'user', text }, { role: 'assistant', text: answer })
      draft.chat = draft.chat.slice(-40)
      return { ok: true, audit: 'Executive agent query' }
    })
  }

  function resetDemo() {
    const actor = sessionRef.current
    if (!actor || !can(actor.role, 'settings.write')) return 'Only the CEO can reset the demo.'
    const next = createSeed()
    next.audit.unshift({
      id: uid('A'),
      time: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      action: 'Demo data reset',
      actor: actor.name,
    })
    dbRef.current = next
    localStorage.setItem(DB_KEY, JSON.stringify(next))
    setDb(next)
    return null
  }

  const value = {
    db,
    session,
    compare,
    login,
    logout,
    notify,
    askConfirm,
    toggleCompare,
    clearCompare,
    saveVehicle,
    publishVehicle,
    approvePrice,
    saveLead,
    createDeal,
    reviseDeal,
    submitPayment,
    verifyMoney,
    rejectMoney,
    deliverDeal,
    cancelDeal,
    issueInvoice,
    voidInvoice,
    saveMoney,
    saveStaff,
    saveTask,
    toggleTask,
    toggleRule,
    runRules,
    saveRecord,
    saveSettings,
    inquiry,
    ask,
    resetDemo,
  }

  return (
    <AppContext.Provider value={value}>
      {children}
      {toast && (
        <div className={toast.tone === 'error' ? 'toast error' : 'toast'} role="status">
          {toast.text}
        </div>
      )}
      {confirm && (
        <div className="modal-back" onMouseDown={() => setConfirm(null)}>
          <div
            className="modal confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-title">{confirm.title}</h2>
            <p>{confirm.body}</p>
            <div className="actions">
              <button className="btn ghost" type="button" onClick={() => setConfirm(null)}>
                Back
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  const run = confirm.onYes
                  setConfirm(null)
                  run()
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  )
}

type AppContextValue = {
  db: DB
  session: Session | null
  compare: string[]
  login: (email: string, password: string) => string | null
  logout: () => void
  notify: (text: string, tone?: 'ok' | 'error') => void
  askConfirm: (title: string, body: string, onYes: () => void) => void
  toggleCompare: (id: string) => void
  clearCompare: () => void
  saveVehicle: (input: VehicleInput, id?: string) => string | null
  publishVehicle: (id: string) => string | null
  approvePrice: (id: string) => string | null
  saveLead: (input: LeadInput, id?: string) => string | null
  createDeal: (input: { leadId: string; vehicleId: string; amount: number }) => string | null
  reviseDeal: (id: string, amount: number) => string | null
  submitPayment: (dealId: string, input: { amount: number; ref: string }) => string | null
  verifyMoney: (id: string) => string | null
  rejectMoney: (id: string) => string | null
  deliverDeal: (id: string) => string | null
  cancelDeal: (id: string) => string | null
  issueInvoice: (dealId: string) => string | null
  voidInvoice: (id: string) => string | null
  saveMoney: (input: { type: MoneyType; category: string; amount: number; ref: string }) => string | null
  saveStaff: (input: { name: string; role: string; status: 'Active' | 'Inactive'; target: number; email: string }, id?: string) => string | null
  saveTask: (input: { title: string; owner: string; due: string }) => string | null
  toggleTask: (id: string) => string | null
  toggleRule: (id: string) => string | null
  runRules: () => string | null
  saveRecord: (bucket: RecordBucket, values: Record<string, string | number>, id?: string) => string | null
  saveSettings: (business: string, threshold: number) => string | null
  inquiry: (input: { name: string; contact: string; note: string; vehicleId: string; kind: string }) => string | null
  ask: (question: string) => string | null
  resetDemo: () => string | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
