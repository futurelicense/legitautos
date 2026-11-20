import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarList, Lens, LensGrid, StackBar } from '../../components/Insight.tsx'
import { can, canSee } from '../../lib/access.ts'
import { deskActions } from '../../lib/desk.ts'
import { greeting, modelYear, money, moneyCompact, stockAge, todayISO } from '../../lib/format.ts'
import { askingSum, tally } from '../../lib/picture.ts'
import { openLeadCount, vehicleName, verifiedCash, visibleLeads, visibleTasks } from '../../lib/selectors.ts'
import { PIPELINE_STAGES, type LeadStage } from '../../lib/types.ts'
import { useApp } from '../../store.tsx'

export function OverviewPage() {
  const { db, session, toggleTask, verifyMoney, rejectMoney, notify, askConfirm } = useApp()
  const [carId, setCarId] = useState('')
  const [moveId, setMoveId] = useState('')
  const [stage, setStage] = useState<LeadStage | ''>('')
  const [statusCut, setStatusCut] = useState('')
  const today = todayISO()
  const role = session?.role
  const leads = session && (role === 'Sales' || role === 'CEO') ? visibleLeads(db, session) : []
  const tasks = session ? visibleTasks(db, session) : []
  const yard = db.vehicles
  const openLeads = leads.filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost')
  const moves = session ? deskActions(db, session, today) : []
  const shown = moves.filter((move) => {
    if (statusCut) {
      const vehicle = yard.find((item) => item.id === move.vehicleId)
      if (!vehicle || vehicle.status !== statusCut) return false
    }
    if (stage) {
      const lead = db.leads.find((item) => item.id === move.leadId)
      if (!lead || lead.stage !== stage) return false
    }
    return true
  })
  const selectedMove = moveId === 'none' ? undefined : (shown.find((move) => move.id === moveId) ?? shown[0])
  const selectedCar = yard.find((vehicle) => vehicle.id === carId)
  const carMove = selectedMove?.vehicleId === selectedCar?.id ? selectedMove : moves.find((move) => move.vehicleId === selectedCar?.id)
  const cut = [statusCut, stage].filter(Boolean).join(' · ')
  const lede =
    shown.length === 0
      ? cut
        ? `Nothing in ${cut} needs a decision.`
        : 'The desk is clear. The floor, the pipeline, and the cash book are quiet.'
      : `${shown.length} ${shown.length === 1 ? 'action is' : 'actions are'} ${cut ? `in ${cut}` : 'on this desk'}. Next: ${shown[0].verb}.`

  useEffect(() => {
    if (!selectedMove) return
    setCarId(selectedMove.vehicleId ?? '')
  }, [selectedMove?.id, selectedMove?.vehicleId])

  useEffect(() => {
    const node = document.getElementById(`yard-${selectedCar?.id ?? ''}`)
    const rail = node?.parentElement
    if (!node || !rail) return
    rail.scrollTo({ left: node.offsetLeft - rail.clientWidth / 2 + node.clientWidth / 2 })
  }, [selectedCar?.id])

  function pickCar(id: string) {
    setCarId(id)
    const related = shown.find((move) => move.vehicleId === id)
    setMoveId(related?.id ?? 'none')
  }

  function stepCar(direction: number) {
    if (!selectedCar) return
    const index = yard.findIndex((vehicle) => vehicle.id === selectedCar.id)
    const next = yard[(index + direction + yard.length) % yard.length]
    if (next) pickCar(next.id)
  }

  function finishTask(id: string) {
    const error = toggleTask(id)
    notify(error ?? 'Task completed', error ? 'error' : 'ok')
  }

  if (!session || !role) return null

  return (
    <div className="desk">
      <header className="desk-intro">
        <div>
          <p className="eyebrow">{role} desk</p>
          <h1>{greeting(session.name)}</h1>
          <p>{lede}</p>
        </div>
        <div className="desk-counts" aria-label="Desk counts">
          <Count label="Actions" value={String(shown.length)} />
          <Count label="On the floor" value={String(yard.filter((vehicle) => vehicle.status === 'Available').length)} />
          {(role === 'CEO' || role === 'Sales') && <Count label="Open leads" value={String(openLeadCount(leads))} />}
          <Count label="Open tasks" value={String(tasks.filter((task) => task.status === 'Open').length)} />
          {role === 'CEO' && (
            <Link className="btn gold small" to="/app/agent">
              Briefing
            </Link>
          )}
        </div>
      </header>

      <LensGrid>
        <Lens title="Stock by status" note="Select a status to show the actions for those vehicles.">
          <BarList
            active={statusCut}
            onPick={(id) => {
              setStatusCut(id)
              setMoveId('')
            }}
            items={tally(yard.map((vehicle) => vehicle.status))
              .sort((a, b) => b.value - a.value)
              .map((item) => ({ ...item, display: String(item.value) }))}
          />
        </Lens>
        <Lens title="Asking price, available only" note="Blank prices are excluded. Consignment figures are not revenue.">
          <BarList
            items={tally(yard.filter((vehicle) => vehicle.status === 'Available').map((vehicle) => vehicle.type))
              .map((item) => {
                const group = yard.filter((vehicle) => vehicle.status === 'Available' && vehicle.type === item.label)
                const sum = askingSum(group)
                return { ...item, value: sum, display: sum > 0 ? moneyCompact(sum) : 'Not stated' }
              })
              .sort((a, b) => b.value - a.value)}
          />
        </Lens>
        {(role === 'CEO' || role === 'Finance') && (
          <Lens title="Verified cash" note="Receipts and expenses a second person has confirmed.">
            <StackBar
              parts={[
                { id: 'in', label: 'Inflow', value: verifiedCash(db, 'Inflow'), display: moneyCompact(verifiedCash(db, 'Inflow')) },
                { id: 'out', label: 'Outflow', value: verifiedCash(db, 'Expense'), display: moneyCompact(verifiedCash(db, 'Expense')) },
              ]}
            />
          </Lens>
        )}
        {(role === 'CEO' || role === 'Sales') && (
          <Lens title="Open pipeline" note="Select a stage to show the actions for those leads.">
            <BarList
              active={stage}
              onPick={(id) => {
                setStage((id || '') as LeadStage | '')
                setMoveId('')
              }}
              items={PIPELINE_STAGES.map((label) => ({
                id: label,
                label,
                value: openLeads.filter((lead) => lead.stage === label).length,
                display: String(openLeads.filter((lead) => lead.stage === label).length),
              }))}
            />
          </Lens>
        )}
      </LensGrid>

      <div className="desk-main">
        <section className="yard" aria-label="Yard">
          <div className="desk-label">
            <span>The yard</span>
            <b>
              {selectedCar ? yard.findIndex((vehicle) => vehicle.id === selectedCar.id) + 1 : 0} / {yard.length}
            </b>
          </div>
          <div
            className="yard-rail"
            tabIndex={0}
            role="listbox"
            aria-label="Vehicles on the yard"
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') stepCar(1)
              if (event.key === 'ArrowLeft') stepCar(-1)
            }}
          >
            {yard.map((vehicle) => (
              <button
                id={`yard-${vehicle.id}`}
                key={vehicle.id}
                type="button"
                role="option"
                aria-selected={vehicle.id === selectedCar?.id}
                className={[vehicle.id === selectedCar?.id ? 'yard-tile on' : 'yard-tile', statusCut && vehicle.status !== statusCut ? 'dim' : ''].filter(Boolean).join(' ')}
                onClick={() => pickCar(vehicle.id)}
              >
                {vehicle.image ? <img src={vehicle.image} alt="" /> : <i style={{ background: vehicle.color }} />}
                <strong>{vehicle.name}</strong>
                <small>{vehicle.status}</small>
              </button>
            ))}
          </div>
          {selectedCar ? (
            <article className="yard-detail">
              <div>
                <h2>{selectedCar.name}</h2>
                <p>
                  {modelYear(selectedCar.year)} · {selectedCar.type} · {selectedCar.location}
                </p>
                <p className="yard-price">{selectedCar.price > 0 ? money(selectedCar.price) : 'Price not stated'}</p>
                {carMove && <p>{carMove.verb}</p>}
              </div>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{selectedCar.status}</dd>
                </div>
                <div>
                  <dt>Days here</dt>
                  <dd>{stockAge(selectedCar, today)}</dd>
                </div>
                <div>
                  <dt>Holding</dt>
                  <dd>{selectedCar.owner}</dd>
                </div>
                <div>
                  <dt>Catalogue</dt>
                  <dd>{selectedCar.published && selectedCar.status === 'Available' ? 'Listed' : 'Hidden'}</dd>
                </div>
              </dl>
              {canSee(role, 'inventory') && (
                <Link className="btn gold" to={carMove?.href ?? `/app/inventory?vehicle=${selectedCar.id}`}>
                  {carMove?.link ?? 'Open in inventory'}
                </Link>
              )}
            </article>
          ) : (
            <p className="yard-detail">This step is not a vehicle. The action beside it is the next decision.</p>
          )}
        </section>

        <section className="moves" aria-label="Work on this desk">
          <div className="desk-label">
            <span>Needs a hand</span>
            <b>{shown.length}</b>
          </div>
          {shown.length === 0 && <p className="muted">{cut ? 'Nothing in this cut needs a decision.' : 'Nothing is waiting on this desk.'}</p>}
          <div className="move-list">
            {(['now', 'soon'] as const).map((tone) => {
              const group = shown.filter((move) => move.tone === tone)
              if (group.length === 0) return null
              return (
                <div key={tone}>
                  <p className="move-kicker">{tone === 'now' ? 'Do this now' : 'Keep the floor moving'}</p>
                  {group.map((move) => (
                    <button
                      key={move.id}
                      type="button"
                      className={selectedMove?.id === move.id ? 'move on' : 'move'}
                      onClick={() => setMoveId(move.id)}
                    >
                      <em>{move.meta}</em>
                      <strong>{move.verb}</strong>
                      <small>{move.detail}</small>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
          {selectedMove && (
            <div className="move-act">
              <p>{selectedMove.detail}</p>
              <div className="actions">
                {selectedMove.taskId && can(role, 'task.write') && (
                  <button className="btn gold small" type="button" onClick={() => finishTask(selectedMove.taskId ?? '')}>
                    Mark done
                  </button>
                )}
                {selectedMove.moneyId && can(role, 'payment.verify') && (
                  <>
                    <button
                      className="btn gold small"
                      type="button"
                      onClick={() =>
                        askConfirm('Verify this entry', 'Confirm you are the second reviewer and the evidence matches the amount.', () => {
                          const error = verifyMoney(selectedMove.moneyId ?? '')
                          notify(error ?? 'Entry verified', error ? 'error' : 'ok')
                        })
                      }
                    >
                      Verify
                    </button>
                    <button
                      className="btn ghost small"
                      type="button"
                      onClick={() =>
                        askConfirm('Reject this entry', 'The amount will not be added to a deal.', () => {
                          const error = rejectMoney(selectedMove.moneyId ?? '')
                          notify(error ?? 'Entry rejected', error ? 'error' : 'ok')
                        })
                      }
                    >
                      Reject
                    </button>
                  </>
                )}
                <Link className="btn ghost small" to={selectedMove.href}>
                  {selectedMove.link}
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>

      {openLeads.length > 0 && (
        <section className="board" aria-label="Pipeline">
          <div className="desk-label">
            <span>{role === 'Sales' ? 'Your pipeline' : 'Pipeline'}</span>
            <b>{openLeads.length} open</b>
          </div>
          <div className="board-row">
            {PIPELINE_STAGES.map((name) => {
              const group = openLeads.filter((lead) => lead.stage === name)
              const on = stage === name
              return (
                <div key={name} className={on ? 'board-col on' : 'board-col'}>
                  <button
                    type="button"
                    onClick={() => {
                      setStage(on ? '' : name)
                      setMoveId('')
                    }}
                  >
                    <b>{group.length}</b>
                    {name}
                  </button>
                  {group.map((lead) => (
                    <Link key={lead.id} to={`/app/crm?lead=${lead.id}`}>
                      <strong>{lead.name}</strong>
                      <small>{vehicleName(db, lead.vehicleId)}</small>
                    </Link>
                  ))}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function Count({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}
