/**
 * /v2/doctor/one-page - printable single-page doctor handoff.
 *
 * Pattern source: bearable.app's printable worksheet pattern. Even
 * doctors who do not open patient apps will glance at one page of
 * paper. This route mirrors that "fold it, hand it over" moment:
 * one screen, print-styled, easy to scan in 30 seconds.
 *
 * Architecturally complementary to /v2/doctor/care-card (emergency
 * identity card) and /v2/doctor (full longitudinal review). This is
 * the in-between: not an emergency card, not a deep dive, but the
 * thing a primary-care doctor will actually fold into the chart.
 *
 * Sections (in scan order):
 *   1. Identity strip (name, age, DOB) and visit date.
 *   2. Confirmed diagnoses + active meds.
 *   3. The 7-day numbers table (pain, fatigue, sleep, mood).
 *   4. Recent flares (last 7 days of pain_points, severity 7+).
 *   5. Notes for this visit (free-form, pulled from the latest
 *      handoff notes context if present, else a printable blank).
 *
 * All numbers come from existing tables (daily_logs, pain_points,
 * health_profile). No new write endpoints, no new tables.
 */
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { parseProfileContent } from '@/lib/profile/parse-content'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { buildSevenDayStat, fmtCell, type SevenDayStat } from '@/lib/v2/one-page-stats'
import type { DailyLog, PainPoint } from '@/lib/types'
import OnePagePrintHelper from './_components/OnePagePrintHelper'

export const dynamic = 'force-dynamic'

interface PersonalContent {
  full_name?: string
  age?: number
  sex?: string
  date_of_birth?: string
}

interface MedicationContent {
  scheduled?: Array<{ name: string; dose?: string; frequency?: string }>
  as_needed?: Array<{ name: string; dose?: string; frequency?: string }>
}

interface OnePageData {
  patientName: string
  patientAge: number | null
  patientDOB: string | null
  diagnoses: string[]
  medications: Array<{ name: string; dose?: string; frequency?: string }>
  stats: SevenDayStat[]
  flares: Array<{ date: string; severity: number; region: string | null }>
  visitDate: string
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function sevenDaysAgoISO(today: string): string {
  const t = new Date(today + 'T00:00:00Z').getTime()
  return new Date(t - 6 * 86_400_000).toISOString().slice(0, 10)
}

async function safeAwait<T>(p: PromiseLike<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}

type DailyRow = Pick<DailyLog, 'overall_pain' | 'fatigue' | 'sleep_quality' | 'stress'>
type PainRow = Pick<PainPoint, 'logged_at' | 'intensity' | 'body_region'>

async function loadOnePageData(): Promise<OnePageData> {
  const today = todayISO()
  const weekAgo = sevenDaysAgoISO(today)
  const sb = createServiceClient()

  // Profile (identity, dx, meds) and the two date-bound tables.
  // Each query is wrapped so a single bad table does not take the
  // page down; we render a partial sheet rather than an error.
  const [profile, daily, pain] = await Promise.all([
    safeAwait(
      sb
        .from('health_profile')
        .select('section, content')
        .then(({ data }) => (data as Array<{ section: string; content: unknown }> | null) ?? null),
      null as Array<{ section: string; content: unknown }> | null,
    ),
    safeAwait(
      sb
        .from('daily_logs')
        .select('overall_pain, fatigue, sleep_quality, stress')
        .gte('date', weekAgo)
        .lte('date', today)
        .then(({ data }) => (data as DailyRow[] | null) ?? []),
      [] as DailyRow[],
    ),
    safeAwait(
      sb
        .from('pain_points')
        .select('logged_at, intensity, body_region')
        .gte('logged_at', `${weekAgo}T00:00:00Z`)
        .gte('intensity', 7)
        .order('logged_at', { ascending: false })
        .limit(5)
        .then(({ data }) => (data as PainRow[] | null) ?? []),
      [] as PainRow[],
    ),
  ])

  const profileMap = new Map<string, unknown>()
  for (const r of profile ?? []) {
    profileMap.set(r.section, parseProfileContent(r.content))
  }
  const personal = (profileMap.get('personal') as PersonalContent | undefined) ?? {}
  const diagnoses = (profileMap.get('confirmed_diagnoses') as string[] | undefined) ?? []
  const medsRaw = (profileMap.get('medications') as MedicationContent | undefined) ?? {}
  const allMeds = [
    ...(medsRaw.scheduled ?? []),
    ...(medsRaw.as_needed ?? []),
  ].slice(0, 8)

  // Compose the 7-day stats. We carry diabetes / metabolic markers
  // separately if needed later; for now stay with the four most
  // doctor-meaningful: pain, fatigue, sleep, stress.
  const stats: SevenDayStat[] = [
    buildSevenDayStat(
      'Pain',
      daily.map((d) => d.overall_pain).filter((n): n is number => typeof n === 'number'),
    ),
    buildSevenDayStat(
      'Fatigue',
      daily.map((d) => d.fatigue).filter((n): n is number => typeof n === 'number'),
    ),
    buildSevenDayStat(
      'Sleep quality',
      daily.map((d) => d.sleep_quality).filter((n): n is number => typeof n === 'number'),
    ),
    buildSevenDayStat(
      'Stress',
      daily.map((d) => d.stress).filter((n): n is number => typeof n === 'number'),
    ),
  ]

  const flares = pain.map((p) => ({
    date: p.logged_at.slice(0, 10),
    severity: p.intensity,
    region: p.body_region ?? null,
  }))

  return {
    patientName: personal.full_name ?? 'Patient',
    patientAge: personal.age ?? null,
    patientDOB: personal.date_of_birth ?? null,
    diagnoses: diagnoses.slice(0, 6),
    medications: allMeds,
    stats,
    flares,
    visitDate: today,
  }
}

export default async function OnePageHandoffPage() {
  const data = await loadOnePageData()

  return (
    <MobileShell
      top={
        <TopAppBar
          title="One-page handoff"
          leading={
            <Link
              href="/v2/doctor"
              aria-label="Back to doctor view"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-lg)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ←
            </Link>
          }
        />
      }
      bottom={null}
    >
      <div className="v2-surface-explanatory" style={{ minHeight: '100%' }}>
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: 'var(--v2-space-5) var(--v2-space-4) var(--v2-space-8)',
          }}
        >
          <OnePagePrintHelper />
          <PrintableHandoff data={data} />
          <p
            style={{
              marginTop: 'var(--v2-space-4)',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-surface-explanatory-muted)',
              textAlign: 'center',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Printable layout adapted from{' '}
            <a
              href="https://bearable.app/help"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--v2-surface-explanatory-muted)' }}
            >
              Bearable&apos;s printable worksheets
            </a>
            . Fold it, hand it over, save the screen for the chart.
          </p>
        </div>
      </div>
    </MobileShell>
  )
}

interface PrintableHandoffProps {
  data: OnePageData
}

function PrintableHandoff({ data }: PrintableHandoffProps) {
  return (
    <article
      aria-label="Printable doctor handoff"
      style={{
        background: 'var(--v2-surface-explanatory-card)',
        color: 'var(--v2-surface-explanatory-text)',
        border: '1px solid var(--v2-surface-explanatory-border)',
        boxShadow: 'var(--v2-shadow-explanatory-sm)',
        padding: 'var(--v2-space-5)',
        borderRadius: 'var(--v2-radius-md)',
        fontSize: 'var(--v2-text-sm)',
        lineHeight: 'var(--v2-leading-relaxed)',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 'var(--v2-space-3)',
          paddingBottom: 'var(--v2-space-3)',
          borderBottom: '1px solid var(--v2-surface-explanatory-border)',
          marginBottom: 'var(--v2-space-3)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--v2-text-lg)', fontWeight: 'var(--v2-weight-semibold)' }}>
            {data.patientName}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 'var(--v2-text-xs)', color: 'var(--v2-surface-explanatory-muted)' }}>
            {data.patientAge ? `Age ${data.patientAge}` : null}
            {data.patientAge && data.patientDOB ? ' • ' : null}
            {data.patientDOB ? `DOB ${data.patientDOB}` : null}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-surface-explanatory-muted)' }}>
            Visit date
          </p>
          <p style={{ margin: '2px 0 0 0', fontSize: 'var(--v2-text-sm)' }}>{data.visitDate}</p>
        </div>
      </header>

      <Section title="Active diagnoses">
        {data.diagnoses.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--v2-surface-explanatory-muted)' }}>
            None on file.
          </p>
        ) : (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {data.diagnoses.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Current medications">
        {data.medications.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--v2-surface-explanatory-muted)' }}>
            None on file.
          </p>
        ) : (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {data.medications.map((m, i) => (
              <li key={i}>
                {m.name}
                {m.dose ? ` ${m.dose}` : ''}
                {m.frequency ? `, ${m.frequency}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="7-day numbers (0 to 10 scale)">
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--v2-text-sm)',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--v2-surface-explanatory-border)' }}>
              <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 'var(--v2-weight-semibold)' }}>Metric</th>
              <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 'var(--v2-weight-semibold)' }}>Mean</th>
              <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 'var(--v2-weight-semibold)' }}>Days</th>
            </tr>
          </thead>
          <tbody>
            {data.stats.map((s) => (
              <tr key={s.label} style={{ borderBottom: '1px solid var(--v2-surface-explanatory-border)' }}>
                <td style={{ padding: '6px 0' }}>{s.label}</td>
                <td style={{ textAlign: 'right', padding: '6px 0' }}>{fmtCell(s.mean)}</td>
                <td style={{ textAlign: 'right', padding: '6px 0' }}>{s.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Recent flares (severity 7 or higher)">
        {data.flares.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--v2-surface-explanatory-muted)' }}>
            No severe flares logged in the last 7 days.
          </p>
        ) : (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {data.flares.map((f, i) => (
              <li key={i}>
                {f.date}: {f.region ?? 'unspecified region'}, severity {f.severity}/10
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Notes for this visit">
        <div
          style={{
            minHeight: 80,
            border: '1px dashed var(--v2-surface-explanatory-border)',
            borderRadius: 'var(--v2-radius-sm)',
            padding: 'var(--v2-space-3)',
            color: 'var(--v2-surface-explanatory-muted)',
            fontSize: 'var(--v2-text-xs)',
          }}
        >
          Space for handwritten notes during the visit.
        </div>
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 'var(--v2-space-4)' }}>
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
    </section>
  )
}
