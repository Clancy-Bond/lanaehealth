import { Card } from '@/v2/components/primitives'
import type { CareCardData } from '@/lib/care-card/load'

interface CareCardViewProps {
  data: CareCardData
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 'var(--v2-space-4)' }}>
      <h3
        style={{
          margin: '0 0 var(--v2-space-2) 0',
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          color: 'var(--v2-surface-explanatory-muted)',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-surface-explanatory-muted)' }}>
        None on file.
      </p>
    )
  }
  return (
    <ul
      style={{
        listStyle: 'disc',
        paddingLeft: 18,
        margin: 0,
        fontSize: 'var(--v2-text-sm)',
        color: 'var(--v2-surface-explanatory-text)',
        lineHeight: 'var(--v2-leading-relaxed)',
      }}
    >
      {items.map((i, idx) => (
        <li key={idx}>{i}</li>
      ))}
    </ul>
  )
}

/*
 * CareCardView
 *
 * The printable emergency-summary layout. Lives on a white Card
 * nested inside the explanatory surface so print preserves contrast
 * regardless of the user's print settings. Sections are ordered
 * by what a paramedic would scan first (identity -> allergies ->
 * diagnoses -> meds) rather than by docked database order.
 */
export default function CareCardView({ data }: CareCardViewProps) {
  const { patient, diagnoses, medications, supplements, allergies, emergencyNotes } = data
  const ageSex = [patient.age ? `${patient.age}` : null, patient.sex ?? null].filter(Boolean).join(' ')

  return (
    <Card variant="explanatory" padding="lg">
      <header
        style={{
          borderBottom: '1px solid var(--v2-surface-explanatory-border)',
          paddingBottom: 'var(--v2-space-3)',
          marginBottom: 'var(--v2-space-3)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-2xl)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-surface-explanatory-text)',
          }}
        >
          {patient.name}
        </h1>
        <p
          style={{
            margin: '2px 0 0 0',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-surface-explanatory-muted)',
          }}
        >
          {ageSex}
          {patient.bloodType && ` · Blood type ${patient.bloodType}`}
        </p>
      </header>

      <Section title="Allergies and sensitivities">
        <BulletList items={allergies} />
      </Section>

      <Section title="Confirmed diagnoses">
        <BulletList items={diagnoses} />
      </Section>

      <Section title="Current medications">
        {medications.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-surface-explanatory-muted)' }}>
            None on file.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
            {medications.map((m, i) => (
              <li key={i} style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-surface-explanatory-text)' }}>
                · <strong>{m.name}</strong>
                {m.dose && <span> {m.dose}</span>}
                {m.frequency && <span style={{ color: 'var(--v2-surface-explanatory-muted)' }}> · {m.frequency}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Supplements">
        {supplements.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-surface-explanatory-muted)' }}>
            None on file.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
            {supplements.map((s, i) => (
              <li key={i} style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-surface-explanatory-text)' }}>
                · <strong>{s.name}</strong>
                {s.dose && <span> {s.dose}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {emergencyNotes.length > 0 && (
        <Section title="Emergency notes">
          <BulletList items={emergencyNotes} />
        </Section>
      )}
    </Card>
  )
}
