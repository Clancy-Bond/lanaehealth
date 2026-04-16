/**
 * Analysis Pipeline API Route
 *
 * POST /api/intelligence/analyze
 *
 * Triggers the background clinical analysis pipeline, orchestrating the
 * 3 core personas (Analyst -> Hypothesis Doctor -> Challenger) in sequence.
 *
 * Request body:
 *   mode: 'incremental' | 'standard' | 'full' | 'doctor_prep'
 *   reason: string
 *   target_appointment?: string  (for doctor_prep mode)
 */

import { getKBDocument } from '@/lib/intelligence/knowledge-base'
import { runClinicalAnalyst } from '@/lib/intelligence/personas/clinical-analyst'
import { runHypothesisDoctor } from '@/lib/intelligence/personas/hypothesis-doctor'
import { runChallenger } from '@/lib/intelligence/personas/challenger'
import type { AnalysisMode } from '@/lib/intelligence/types'

export const maxDuration = 300

const VALID_MODES: AnalysisMode[] = ['incremental', 'standard', 'full', 'doctor_prep']

export async function POST(request: Request) {
  const pipelineStart = Date.now()

  try {
    const body = await request.json() as {
      mode?: string
      reason?: string
      target_appointment?: string
    }

    // ---- Validate request body ----

    if (!body.mode || !VALID_MODES.includes(body.mode as AnalysisMode)) {
      return Response.json(
        { success: false, error: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}` },
        { status: 400 },
      )
    }

    if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
      return Response.json(
        { success: false, error: 'Missing required field: reason (non-empty string)' },
        { status: 400 },
      )
    }

    const mode = body.mode as AnalysisMode
    const reason = body.reason.trim()
    const personasRun: string[] = []
    const documentsUpdated: string[] = []
    const errors: string[] = []
    let hypothesesCount = 0

    // ---- Load previous KB content for delta detection ----

    console.log(`[analyze] Starting ${mode} analysis: ${reason}`)

    const [previousIFM, previousTracker] = await Promise.all([
      getKBDocument('ifm_matrix_overview'),
      getKBDocument('hypothesis_tracker'),
    ])

    const previousKBContent = previousIFM?.content ?? undefined

    // ---- Step 1: Run Clinical Analyst (always runs) ----

    console.log('[analyze] Running Clinical Analyst...')
    const analystOutput = await runClinicalAnalyst(previousKBContent)
    personasRun.push('clinical_analyst')
    documentsUpdated.push(...analystOutput.kbUpdates)

    if (!analystOutput.result.success) {
      errors.push(`clinical_analyst: ${analystOutput.result.error ?? 'Unknown error'}`)
    }

    // ---- Step 2: Run Hypothesis Doctor (if mode != incremental) ----

    if (
      mode !== 'incremental' &&
      analystOutput.result.success &&
      analystOutput.result.handoff
    ) {
      console.log('[analyze] Running Hypothesis Doctor...')
      const doctorOutput = await runHypothesisDoctor(
        analystOutput.result.handoff,
        previousTracker?.content,
      )
      personasRun.push('hypothesis_doctor')
      documentsUpdated.push(...doctorOutput.kbUpdates)
      hypothesesCount = doctorOutput.hypotheses.length

      if (!doctorOutput.result.success) {
        errors.push(`hypothesis_doctor: ${doctorOutput.result.error ?? 'Unknown error'}`)
      }

      // ---- Step 3: Run Challenger (if doctor succeeded with hypotheses) ----

      if (
        doctorOutput.result.success &&
        doctorOutput.hypotheses.length > 0 &&
        doctorOutput.result.handoff
      ) {
        console.log('[analyze] Running Challenger...')
        const challengerOutput = await runChallenger(
          doctorOutput.result.handoff,
          doctorOutput.hypotheses,
        )
        personasRun.push('challenger')
        documentsUpdated.push(...challengerOutput.kbUpdates)

        if (!challengerOutput.result.success) {
          errors.push(`challenger: ${challengerOutput.result.error ?? 'Unknown error'}`)
        }
      }
    }

    const durationMs = Date.now() - pipelineStart
    console.log(`[analyze] Pipeline complete in ${durationMs}ms. Personas: ${personasRun.join(', ')}`)

    return Response.json({
      success: true,
      mode,
      reason,
      personas_run: personasRun,
      documents_updated: [...new Set(documentsUpdated)],
      hypotheses_count: hypothesesCount,
      errors,
      duration_ms: durationMs,
    })
  } catch (error: unknown) {
    console.error('[analyze] Pipeline error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
