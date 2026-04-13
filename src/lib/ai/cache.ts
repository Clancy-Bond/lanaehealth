// AI Analysis Cache - Hash-based invalidation for analysis results

import { createServiceClient } from '@/lib/supabase'
import type { AnalysisRun, AnalysisFinding, RunType, InsightCategory } from '@/lib/types'

/**
 * Check if a valid cached analysis exists for the given run type and input hash.
 * Returns the cached findings if found and not expired (7 days).
 */
export async function getCachedAnalysis(
  runType: RunType,
  inputHash: string
): Promise<{ run: AnalysisRun; findings: AnalysisFinding[] } | null> {
  try {
    const supabase = createServiceClient()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: runs } = await supabase
      .from('analysis_runs')
      .select('*')
      .eq('run_type', runType)
      .eq('input_hash', inputHash)
      .eq('status', 'complete')
      .gte('completed_at', sevenDaysAgo)
      .order('completed_at', { ascending: false })
      .limit(1)

    if (!runs || runs.length === 0) return null

    const run = runs[0] as AnalysisRun
    const { data: findings } = await supabase
      .from('analysis_findings')
      .select('*')
      .eq('run_id', run.id)
      .order('confidence', { ascending: false })

    return { run, findings: (findings || []) as AnalysisFinding[] }
  } catch (err) {
    console.warn('Cache lookup failed:', err)
    return null
  }
}

/**
 * Create a new analysis run record.
 */
export async function createAnalysisRun(
  runType: RunType,
  inputHash: string
): Promise<string | null> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('analysis_runs')
      .insert({
        run_type: runType,
        status: 'running',
        input_hash: inputHash,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  } catch (err) {
    console.error('Failed to create analysis run:', err)
    return null
  }
}

/**
 * Save analysis findings and mark the run as complete.
 */
export async function saveAnalysisResults(
  runId: string,
  findings: Omit<AnalysisFinding, 'id' | 'run_id' | 'created_at'>[],
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createServiceClient()

    // Insert findings
    if (findings.length > 0) {
      const rows = findings.map(f => ({
        run_id: runId,
        category: f.category,
        title: f.title,
        summary: f.summary,
        evidence_json: f.evidence_json,
        confidence: f.confidence,
        clinical_significance: f.clinical_significance,
      }))

      const { error: findingsError } = await supabase
        .from('analysis_findings')
        .insert(rows)

      if (findingsError) throw findingsError
    }

    // Mark run as complete
    const { error: updateError } = await supabase
      .from('analysis_runs')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        metadata: metadata || {},
      })
      .eq('id', runId)

    if (updateError) throw updateError
  } catch (err) {
    console.error('Failed to save analysis results:', err)

    // Try to mark as failed
    try {
      const supabase = createServiceClient()
      await supabase
        .from('analysis_runs')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)
    } catch {
      // Silent fail on error recording
    }
  }
}

/**
 * Mark a run as failed with an error message.
 */
export async function failAnalysisRun(runId: string, errorMessage: string): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase
      .from('analysis_runs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)
  } catch {
    // Silent fail
  }
}

/**
 * Get the latest findings by category.
 */
export async function getLatestFindings(
  category?: InsightCategory
): Promise<AnalysisFinding[]> {
  try {
    const supabase = createServiceClient()

    // Get the latest completed run
    const { data: runs } = await supabase
      .from('analysis_runs')
      .select('id')
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(1)

    if (!runs || runs.length === 0) return []

    let query = supabase
      .from('analysis_findings')
      .select('*')
      .eq('run_id', runs[0].id)
      .order('confidence', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    const { data } = await query
    return (data || []) as AnalysisFinding[]
  } catch {
    return []
  }
}
