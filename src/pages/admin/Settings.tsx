import { type FormEvent } from 'react'
import { PageHead, saved } from '../../components/ui.tsx'
import { useApp } from '../../store.tsx'

export function SettingsPage() {
  const { db, saveSettings, resetDemo, notify, askConfirm } = useApp()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const error = saveSettings(String(data.get('business') ?? ''), Number(data.get('threshold')))
    saved(error, notify, 'Settings saved')
  }

  return (
    <>
      <PageHead title="Workspace settings" lede="Demo preferences for this browser. Reset restores the sample dealership." />
      <div className="split">
        <section className="card">
          <h2>Configuration</h2>
          <form key={`${db.settings.business}-${db.settings.threshold}`} onSubmit={onSubmit}>
            <div className="form-grid">
              <label className="field">
                <span>Business name</span>
                <input name="business" defaultValue={db.settings.business} required />
              </label>
              <label className="field">
                <span>Stock aging threshold (days)</span>
                <input name="threshold" type="number" min={1} max={365} defaultValue={db.settings.threshold} required />
              </label>
            </div>
            <button className="btn primary" type="submit">
              Save settings
            </button>
          </form>
          <p className="muted" style={{ margin: '14px 0' }}>
            Records stay in this browser. There is no production password store and no multi-branch tenancy yet.
          </p>
          <button
            className="btn danger"
            type="button"
            onClick={() =>
              askConfirm('Reset sample data', 'This replaces inventory, leads, deals, and tasks with the original demo.', () => {
                const error = resetDemo()
                saved(error, notify, 'Sample data restored')
              })
            }
          >
            Reset sample data
          </button>
        </section>
        <section className="card">
          <h2>Audit activity</h2>
          {db.audit.length === 0 && <p className="muted">No audit entries yet.</p>}
          {db.audit.slice(0, 20).map((entry) => (
            <div className="rowline" key={entry.id}>
              <span>
                {entry.action}
                <small className="muted"> · {entry.actor}</small>
              </span>
              <small className="muted">{entry.time}</small>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
