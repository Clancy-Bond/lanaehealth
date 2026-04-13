/**
 * Dream Cycle - Background Summary Regeneration
 *
 * Runs on demand (triggered from Settings) to refresh the AI's
 * understanding of the patient's health data. Implements a 4-phase
 * active learning cycle:
 *
 *   Phase 1 - Orient:      Read existing summaries, check staleness
 *   Phase 2 - Gather:      Count new data since each summary was generated
 *   Phase 3 - Consolidate: Regenerate stale or outdated summaries
 *   Phase 4 - Prune:       Record metadata, return a report
 *
 * Decision logic for regeneration:
 *   - Summary older than 7 days: always regenerate
 *   - Summary 3-7 days old with 10+ new data rows: regenerate
 *   - Otherwise: skip (fresh enough)
 */

import { createServiceClient } from '@/lib/supabase'
import { generateSummary } from '@/lib/context/summary-engine'
import { SUMMARY_TOPICS, type SummaryTopic } from './summary-prompts'
import { syncDateRange } from '@/lib/context/sync-pipeline'

// ── Types ────────────────────────────────────────────────────────────

export interface DreamResult {
  startedAt: string
  completedAt: string
  summariesRegenerated: string[]
  summariesSkipped: string[]
  newDataCounts: Record<string, number>
  vectorRecordsSynced: number
  errors: string[]
}

interface SummaryRecord {
  topic: string
  generated_at: string
}

// ── Data source tables that carry a date or logged_at column ────────

const DATA_SOURCE_DATE_COLUMNS: Record<string, string> = {
  daily_logs: 'date',
  oura_daily: 'date',
  symptoms: 'logged_at',
  food_entries: 'logged_at',
  lab_results: 'date',
  cycle_entries: 'date',
  nc_imported: 'date',
  correlation_results: 'computed_at',
  imaging_studies: 'study_date',
  health_profile: '', // no date column, always include
}

// ── Helpers ──────────────────────────────────────────────────────────

function daysBetween(dateStr: string, now: Date): number {
  const then = new Date(dateStr)
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24)
}

/**
 * Counts rows inserted after a given timestamp for a specific table.
 * Returns 0 for tables without a date column (like health_profile).
 */
async function countNewRows(
  sb: ReturnType<typeof createServiceClient>,
  table: string,
  sinceIso: string,
): Promise<number> {
  const dateCol = DATA_SOURCE_DATE_COLUMNS[table]
  if (!dateCol) return 0

  const { count, error } = await sb
    .from(table)
    .select('*', { count: 'exact', head: true })
    .gte(dateCol, sinceIso)

  if (error) {
    console.error(`Dream cycle: error counting ${table}:`, error.message)
    return 0
  }

  return count ?? 0
}

// ── Main Dream Cycle ────────────────────────────────────────────────

export async function runDreamCycle(): Promise<DreamResult> {
  const startedAt = new Date().toISOString()
  const now = new Date()
  const sb = createServiceClient()
  const errors: string[] = []
  const summariesRegenerated: string[] = []
  const summariesSkipped: string[] = []
  const newDataCounts: Record<string, number> = {}

  const allTopics = Object.keys(SUMMARY_TOPICS) as SummaryTopic[]

  // ── Phase 1: Orient ─────────────────────────────────────────────
  // Read existing summaries and check which are stale

  const { data: existingSummaries, error: fetchErr } = await sb
    .from('context_summaries')
    .select('topic, generated_at')

  if (fetchErr) {
    errors.push(`Failed to read existing summaries: ${fetchErr.message}`)
  }

  const summaryMap = new Map<string, SummaryRecord>()
  for (const row of (existingSummaries ?? []) as SummaryRecord[]) {
    summaryMap.set(row.topic, row)
  }

  // ── Phase 2: Gather Signal ──────────────────────────────────────
  // Count new data since each summary was last generated

  // Collect all unique data source tables across all topics
  const allTables = new Set<string>()
  for (const topic of allTopics) {
    for (const src of SUMMARY_TOPICS[topic].dataSources) {
      allTables.add(src)
    }
  }

  // For each table, count new rows since the oldest summary generation time
  // (we use the per-topic generation time later for decisions)
  const tableRowCounts = new Map<string, Map<string, number>>()

  for (const table of allTables) {
    const perTopicCounts = new Map<string, number>()

    for (const topic of allTopics) {
      if (!(SUMMARY_TOPICS[topic].dataSources as readonly string[]).includes(table)) continue

      const existing = summaryMap.get(topic)
      if (!existing) {
        // No summary exists yet, count all recent rows (last 90 days)
        const ninetyDaysAgo = new Date(now)
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
        const count = await countNewRows(sb, table, ninetyDaysAgo.toISOString())
        perTopicCounts.set(topic, count)
      } else {
        const count = await countNewRows(sb, table, existing.generated_at)
        perTopicCounts.set(topic, count)
      }
    }

    tableRowCounts.set(table, perTopicCounts)
  }

  // Compute per-topic new data totals
  for (const topic of allTopics) {
    let total = 0
    for (const src of SUMMARY_TOPICS[topic].dataSources) {
      const counts = tableRowCounts.get(src)
      if (counts) {
        total += counts.get(topic) ?? 0
      }
    }
    newDataCounts[topic] = total
  }

  // ── Phase 3: Consolidate ────────────────────────────────────────
  // Regenerate summaries that are stale or have significant new data

  for (const topic of allTopics) {
    const existing = summaryMap.get(topic)
    const newRows = newDataCounts[topic] ?? 0
    let shouldRegenerate = false

    if (!existing) {
      // No summary exists at all
      shouldRegenerate = true
    } else {
      const ageDays = daysBetween(existing.generated_at, now)

      if (ageDays > 7) {
        // Older than 7 days: always regenerate
        shouldRegenerate = true
      } else if (ageDays >= 3 && newRows >= 10) {
        // 3-7 days old with significant new data: regenerate
        shouldRegenerate = true
      }
      // Otherwise: fresh enough, skip
    }

    if (shouldRegenerate) {
      try {
        await generateSummary(topic)
        summariesRegenerated.push(topic)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Failed to regenerate ${topic}: ${msg}`)
        console.error(`Dream cycle: failed on ${topic}:`, msg)
      }
    } else {
      summariesSkipped.push(topic)
    }
  }

  // ── Phase 3b: Sync Vector Store ─────────────────────────────────
  // Index recent data into health_embeddings for semantic search

  let vectorRecordsSynced = 0
  try {
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const startDate = thirtyDaysAgo.toISOString().split('T')[0]
    const endDate = now.toISOString().split('T')[0]

    vectorRecordsSynced = await syncDateRange(startDate, endDate)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Vector sync failed: ${msg}`)
    console.error('Dream cycle: vector sync failed:', msg)
  }

  // ── Phase 4: Report ─────────────────────────────────────────────

  const completedAt = new Date().toISOString()

  console.log(
    `Dream cycle complete: ${summariesRegenerated.length} regenerated, ` +
    `${summariesSkipped.length} skipped, ` +
    `${vectorRecordsSynced} vector records synced, ` +
    `${errors.length} errors`
  )

  return {
    startedAt,
    completedAt,
    summariesRegenerated,
    summariesSkipped,
    newDataCounts,
    vectorRecordsSynced,
    errors,
  }
}
