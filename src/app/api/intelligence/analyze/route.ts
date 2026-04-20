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
import { runResearchLibrarian } from '@/lib/intelligence/personas/research-librarian'
import { runNextBestAction } from '@/lib/intelligence/personas/next-best-action'
import { runSynthesizer } from '@/lib/intelligence/personas/synthesizer'
import type { AnalysisMode, HypothesisRecord, PersonaHandoff } from '@/lib/intelligence/types'
import { requireAuth } from '@/lib/auth/require-user'
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'

export const maxDuration = 300

const VALID_MODES: AnalysisMode[] = ['incremental', 'standard', 'full', 'doctor_prep']

export async function POST(request: Request) {
  const pipelineStart = Date.now()
  const audit = auditMetaFromRequest(request)

  const auth = requireAuth(request)
  if (!auth.ok) {
    await recordAuditEvent({
      endpoint: 'POST /api/intelligence/analyze',
      actor: audit.ip ?? 'unauthenticated',
      outcome: 'deny',
      status: 401,
      reason: 'auth',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return auth.response
  }

  // Full pipeline is 6 Claude calls. Rate-limit tightly to bound cost.
  const limit = checkRateLimit({
    scope: 'intelligence:analyze',
    max: 3,
    windowMs: 60 * 60 * 1000,
    key: clientIdFromRequest(request),
  })
  if (!limit.ok) {
    await recordAuditEvent({
      endpoint: 'POST /api/intelligence/analyze',
      actor: `via:`,
      outcome: 'deny',
      status: 429,
      reason: 'rate-limit',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return Response.json({ success: false, error: 'Rate limit exceeded.' }, { status: 429 })
  }

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
        const allHandoffs: PersonaHandoff[] = []
        let currentHypotheses: HypothesisRecord[] = doctorOutput.hypotheses

        if (analystOutput.result.handoff) allHandoffs.push(analystOutput.result.handoff)
        if (doctorOutput.result.handoff) allHandoffs.push(doctorOutput.result.handoff)

        if (!challengerOutput.result.success) {
          errors.push(`challenger: ${challengerOutput.result.error ?? 'Unknown error'}`)
        } else if (challengerOutput.result.handoff) {
          allHandoffs.push(challengerOutput.result.handoff)
        }

        // ---- Step 4: Run Research Librarian (full/doctor_prep modes) ----

        if (mode === 'full' || mode === 'doctor_prep') {
          console.log('[analyze] Running Research Librarian...')
          const trackerDoc = await getKBDocument('hypothesis_tracker')
          const librarianOutput = await runResearchLibrarian(
            challengerOutput.result.handoff ?? { persona: 'challenger', findings: [], data_quality: '', delta: '', handoff_message: '' },
            trackerDoc?.content ?? '',
          )
          personasRun.push('research_librarian')
          documentsUpdated.push(...librarianOutput.kbUpdates)

          if (!librarianOutput.result.success) {
            errors.push(`research_librarian: ${librarianOutput.result.error ?? 'Unknown error'}`)
          } else if (librarianOutput.result.handoff) {
            allHandoffs.push(librarianOutput.result.handoff)
          }

          // ---- Step 5: Run Next Best Action ----

          console.log('[analyze] Running Next Best Action...')
          const nbaOutput = await runNextBestAction(
            librarianOutput.result.handoff ?? { persona: 'research_librarian', findings: [], data_quality: '', delta: '', handoff_message: '' },
            currentHypotheses,
            trackerDoc?.content ?? '',
          )
          personasRun.push('next_best_action')
          documentsUpdated.push(...nbaOutput.kbUpdates)

          if (!nbaOutput.result.success) {
            errors.push(`next_best_action: ${nbaOutput.result.error ?? 'Unknown error'}`)
          } else if (nbaOutput.result.handoff) {
            allHandoffs.push(nbaOutput.result.handoff)
          }

          // ---- Step 6: Run Synthesizer ----

          console.log('[analyze] Running Synthesizer...')
          const synthOutput = await runSynthesizer(allHandoffs, currentHypotheses)
          personasRun.push('synthesizer')
          documentsUpdated.push(...synthOutput.kbUpdates)

          if (!synthOutput.result.success) {
            errors.push(`synthesizer: ${synthOutput.result.error ?? 'Unknown error'}`)
          }

          if (synthOutput.urgent.length > 0) {
            console.log(`[analyze] URGENT findings: ${synthOutput.urgent.join('; ')}`)
          }
        }
      }
    }

    const durationMs = Date.now() - pipelineStart
    console.log(`[analyze] Pipeline complete in ${durationMs}ms. Personas: ${personasRun.join(', ')}`)

    await recordAuditEvent({
      endpoint: 'POST /api/intelligence/analyze',
      actor: `via:`,
      outcome: 'allow',
      status: 200,
      ip: audit.ip,
      userAgent: audit.userAgent,
      meta: { mode, personas_run: personasRun.length, hypotheses_count: hypothesesCount },
    })

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
    await recordAuditEvent({
      endpoint: 'POST /api/intelligence/analyze',
      actor: `via:`,
      outcome: 'error',
      status: 500,
      reason: 'pipeline',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return Response.json(
      { success: false, error: 'Analysis pipeline failed' },
      { status: 500 },
    )
  }
}
