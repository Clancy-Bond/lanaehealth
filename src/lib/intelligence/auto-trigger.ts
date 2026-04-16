/**
 * Auto-Trigger for Clinical Intelligence Engine
 *
 * Fires a non-blocking POST to /api/intelligence/analyze when
 * significant new data arrives. The request is fire-and-forget
 * (does not block the calling route).
 */

import type { AnalysisMode } from './types'

/** In-memory cooldown to prevent rapid re-triggers */
let lastTriggerTime = 0
const COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes between triggers

/**
 * Determines if an analysis should be triggered based on what data changed.
 * Returns the analysis mode, or null if no trigger is needed.
 */
export function shouldTriggerAnalysis(
  dataSource: string,
  recordCount: number,
): { mode: AnalysisMode; reason: string } | null {
  const now = Date.now()
  if (now - lastTriggerTime < COOLDOWN_MS) return null

  // Significant data triggers
  switch (dataSource) {
    case 'lab_results':
      // New lab results ALWAYS trigger full analysis
      if (recordCount > 0) return { mode: 'full', reason: `${recordCount} new lab results imported` }
      break
    case 'imaging_studies':
      if (recordCount > 0) return { mode: 'full', reason: `${recordCount} new imaging studies imported` }
      break
    case 'oura_daily':
      // Oura sync triggers standard if 7+ new days
      if (recordCount >= 7) return { mode: 'standard', reason: `${recordCount} days of Oura data synced` }
      break
    case 'daily_logs':
      // Daily log entries trigger incremental
      if (recordCount > 0) return { mode: 'incremental', reason: `${recordCount} daily log entries added` }
      break
    case 'import_myah':
      // myAH imports can contain labs, appointments, etc.
      if (recordCount > 0) return { mode: 'full', reason: `myAH import: ${recordCount} records` }
      break
    case 'sync_pipeline':
      // Vector store sync - incremental to update summaries
      if (recordCount >= 30) return { mode: 'standard', reason: `${recordCount} narratives synced to vector store` }
      if (recordCount > 0) return { mode: 'incremental', reason: `${recordCount} narratives synced` }
      break
    default:
      return null
  }
  return null
}

/**
 * Fire-and-forget analysis trigger.
 * Makes a non-blocking HTTP POST to the analysis endpoint.
 * Never throws - always logs errors silently.
 */
export async function triggerAnalysis(mode: AnalysisMode, reason: string): Promise<void> {
  lastTriggerTime = Date.now()

  try {
    // Use the internal URL for server-side calls
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3005'
    const url = `${baseUrl}/api/intelligence/analyze`

    // Fire and don't await the response
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, reason }),
    }).catch((err) => {
      console.error('[auto-trigger] Failed to trigger analysis:', err instanceof Error ? err.message : err)
    })

    console.log(`[auto-trigger] Triggered ${mode} analysis: ${reason}`)
  } catch (err) {
    console.error('[auto-trigger] Error:', err instanceof Error ? err.message : err)
  }
}

/**
 * Convenience: check if trigger is needed and fire if so.
 * Call this at the end of data ingestion routes.
 */
export async function maybeTriggerAnalysis(dataSource: string, recordCount: number): Promise<void> {
  const trigger = shouldTriggerAnalysis(dataSource, recordCount)
  if (trigger) {
    await triggerAnalysis(trigger.mode, trigger.reason)
  }
}
