import type { ReactNode } from 'react'

export type BarItem = {
  id: string
  label: string
  value: number
  display: string
  note?: string
}

export function LensGrid({ children }: { children: ReactNode }) {
  return <div className="lens-grid">{children}</div>
}

export function Lens({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="lens">
      <header>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  )
}

export function BarList({
  items,
  active = '',
  onPick,
  shareOf,
}: {
  items: BarItem[]
  active?: string
  onPick?: (id: string) => void
  shareOf?: number
}) {
  const max = Math.max(1, ...items.map((item) => item.value), shareOf ?? 0)
  if (items.length === 0) return <p className="lens-empty">Nothing in this cut yet.</p>
  return (
    <div className="barlist">
      {items.map((item) => {
        const width = item.value <= 0 ? 0 : Math.max(3, (item.value / max) * 100)
        const on = active === item.id
        const body = (
          <>
            <span>{item.label}</span>
            <span className="barline-track" aria-hidden="true">
              <i style={{ width: `${width}%` }} />
            </span>
            <strong>{item.display}</strong>
          </>
        )
        if (!onPick) {
          return (
            <div className="barline" key={item.id}>
              {body}
            </div>
          )
        }
        return (
          <button key={item.id} type="button" className={on ? 'barline on' : 'barline'} aria-pressed={on} onClick={() => onPick(on ? '' : item.id)}>
            {body}
          </button>
        )
      })}
    </div>
  )
}

export function StackBar({ parts }: { parts: { id: string; label: string; value: number; display: string }[] }) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0)
  return (
    <div className="stackbar">
      <div className="stackbar-track" aria-hidden="true">
        {total > 0 &&
          parts
            .filter((part) => part.value > 0)
            .map((part) => <i key={part.id} style={{ width: `${(part.value / total) * 100}%` }} />)}
      </div>
      <ul>
        {parts.map((part) => (
          <li key={part.id}>
            <b>{part.display}</b>
            <span>{part.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
