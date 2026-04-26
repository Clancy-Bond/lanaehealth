import { Card } from '@/v2/components/primitives'
import type { CycleReportPayload } from '@/lib/reports/cycle-report'

interface CycleReportViewProps {
  report: CycleReportPayload
  today: string
}

const SHORT_LUTEAL_DAYS = 10

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 'var(--v2-space-5)' }}>
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-lg)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-surface-explanatory-text)',
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            margin: '2px 0 var(--v2-space-3) 0',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-surface-explanatory-muted)',
          }}
        >
          {subtitle}
        </p>
      )}
      {children}
    </section>
  )
}

function StatGrid({ stats }: { stats: Array<{ label: string; value: string }> }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--v2-space-2)',
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            padding: 'var(--v2-space-2) var(--v2-space-3)',
            borderRadius: 'var(--v2-radius-sm)',
            background: 'var(--v2-surface-explanatory-card)',
            border: '1px solid var(--v2-surface-explanatory-border)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-surface-explanatory-muted)',
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-surface-explanatory-text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  )
}

const QUESTIONS = [
  'Given my cycle history and heavy flow, what is the next step in evaluating for endometriosis?',
  'Are there labs or imaging you would like to order today (pelvic ultrasound, AMH, FSH/LH, CA-125)?',
  'How would you like me to track pain patterns and bleeding between now and my follow-up?',
  'Are any of my current medications or supplements worth adjusting given cycle symptoms?',
  'If the pain escalates before our follow-up, when should I contact your office?',
]

/*
 * CycleReportView
 *
 * The OB/GYN-focused cycle handout. Preserves the full content of
 * the legacy /doctor/cycle-report but in v2 visual language. All on
 * the explanatory cream surface so it prints clean.
 */
export default function CycleReportView({ report, today }: CycleReportViewProps) {
  const {
    patient,
    cycleLength,
    luteal,
    periodPattern,
    recentSymptomsByPhase,
    painByPhase,
    recentChanges,
    medications,
    supplements,
    nextAppointment,
    flags,
    notes,
  } = report

  const flowOrder = ['SPOTTING', 'LIGHT', 'MEDIUM', 'HEAVY', 'UNKNOWN']
  const flowEntries = flowOrder
    .filter((k) => (periodPattern.flowBreakdown[k] ?? 0) > 0)
    .map((k) => [k, periodPattern.flowBreakdown[k]] as const)

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
          Cycle Health Report
        </h1>
        <p
          style={{
            margin: '4px 0 0 0',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-surface-explanatory-muted)',
          }}
        >
          {patient.name}
          {patient.age != null ? `, age ${patient.age}` : ''}
          {patient.sex ? `, ${patient.sex}` : ''}
        </p>
        <p
          style={{
            margin: '2px 0 0 0',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-surface-explanatory-muted)',
          }}
        >
          Generated {formatDate(today)}
          {nextAppointment?.date
            ? ` for visit on ${formatDate(nextAppointment.date)}${nextAppointment.specialty ? ` (${nextAppointment.specialty})` : ''}`
            : ''}
        </p>
      </header>

      {(flags.shortLuteal || flags.irregularCycles || flags.heavyFlow) && (
        <div
          style={{
            padding: 'var(--v2-space-3)',
            borderRadius: 'var(--v2-radius-sm)',
            background: 'rgba(232, 69, 112, 0.10)',
            border: '1px solid var(--v2-surface-explanatory-accent)',
            marginBottom: 'var(--v2-space-3)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-surface-explanatory-accent)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            Items to discuss
          </div>
          <ul
            style={{
              margin: 'var(--v2-space-2) 0 0 18px',
              padding: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {flags.shortLuteal && (
              <li>
                Luteal phase under {SHORT_LUTEAL_DAYS} days in one or more recent cycles. Worth discussing.
              </li>
            )}
            {flags.irregularCycles && <li>Cycle length variability above typical for your history.</li>}
            {flags.heavyFlow && <li>Heavy-flow days in recent cycles. Iron status and management options worth discussing.</li>}
          </ul>
        </div>
      )}

      <Section title="Cycle length history" subtitle="Last 12 complete cycles from Natural Cycles record.">
        {cycleLength.n === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', fontStyle: 'italic', color: 'var(--v2-surface-explanatory-muted)' }}>
            Not enough cycle data yet.
          </p>
        ) : (
          <StatGrid
            stats={[
              { label: 'Average', value: `${cycleLength.avgLength} days` },
              { label: 'Range', value: `${cycleLength.minLength}–${cycleLength.maxLength} days` },
              { label: 'Variability (SD)', value: `${cycleLength.sdLength} days` },
              { label: 'Count', value: `${cycleLength.n} cycles` },
            ]}
          />
        )}
      </Section>

      <Section title="Luteal phase" subtitle="Estimated days between ovulation and next period.">
        {luteal.segments.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', fontStyle: 'italic', color: 'var(--v2-surface-explanatory-muted)' }}>
            Not enough cycle data yet.
          </p>
        ) : (
          <StatGrid
            stats={[
              { label: 'Average luteal length', value: luteal.avgLutealDays != null ? `${luteal.avgLutealDays} days` : '-' },
              {
                label: 'Short-luteal flags',
                value: luteal.shortLutealCount > 0 ? `${luteal.shortLutealCount} cycle${luteal.shortLutealCount === 1 ? '' : 's'}` : 'None',
              },
            ]}
          />
        )}
      </Section>

      <Section title="Period pattern" subtitle="Flow distribution across the last 6 cycles.">
        {periodPattern.avgPeriodDays == null ? (
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', fontStyle: 'italic', color: 'var(--v2-surface-explanatory-muted)' }}>
            Not enough period data yet.
          </p>
        ) : (
          <>
            <StatGrid
              stats={[
                { label: 'Average period length', value: `${periodPattern.avgPeriodDays} days` },
                { label: 'Clots reported (last year)', value: periodPattern.clotsReported ? 'Yes' : 'None' },
              ]}
            />
            {flowEntries.length > 0 && (
              <ul
                style={{
                  margin: 'var(--v2-space-2) 0 0 0',
                  padding: 0,
                  listStyle: 'none',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 'var(--v2-space-1)',
                }}
              >
                {flowEntries.map(([label, count]) => (
                  <li
                    key={label}
                    style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-surface-explanatory-muted)' }}
                  >
                    <strong style={{ color: 'var(--v2-surface-explanatory-text)' }}>
                      {label.charAt(0) + label.slice(1).toLowerCase()}
                    </strong>
                    : {count} day{count === 1 ? '' : 's'}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      <Section title="Top symptoms by cycle phase" subtitle="From logged symptoms across the last 6 cycles.">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--v2-space-2)',
          }}
        >
          {(['menstrual', 'follicular', 'ovulatory', 'luteal'] as const).map((phase) => {
            const list = recentSymptomsByPhase[phase] ?? []
            return (
              <div
                key={phase}
                style={{
                  padding: 'var(--v2-space-2) var(--v2-space-3)',
                  borderRadius: 'var(--v2-radius-sm)',
                  background: 'var(--v2-surface-explanatory-card)',
                  border: '1px solid var(--v2-surface-explanatory-border)',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    textTransform: 'uppercase',
                    color: 'var(--v2-surface-explanatory-accent)',
                    letterSpacing: 'var(--v2-tracking-wide)',
                    marginBottom: 4,
                  }}
                >
                  {phase}
                </div>
                {list.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-surface-explanatory-muted)' }}>
                    No symptoms logged.
                  </p>
                ) : (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 14,
                      fontSize: 'var(--v2-text-sm)',
                      color: 'var(--v2-surface-explanatory-text)',
                      lineHeight: 'var(--v2-leading-normal)',
                    }}
                  >
                    {list.map((s) => (
                      <li key={s.symptom}>
                        {s.symptom}{' '}
                        <span style={{ color: 'var(--v2-surface-explanatory-muted)' }}>
                          ({s.count}x{s.maxSeverity ? `, max ${s.maxSeverity}` : ''})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Pain pattern by cycle phase" subtitle="Average logged pain score (0–10) per phase, last 6 cycles.">
        <StatGrid
          stats={(['menstrual', 'follicular', 'ovulatory', 'luteal'] as const).map((phase) => {
            const row = painByPhase[phase]
            return {
              label: phase[0].toUpperCase() + phase.slice(1),
              value: row?.avg != null ? `${row.avg} (n=${row.count})` : 'Not logged',
            }
          })}
        />
      </Section>

      {recentChanges.length > 0 && (
        <Section title="Recent changes" subtitle="Important events from medical timeline, last 3 months.">
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {recentChanges.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Medications and supplements">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--v2-space-3)' }}>
          <div>
            <div
              style={{
                fontSize: 'var(--v2-text-xs)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-surface-explanatory-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
                marginBottom: 4,
              }}
            >
              Medications
            </div>
            {medications.length === 0 ? (
              <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', fontStyle: 'italic', color: 'var(--v2-surface-explanatory-muted)' }}>
                None on record.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--v2-text-sm)', lineHeight: 'var(--v2-leading-relaxed)' }}>
                {medications.map((m, i) => (
                  <li key={i}>
                    {m.name}
                    {m.dose ? ` (${m.dose})` : ''}
                    {m.indication && (
                      <span style={{ color: 'var(--v2-surface-explanatory-muted)' }}> for {m.indication}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div
              style={{
                fontSize: 'var(--v2-text-xs)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-surface-explanatory-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
                marginBottom: 4,
              }}
            >
              Supplements
            </div>
            {supplements.length === 0 ? (
              <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', fontStyle: 'italic', color: 'var(--v2-surface-explanatory-muted)' }}>
                None on record.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--v2-text-sm)', lineHeight: 'var(--v2-leading-relaxed)' }}>
                {supplements.map((s, i) => (
                  <li key={i}>
                    {s.name}
                    {s.dose ? ` (${s.dose})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section title="Questions for your OB/GYN" subtitle="Neutral prompts. Check the ones you want to raise.">
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-surface-explanatory-text)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          {QUESTIONS.map((q) => (
            <li key={q} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  border: '1.5px solid var(--v2-surface-explanatory-border)',
                  borderRadius: 3,
                  flexShrink: 0,
                  marginTop: 4,
                }}
              />
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </Section>

      {notes.length > 0 && (
        <p
          style={{
            marginTop: 'var(--v2-space-5)',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-surface-explanatory-muted)',
            fontStyle: 'italic',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          {notes.join(' ')}
        </p>
      )}
    </Card>
  )
}
