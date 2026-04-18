// ---------------------------------------------------------------------------
// CareCardView
//
// Server-safe presentational component for the 1-page emergency Care
// Card. Rendered by both:
//   - /doctor/care-card (authenticated, shows action buttons separately)
//   - /share/[token]     (public, no action buttons)
//
// STRICTLY BOUNDED: only renders fields explicitly passed via the
// CareCardData shape. It must NEVER reach into any other data source.
// This is safety-critical because the public share route uses the same
// component; any broadening here would leak data.
//
// Design tokens: uses --accent-sage / --accent-blush / --bg-card etc.
// No em dashes anywhere (project rule).
// ---------------------------------------------------------------------------

import type { CareCardData } from '@/lib/care-card/load'

interface CareCardViewProps {
  data: CareCardData
  /** Public viewer note shown on /share/[token]. Omitted on /doctor/care-card. */
  publicFooter?: string | null
}

export function CareCardView({ data, publicFooter }: CareCardViewProps) {
  const { patient, diagnoses, medications, supplements, allergies, emergencyNotes } = data

  return (
    <article
      className="care-card"
      style={{
        maxWidth: 640,
        margin: '0 auto',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '24px 28px 28px',
        color: 'var(--text-primary)',
      }}
    >
      {/* Header: patient identity */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          borderBottom: '2px solid var(--accent-sage)',
          paddingBottom: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--accent-sage)',
              margin: 0,
              marginBottom: 4,
            }}
          >
            Care Card
          </p>
          <h1
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {patient.name}
          </h1>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            {[
              patient.age != null ? `Age ${patient.age}` : null,
              patient.sex,
              patient.bloodType ? `Blood ${patient.bloodType}` : null,
            ]
              .filter(Boolean)
              .join(' \u00b7 ')}
          </p>
        </div>
      </header>

      {/* Diagnoses */}
      <Section title="Diagnoses">
        {diagnoses.length === 0 ? (
          <Empty>None on file.</Empty>
        ) : (
          <ul style={ulStyle}>
            {diagnoses.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </Section>

      {/* Medications */}
      <Section title="Current medications">
        {medications.length === 0 ? (
          <Empty>None on file.</Empty>
        ) : (
          <ul style={ulStyle}>
            {medications.map((m, i) => (
              <li key={`${m.name}-${i}`}>
                <strong>{m.name}</strong>
                {m.dose ? ` (${m.dose})` : ''}
                {m.frequency ? (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}
                    {m.frequency}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Supplements */}
      {supplements.length > 0 && (
        <Section title="Supplements">
          <ul style={ulStyle}>
            {supplements.map((s, i) => (
              <li key={`${s.name}-${i}`}>
                {s.name}
                {s.dose ? ` (${s.dose})` : ''}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Allergies */}
      <Section title="Allergies" accent="blush">
        {allergies.length === 0 ? (
          <Empty>None on file.</Empty>
        ) : (
          <ul style={ulStyle}>
            {allergies.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </Section>

      {/* Emergency notes */}
      {emergencyNotes.length > 0 && (
        <Section title="Emergency notes" accent="blush">
          <ul style={ulStyle}>
            {emergencyNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>
      )}

      {publicFooter ? (
        <footer
          style={{
            marginTop: 20,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          {publicFooter}
        </footer>
      ) : null}
    </article>
  )
}

// --- small helpers --------------------------------------------------------

const ulStyle: React.CSSProperties = {
  margin: '6px 0 0 0',
  paddingLeft: 18,
  fontSize: 'var(--text-sm)',
  lineHeight: 1.6,
  color: 'var(--text-primary)',
}

function Section({
  title,
  accent,
  children,
}: {
  title: string
  accent?: 'blush'
  children: React.ReactNode
}) {
  const headingColor = accent === 'blush'
    ? 'var(--accent-blush)'
    : 'var(--accent-sage)'
  return (
    <section style={{ marginTop: 14 }}>
      <h2
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: headingColor,
          margin: 0,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--text-muted)',
        fontStyle: 'italic',
        margin: '4px 0 0 0',
      }}
    >
      {children}
    </p>
  )
}
