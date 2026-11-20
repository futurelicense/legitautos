import { useEffect, type ReactNode } from 'react'

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}

export function Badge({ value, tone }: { value: string; tone?: 'warn' | 'muted' | 'good' }) {
  const muted = /Inactive|Sold|Lost|Closed|Delivered|Rejected|Withdrawn|Done|Cancelled|Expired|Hidden|Void/.test(value)
  const warn = /Pending|Reserved|Inspection|Open|New|Overdue|Hold|Draft|Ready|Contacted|Qualified|Negotiation/.test(value)
  const resolved = tone ?? (muted ? 'muted' : warn ? 'warn' : 'good')
  return <span className={`badge ${resolved}`}>{value}</span>
}

export function PageHead({ title, lede, action }: { title: string; lede: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{lede}</p>
      </div>
      {action}
    </div>
  )
}

export function Modal({
  title,
  onClose,
  wide,
  children,
}: {
  title: string
  onClose: () => void
  wide?: boolean
  children: ReactNode
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div
        className={wide ? 'modal wide' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button className="btn ghost small" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={className ? `field ${className}` : 'field'}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="empty" colSpan={headers.length}>
                No records match this view.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function saved(error: string | null, notify: (text: string, tone?: 'ok' | 'error') => void, message: string) {
  if (error) {
    notify(error, 'error')
    return false
  }
  notify(message)
  return true
}
