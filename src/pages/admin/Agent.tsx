import { useEffect, useRef, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BarList, Lens, StackBar } from '../../components/Insight.tsx'
import { PageHead, saved } from '../../components/ui.tsx'
import { briefing } from '../../lib/agent.ts'
import { money, stockAge, todayISO } from '../../lib/format.ts'
import { agedVehicles, verifiedCash } from '../../lib/selectors.ts'
import { useApp } from '../../store.tsx'

const PROMPTS = ['Show aging inventory', 'Summarize cash flow', 'Review staff tasks', 'Assign overdue follow-ups']

export function AgentPage() {
  const { db, ask, runRules, notify } = useApp()
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo(0, scroller.current.scrollHeight)
  }, [db.chat.length])

  function send(question: string) {
    const error = ask(question)
    if (error) notify(error, 'error')
  }

  return (
    <>
      <PageHead title="Legit AI" lede="Answers are calculated from this workspace. The agent cannot move money, delete records, or change a price." />
      <div className="lens-grid two">
        <div className="stack">
          <Lens title="What the briefing is looking at" note="Select a bar to ask about that cut. The answer is calculated from this workspace.">
            <BarList
              onPick={(id) => {
                const vehicle = db.vehicles.find((item) => item.id === id)
                if (vehicle) send(`Show aging inventory for ${vehicle.name}`)
              }}
              items={agedVehicles(db, todayISO()).map((vehicle) => ({
                id: vehicle.id,
                label: vehicle.name,
                value: stockAge(vehicle, todayISO()),
                display: `${stockAge(vehicle, todayISO())} days`,
              }))}
            />
            {agedVehicles(db, todayISO()).length === 0 && <p className="lens-empty">No available vehicle is past {db.settings.threshold} days.</p>}
          </Lens>
          <Lens title="Verified cash">
            <StackBar
              parts={[
                { id: 'in', label: 'Inflow', value: verifiedCash(db, 'Inflow'), display: money(verifiedCash(db, 'Inflow')) },
                { id: 'out', label: 'Outflow', value: verifiedCash(db, 'Expense'), display: money(verifiedCash(db, 'Expense')) },
              ]}
            />
            <button className="btn gold small" type="button" style={{ marginTop: 12 }} onClick={() => send('Summarize cash flow')}>
              Ask about cash
            </button>
          </Lens>
          <Lens title="Open tasks by person">
            <BarList
              onPick={(id) => {
                const person = db.staff.find((item) => item.id === id)
                if (person) send(`Review staff tasks for ${person.name}`)
              }}
              items={db.staff.map((person) => {
                const value = db.tasks.filter((task) => task.owner === person.name && task.status === 'Open').length
                return { id: person.id, label: person.name, value, display: String(value) }
              })}
            />
          </Lens>
        </div>
        <section className="card">
          <div className="page-head">
            <h2>Executive conversation</h2>
            <span className="badge">Workspace data</span>
          </div>
          <div className="chat" id="chat" ref={scroller}>
            <div className="bubble">{briefing(db, todayISO())}</div>
            {db.chat.map((message, index) => (
              <div className={message.role === 'user' ? 'bubble user' : 'bubble'} key={`${message.role}-${index}`}>
                {message.text}
              </div>
            ))}
          </div>
          <form
            className="toolbar"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const question = String(new FormData(event.currentTarget).get('q') ?? '')
              send(question)
              event.currentTarget.reset()
            }}
          >
            <input name="q" required placeholder="Ask about cash, inventory, or staff" aria-label="Question" />
            <button className="btn primary" type="submit">
              Send
            </button>
          </form>
          <div className="prompts">
            {PROMPTS.map((prompt) => (
              <button key={prompt} className="btn small ghost" type="button" onClick={() => send(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
          <h2>Controlled actions</h2>
          <p className="muted">A scan proposes internal tasks. It does not send WhatsApp, email, or a payment.</p>
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              const error = runRules()
              saved(error, notify, 'Automation scan finished')
            }}
          >
            Confirm automation scan
          </button>
          <p style={{ marginTop: 10 }}>
            <Link to="/app/automations">Review the rules first</Link>
          </p>
          <h2 style={{ marginTop: 22 }}>Action safeguards</h2>
          <p className="check">Human review for finance</p>
          <p className="check">No fund transfers</p>
          <p className="check">Every question is written to the audit</p>
          <p className="check">No destructive actions</p>
        </section>
    </>
  )
}
