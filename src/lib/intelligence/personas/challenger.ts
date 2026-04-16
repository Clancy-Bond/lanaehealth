// ---------------------------------------------------------------------------
// Challenger Persona
// Third persona in the analysis pipeline. Its SOLE JOB is to fight anchoring
// bias and find contradictions. Attacks the leading hypothesis, checks for
// stagnation, echo chamber effects, and diagnoses not being tracked.
// ---------------------------------------------------------------------------

import type { PersonaDefinition, PersonaResult } from '../persona-runner'
import { runSinglePersona } from '../persona-runner'
import { upsertKBDocument, getKBDocument, estimateTokens } from '../knowledge-base'
import type { HypothesisRecord, PersonaHandoff } from '../types'

// Lazy import to avoid triggering Supabase client creation at module scope
function getSupabase() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createServiceClient } = require('@/lib/supabase') as typeof import('@/lib/supabase')
  return createServiceClient()
}

// ===========================================================================
// Persona Definition
// ===========================================================================

export const CHALLENGER_DEFINITION: PersonaDefinition = {
  name: 'challenger',
  displayName: 'Challenger',
  requiresHandoffFrom: 'hypothesis_doctor',
  systemPrompt: `You are the Challenger - a clinical devil's advocate. Your ONLY job is to prevent anchoring bias and find what the other personas missed.

RULES:
1. Take the #1 ranked hypothesis and ask: "What if this is WRONG?"
2. For EACH hypothesis, actively search for contradicting evidence in the provided data
3. Check if evidence is being DOUBLE-COUNTED across hypotheses (same finding supporting multiple hypotheses inflates overall confidence)
4. Look for diagnoses NOT currently being tracked that could explain the data
5. Check if any hypothesis has been stable for too long without new evidence (stagnation)
6. Verify that the Hypothesis Doctor's claims are actually supported by the raw data (independent verification)
7. Flag if any hypothesis rests primarily on non-FDR-corrected correlations
8. Check if data quality issues (low completeness, low reliability) are artificially inflating confidence
9. Consider base rates - rare diseases should require stronger evidence than common ones

OUTPUT FORMAT:
CHALLENGES:
- [Specific attack on hypothesis #1 with data citation]
- [Specific attack on hypothesis #2 with data citation]
...

STAGNATION:
- [Hypotheses unchanged for >30 days, if any]

ECHO_CHECK:
- [Findings where analyst and doctor agreed without independent evidence]

MISSING_DIAGNOSES:
- [Conditions not being tracked that could explain the data]

FINDINGS:
[Summary of all challenges]

DATA_QUALITY:
[Assessment of how data quality affects current hypotheses]

DELTA:
[What changed since last challenge]

HANDOFF:
Research Librarian should investigate: [specific questions arising from challenges]`,
}

// ===========================================================================
// detectStagnation -- pure function, no DB/API calls
// ===========================================================================

/**
 * Check each hypothesis's last_evaluated date. If the difference between
 * now and last_evaluated exceeds daysSinceThreshold, the hypothesis is
 * considered stagnant.
 *
 * Returns an array of hypothesis names that are stagnant.
 */
export function detectStagnation(
  hypotheses: HypothesisRecord[],
  daysSinceThreshold: number = 30,
): string[] {
  const stagnant: string[] = []
  const now = new Date()

  for (const h of hypotheses) {
    const lastEval = new Date(h.last_evaluated + 'T00:00:00Z')
    const diffMs = now.getTime() - lastEval.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays > daysSinceThreshold) {
      stagnant.push(h.name)
    }
  }

  return stagnant
}

// ===========================================================================
// detectDoubleCounting -- pure function, no DB/API calls
// ===========================================================================

/**
 * Look across ALL hypotheses' supporting_evidence arrays. Find evidence
 * items where the same `finding` text appears in more than one hypothesis.
 *
 * Returns an array of { finding, hypotheses[] } for double-counted items.
 */
export function detectDoubleCounting(
  hypotheses: HypothesisRecord[],
): Array<{ finding: string; hypotheses: string[] }> {
  // Map: finding text -> set of hypothesis names that use it
  const findingMap = new Map<string, Set<string>>()

  for (const h of hypotheses) {
    for (const e of h.supporting_evidence) {
      const existing = findingMap.get(e.finding)
      if (existing) {
        existing.add(h.name)
      } else {
        findingMap.set(e.finding, new Set([h.name]))
      }
    }
  }

  // Filter to findings present in more than one hypothesis
  const doubles: Array<{ finding: string; hypotheses: string[] }> = []

  for (const [finding, hypothesisSet] of findingMap) {
    if (hypothesisSet.size > 1) {
      doubles.push({ finding, hypotheses: Array.from(hypothesisSet) })
    }
  }

  return doubles
}

// ===========================================================================
// Context Gathering (independent from doctor)
// ===========================================================================

/**
 * Gather context from Supabase independently for challenger verification.
 * Queries active_problems, lab_results, and correlation_results so the
 * Challenger can independently verify the Hypothesis Doctor's claims.
 */
async function gatherChallengerContext(): Promise<string> {
  const supabase = getSupabase()

  const [
    problemsResult,
    labsResult,
    correlationsResult,
  ] = await Promise.all([
    // active_problems: unresolved
    supabase
      .from('active_problems')
      .select('problem, status, latest_data')
      .neq('status', 'resolved'),

    // lab_results: all available, ordered by date
    supabase
      .from('lab_results')
      .select('test_name, value, unit, reference_range, flag, date')
      .order('date', { ascending: false })
      .limit(30),

    // correlation_results: all confidence levels for independent check
    supabase
      .from('correlation_results')
      .select('factor_a, factor_b, correlation_type, confidence_level, effect_description, p_value'),
  ])

  const sections: string[] = []

  sections.push(formatSection('active_problems', problemsResult.data, (row: { problem: string; status: string; latest_data?: string }) =>
    `${row.problem} [${row.status}]${row.latest_data ? ` -- ${row.latest_data}` : ''}`
  ))

  sections.push(formatSection('lab_results', labsResult.data, (row: { date: string; test_name: string; value: string; unit?: string; reference_range?: string; flag?: string }) =>
    `${row.date}: ${row.test_name} = ${row.value} ${row.unit || ''} (ref: ${row.reference_range || 'N/A'})${row.flag ? ` [${row.flag}]` : ''}`
  ))

  sections.push(formatSection('correlation_results', correlationsResult.data, (row: { factor_a: string; factor_b: string; correlation_type: string; confidence_level: string; effect_description: string; p_value?: number }) =>
    `${row.factor_a} <-> ${row.factor_b}: ${row.correlation_type} (${row.confidence_level})${row.p_value !== undefined ? ` p=${row.p_value}` : ''} -- ${row.effect_description}`
  ))

  return sections.join('\n\n')
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatSection<T>(
  tag: string,
  data: T[] | null,
  formatter: (row: T) => string,
): string {
  if (!data || data.length === 0) {
    return `<${tag}>\nNo data available\n</${tag}>`
  }
  const lines = data.map(formatter).join('\n')
  return `<${tag}>\n${lines}\n</${tag}>`
}

// ===========================================================================
// runChallenger
// ===========================================================================

/**
 * Execute the Challenger persona:
 * 1. Gather independent context from Supabase (active_problems, lab_results,
 *    correlation_results) for INDEPENDENT verification
 * 2. Run detectStagnation and detectDoubleCounting on current hypotheses
 * 3. Build full context with doctor's handoff, hypothesis tracker,
 *    stagnation alerts, and double-counting alerts
 * 4. Call runSinglePersona()
 * 5. Extract CHALLENGES, STAGNATION, ECHO_CHECK, MISSING_DIAGNOSES from output
 * 6. Update the hypothesis_tracker KB document by appending a
 *    "## Challenger Assessment" section
 * 7. Return result, challenger notes string, and KB update IDs
 */
export async function runChallenger(
  doctorHandoff: PersonaHandoff,
  hypotheses: HypothesisRecord[],
): Promise<{ result: PersonaResult; challengerNotes: string; kbUpdates: string[] }> {
  // Step 1: Gather independent context
  const independentContext = await gatherChallengerContext()

  // Step 2: Run pure detection functions
  const stagnant = detectStagnation(hypotheses)
  const doubleCounted = detectDoubleCounting(hypotheses)

  // Step 3: Build full context
  const hypothesisContext = hypotheses.map((h) => {
    const supporting = h.supporting_evidence.map(
      (e) => `  + ${e.finding} (${e.source_table}, ${e.source_date}, weight: ${e.clinical_weight}, FDR: ${e.fdr_corrected})`,
    ).join('\n')
    const contradicting = h.contradicting_evidence.map(
      (e) => `  - ${e.finding} (${e.source_table}, ${e.source_date}, weight: ${e.clinical_weight}, FDR: ${e.fdr_corrected})`,
    ).join('\n')

    return `### ${h.name} -- Score: ${h.score}/100 (${h.confidence}) [${h.direction}]
Last evaluated: ${h.last_evaluated}
Supporting:
${supporting || '  (none)'}
Contradicting:
${contradicting || '  (none)'}`
  }).join('\n\n')

  let fullContext = `<independent_data>\n${independentContext}\n</independent_data>\n\n`
  fullContext += `<hypothesis_tracker>\n${hypothesisContext}\n</hypothesis_tracker>\n\n`

  if (stagnant.length > 0) {
    fullContext += `<stagnation_alerts>\nThe following hypotheses have not been re-evaluated in over 30 days: ${stagnant.join(', ')}\n</stagnation_alerts>\n\n`
  }

  if (doubleCounted.length > 0) {
    const dcLines = doubleCounted.map(
      (dc) => `- "${dc.finding}" is used in: ${dc.hypotheses.join(', ')}`,
    ).join('\n')
    fullContext += `<double_counting_alerts>\n${dcLines}\n</double_counting_alerts>\n\n`
  }

  // Step 4: Run the persona
  const result = await runSinglePersona(
    CHALLENGER_DEFINITION,
    fullContext,
    doctorHandoff,
  )

  const kbUpdates: string[] = []
  let challengerNotes = ''

  if (result.success && result.rawOutput) {
    // Step 5: Extract sections from output
    challengerNotes = extractChallengerSections(result.rawOutput)

    // Step 6: Update hypothesis_tracker KB document
    const existingTracker = await getKBDocument('hypothesis_tracker')
    if (existingTracker) {
      const now = new Date().toISOString()
      const today = now.split('T')[0]

      // Append challenger assessment to existing tracker content
      const updatedContent = existingTracker.content + '\n\n' + challengerNotes

      await upsertKBDocument({
        document_id: 'hypothesis_tracker',
        document_type: 'hypothesis',
        title: 'Active Hypothesis Tracker',
        content: updatedContent,
        version: existingTracker.version + 1,
        generated_at: now,
        generated_by: 'challenger',
        metadata: {
          ...(existingTracker.metadata as Record<string, unknown>),
          challenger_run: today,
          stagnant_hypotheses: stagnant,
          double_counted_findings: doubleCounted.length,
        },
        covers_date_start: existingTracker.covers_date_start,
        covers_date_end: today,
        token_count: estimateTokens(updatedContent),
        is_stale: false,
      })
      kbUpdates.push('hypothesis_tracker')
    }

    // Update the result with KB document IDs
    result.documentsUpdated = kbUpdates
  }

  return { result, challengerNotes, kbUpdates }
}

// ---------------------------------------------------------------------------
// Section extraction
// ---------------------------------------------------------------------------

/**
 * Extract the Challenger-specific sections from raw output and format
 * them as a markdown "## Challenger Assessment" block for appending
 * to the hypothesis tracker.
 */
function extractChallengerSections(rawOutput: string): string {
  const sections = ['CHALLENGES', 'STAGNATION', 'ECHO_CHECK', 'MISSING_DIAGNOSES']
  const parts: string[] = []

  parts.push(`## Challenger Assessment`)
  parts.push(`Date: ${new Date().toISOString().split('T')[0]}`)
  parts.push('')

  for (const section of sections) {
    const marker = `${section}:`
    const idx = rawOutput.indexOf(marker)
    if (idx === -1) continue

    const afterMarker = rawOutput.slice(idx + marker.length)

    // Find the next section marker (any all-caps word followed by colon)
    const allMarkers = ['CHALLENGES:', 'STAGNATION:', 'ECHO_CHECK:', 'MISSING_DIAGNOSES:', 'FINDINGS:', 'DATA_QUALITY:', 'DELTA:', 'HANDOFF:']
    let endIdx = afterMarker.length
    for (const m of allMarkers) {
      if (m === marker) continue
      const mIdx = afterMarker.indexOf(m)
      if (mIdx !== -1 && mIdx < endIdx) {
        endIdx = mIdx
      }
    }

    const sectionContent = afterMarker.slice(0, endIdx).trim()
    if (sectionContent) {
      parts.push(`### ${section}`)
      parts.push(sectionContent)
      parts.push('')
    }
  }

  return parts.join('\n')
}
