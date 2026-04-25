/**
 * /v2/log/pain
 *
 * Clinically multi-dimensional pain logger.
 *
 * Quick path: NRS or Wong-Baker FACES, save in seconds. Drill-down:
 * body region (chip set), MPQ-derived quality chips, PEG functional
 * impact, condition-aware HIT-6 / COMPASS-31 prompts, optional
 * trigger guess.
 *
 * Architecture: server component reads today's daily_log + the
 * patient health profile (for diagnoses), then hands a client
 * component the seed values + condition flags. Persistence goes
 * through POST /api/log/pain which writes the canonical 0-10
 * intensity to daily_logs.overall_pain and (when drill-down has
 * detail) inserts a pain_points row with a structured context_json.
 *
 * See /tmp/pain-scales-research.md for scale validation citations.
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import type { DailyLog, PainPoint } from '@/lib/types'
import PainLogClient from './_components/PainLogClient'
import { detectConditionFlags } from './_components/condition-detection'
import healthProfile from '@/lib/health-profile.json'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function loadTodayLog(today: string): Promise<DailyLog | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('daily_logs')
    .select('*')
    .eq('date', today)
    .maybeSingle()
  return (data as DailyLog | null) ?? null
}

async function loadLatestPainRegion(logId: string | null | undefined): Promise<string | null> {
  if (!logId) return null
  const sb = createServiceClient()
  const { data } = await sb
    .from('pain_points')
    .select('body_region')
    .eq('log_id', logId)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ((data as Pick<PainPoint, 'body_region'> | null)?.body_region) ?? null
}

/**
 * Pull diagnoses + suspected conditions from the bundled health
 * profile. Tries to read the live active_problems table as well,
 * because patient diagnoses can change between deploys.
 */
async function loadDiagnosisCorpus(): Promise<string[]> {
  const corpus: string[] = []
  const profile = healthProfile as {
    diagnoses?: { confirmed?: string[]; suspected?: string[] }
  }
  if (profile.diagnoses?.confirmed) corpus.push(...profile.diagnoses.confirmed)
  if (profile.diagnoses?.suspected) corpus.push(...profile.diagnoses.suspected)

  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from('active_problems')
      .select('problem, linked_diagnoses')
      .eq('status', 'active')
    if (Array.isArray(data)) {
      for (const row of data as Array<{ problem?: string; linked_diagnoses?: string[] }>) {
        if (row.problem) corpus.push(row.problem)
        if (Array.isArray(row.linked_diagnoses)) corpus.push(...row.linked_diagnoses)
      }
    }
  } catch {
    // Best-effort. The bundled profile is the floor.
  }
  return corpus
}

export default async function V2PainLogPage() {
  const today = todayISO()
  const [log, diagnoses] = await Promise.all([loadTodayLog(today), loadDiagnosisCorpus()])
  const latestRegion = await loadLatestPainRegion(log?.id ?? null)
  const conditionFlags = detectConditionFlags(diagnoses)

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Log pain"
          leading={
            <Link
              href="/v2/log"
              aria-label="Back to log"
              style={{
                color: 'var(--v2-text-secondary)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                minWidth: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-5)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-10)',
        }}
      >
        <PainLogClient
          today={today}
          initialIntensity={log?.overall_pain ?? null}
          initialBodyRegion={latestRegion}
          conditionFlags={conditionFlags}
        />
      </div>
    </MobileShell>
  )
}
