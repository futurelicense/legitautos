import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { saved } from '../../components/ui.tsx'
import { money, prettyDate, stockAge, todayISO } from '../../lib/format.ts'
import { automationMatches } from '../../lib/mutations.ts'
import { useApp } from '../../store.tsx'

const STEPS = ['Leads', 'Stock', 'Money']

export function AutomationsPage() {
  const { db, toggleRule, runRules, notify } = useApp()
  const today = todayISO()
  const matches = automationMatches(db, today)
  const [step, setStep] = useState(-1)
  const [line, setLine] = useState('The agent is watching the floor. A scan opens internal tasks only.')
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  function ruleOn(id: string) {
    return db.rules.find((rule) => rule.id === id)?.enabled ?? false
  }

  function taskFor(key: string) {
    return db.tasks.find((task) => task.key === key)
  }

  function finish() {
    const waiting = automationMatches(db, todayISO()).filter(
      (hit) => ruleOn(hit.ruleId) && !db.tasks.some((task) => task.key === hit.key),
    )
    const error = runRules()
    const spoken =
      waiting.length === 0
        ? 'Nothing new. Existing tasks stay as they are.'
        : `The scan opened ${waiting.length} ${waiting.length === 1 ? 'task' : 'tasks'}.`
    saved(error, notify, spoken)
    setStep(-1)
    setLine(error ?? spoken)
  }

  function scan() {
    if (step >= 0) return
    timers.current.forEach((id) => window.clearTimeout(id))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish()
      return
    }
    const lines = [
      'Reading leads whose follow-up date has passed.',
      'Reading cars that have been available past the aging threshold.',
      'Reading payments that still need a second reviewer.',
    ]
    setStep(0)
    setLine(lines[0] ?? '')
    timers.current = [
      window.setTimeout(() => {
        setStep(1)
        setLine(lines[1] ?? '')
      }, 800),
      window.setTimeout(() => {
        setStep(2)
        setLine(lines[2] ?? '')
      }, 1600),
      window.setTimeout(() => finish(), 2300),
    ]
  }

  const openLeads = db.leads
    .filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost')
    .sort((a, b) => a.due.localeCompare(b.due))
  const available = [...db.vehicles]
    .filter((vehicle) => vehicle.status === 'Available')
    .sort((a, b) => stockAge(b, today) - stockAge(a, today))
  const moneyRows = [...db.money].sort((a, b) => Number(b.status === 'Pending') - Number(a.status === 'Pending'))
  const history = db.audit.filter((entry) => entry.action.startsWith('Automation') || entry.action.startsWith('Rule '))

  return (
    <div className="eye">
      <header className="eye-top">
        <div>
          <p className="eyebrow">CEO view</p>
          <h1>Workflow automation</h1>
          <p>Three rules watch the floor. A scan opens an internal task for a person. It does not text a customer or post a payment.</p>
        </div>
        <button className="btn gold" type="button" disabled={step >= 0} onClick={scan}>
          {step >= 0 ? 'Agent in motion' : 'Run the agent'}
        </button>
      </header>

      <section className="eye-agent" aria-live="polite">
        <img src="/brand/legit-logo.jpg" alt="" />
        <div>
          <div className="eye-trace">
            {STEPS.map((label, index) => (
              <span key={label} className={step === index ? 'on' : ''}>
                {label}
              </span>
            ))}
          </div>
          <p>{line}</p>
        </div>
      </section>

      <div className="eye-board">
        <Lane
          index="01"
          live={step === 0}
          rule={db.rules.find((rule) => rule.id === 'R-001')}
          onToggle={(id) => saved(toggleRule(id), notify, 'Rule updated')}
          aside={
            db.leads.filter((lead) => lead.stage === 'Won' || lead.stage === 'Lost').length === 0
              ? 'Won and lost leads stay outside this rule.'
              : `${db.leads.filter((lead) => lead.stage === 'Won' || lead.stage === 'Lost').length} closed leads stay outside this rule.`
          }
        >
          {openLeads.map((lead) => {
            const hit = matches.find((item) => item.ruleId === 'R-001' && item.recordId === lead.id)
            const task = hit ? taskFor(hit.key) : undefined
            const vehicle = db.vehicles.find((item) => item.id === lead.vehicleId)
            return (
              <Signal
                key={lead.id}
                href={`/app/crm?lead=${lead.id}`}
                title={lead.name}
                detail={`${lead.stage} · ${vehicle?.name ?? 'No vehicle'} · due ${prettyDate(lead.due)}`}
                state={stateFor(Boolean(hit), ruleOn('R-001'), task?.status, task?.owner, hit?.owner)}
                hot={Boolean(hit) && !task && ruleOn('R-001')}
              />
            )
          })}
        </Lane>

        <Lane
          index="02"
          live={step === 1}
          rule={db.rules.find((rule) => rule.id === 'R-002')}
          onToggle={(id) => saved(toggleRule(id), notify, 'Rule updated')}
          aside={`${db.vehicles.filter((vehicle) => vehicle.status !== 'Available').length} vehicles are not available. This rule does not watch them.`}
        >
          {available.map((vehicle) => {
            const hit = matches.find((item) => item.ruleId === 'R-002' && item.recordId === vehicle.id)
            const task = hit ? taskFor(hit.key) : undefined
            const age = stockAge(vehicle, today)
            return (
              <Signal
                key={vehicle.id}
                href={`/app/inventory?vehicle=${vehicle.id}`}
                title={vehicle.name}
                detail={`${age} days available · threshold ${db.settings.threshold} days`}
                state={stateFor(Boolean(hit), ruleOn('R-002'), task?.status, task?.owner, hit?.owner)}
                hot={Boolean(hit) && !task && ruleOn('R-002')}
              />
            )
          })}
        </Lane>

        <Lane
          index="03"
          live={step === 2}
          rule={db.rules.find((rule) => rule.id === 'R-003')}
          onToggle={(id) => saved(toggleRule(id), notify, 'Rule updated')}
          aside="Verified and rejected lines stay on the board so the whole cash path is visible. Only a pending line can open a task."
        >
          {moneyRows.map((row) => {
            const hit = matches.find((item) => item.ruleId === 'R-003' && item.recordId === row.id)
            const task = hit ? taskFor(hit.key) : undefined
            return (
              <Signal
                key={row.id}
                href={`/app/finance?money=${row.id}`}
                title={row.ref || row.category}
                detail={`${row.type} · ${money(row.amount)} · ${row.status}`}
                state={hit ? stateFor(true, ruleOn('R-003'), task?.status, task?.owner, hit.owner) : row.status}
                hot={Boolean(hit) && !task && ruleOn('R-003')}
              />
            )
          })}
        </Lane>
      </div>

      <section className="eye-log">
        <h2>What the scans have written</h2>
        {history.length === 0 && <p>No scan has been run in this browser yet.</p>}
        {history.map((entry) => (
          <div key={entry.id}>
            <span>{entry.action}</span>
            <small>
              {entry.actor} · {entry.time}
            </small>
          </div>
        ))}
      </section>
    </div>
  )
}

function stateFor(matched: boolean, enabled: boolean, taskStatus: string | undefined, taskOwner: string | undefined, nextOwner: string | undefined) {
  if (!matched) return 'Inside the window'
  if (taskStatus === 'Open') return `Task open with ${taskOwner}`
  if (taskStatus === 'Done') return `Task closed with ${taskOwner}`
  if (!enabled) return 'Rule is off'
  return `Next scan opens a task for ${nextOwner}`
}

function Lane({
  index,
  live,
  rule,
  onToggle,
  aside,
  children,
}: {
  index: string
  live: boolean
  rule: { id: string; name: string; trigger: string; enabled: boolean } | undefined
  onToggle: (id: string) => void
  aside: string
  children: ReactNode
}) {
  if (!rule) return null
  return (
    <article className={live ? 'eye-lane live' : rule.enabled ? 'eye-lane' : 'eye-lane off'}>
      <header>
        <b>{index}</b>
        <div>
          <h2>{rule.name}</h2>
          <p>{rule.trigger}</p>
        </div>
        <button className={rule.enabled ? 'btn small gold' : 'btn small ghost'} type="button" onClick={() => onToggle(rule.id)}>
          {rule.enabled ? 'On' : 'Off'}
        </button>
      </header>
      <div className="eye-signals">{children}</div>
      <p className="eye-aside">{aside}</p>
    </article>
  )
}

function Signal({ href, title, detail, state, hot }: { href: string; title: string; detail: string; state: string; hot: boolean }) {
  return (
    <Link className={hot ? 'eye-signal hot' : 'eye-signal'} to={href}>
      <strong>{title}</strong>
      <span>{detail}</span>
      <em>{state}</em>
    </Link>
  )
}
