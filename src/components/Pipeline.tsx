import type { Lead } from '../lib/types.ts'

export function Pipeline({
  leads,
  detail,
  onOpen,
}: {
  leads: Lead[]
  detail?: (lead: Lead) => string
  onOpen?: (id: string) => void
}) {
  const stages = ['New', 'Contacted', 'Qualified', 'Inspection', 'Negotiation', 'Won'] as const
  return (
    <div className="kanban">
      {stages.map((stage) => {
        const items = leads.filter((lead) => lead.stage === stage)
        return (
          <section className="lane" key={stage} aria-label={stage}>
            <strong>
              {stage} · {items.length}
            </strong>
            {items.map((lead) => (
              <article className="card" key={lead.id}>
                <h3>{lead.name}</h3>
                {detail && <p className="muted">{detail(lead)}</p>}
                <p className="muted">{lead.owner}</p>
                {onOpen && (
                  <button className="btn small" type="button" onClick={() => onOpen(lead.id)}>
                    Open
                  </button>
                )}
              </article>
            ))}
          </section>
        )
      })}
    </div>
  )
}
