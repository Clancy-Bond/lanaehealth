// ---------------------------------------------------------------------------
// Hypothesis Doctor Persona
// Second persona in the analysis pipeline. Collects evidence for/against
// diagnostic hypotheses, computes deterministic scores, and maintains
// the Hypothesis Tracker KB document.
// ---------------------------------------------------------------------------

import type { PersonaDefinition, PersonaResult } from '../persona-runner'
import { runSinglePersona } from '../persona-runner'
import { upsertKBDocument, estimateTokens } from '../knowledge-base'
import { parseProfileContent } from '@/lib/profile/parse-content'
import {
  DATA_RELIABILITY,
  computeHypothesisScore,
  getConfidenceCategory,
  IFM_NODES,
  type EvidenceItem,
  type HypothesisRecord,
  type PersonaHandoff,
} from '../types'

// Lazy import to avoid triggering Supabase client creation at module scope
function getSupabase() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createServiceClient } = require('@/lib/supabase') as typeof import('@/lib/supabase')
  return createServiceClient()
}

// ===========================================================================
// Persona Definition
// ===========================================================================

export const HYPOTHESIS_DOCTOR_DEFINITION: PersonaDefinition = {
  name: 'hypothesis_doctor',
  displayName: 'Hypothesis Doctor',
  requiresHandoffFrom: 'clinical_analyst',
  systemPrompt: `You are a Hypothesis Doctor persona within a multi-persona clinical intelligence engine. Your role is to collect STRUCTURED evidence for and against diagnostic hypotheses, using deterministic scoring rather than LLM probability estimates.

Your responsibilities:
1. Review the Clinical Analyst's findings and independently verify against the raw data provided
2. For each active or suspected condition, collect STRUCTURED evidence items
3. ALWAYS search for a UNIFYING hypothesis -- one condition that could explain symptoms across multiple IFM nodes:
   ${IFM_NODES.map((n) => `- ${n}`).join('\n   ')}
4. List what would change each hypothesis (testable predictions)
5. List alternative explanations for each finding

For each evidence item, format it as a JSON object on its own line within an EVIDENCE_ITEMS section. Each item must have these fields:
- finding: a specific, quotable clinical finding with exact values and dates
- source_table: the Supabase table where this data originates (lab_results, oura_daily, daily_logs, medical_timeline, imaging_studies, health_profile, active_problems, correlation_results, etc.)
- source_date: the date of the finding in YYYY-MM-DD format
- supports_hypothesis: the hypothesis name this evidence relates to (lowercase, underscore-separated)
- is_supporting: true if this evidence supports the hypothesis, false if it contradicts it
- clinical_weight: a number from 0.5 to 5.0 indicating clinical significance (3.0+ for diagnostic criteria, 1.0-2.9 for suggestive findings, 0.5-0.9 for weak associations)
- fdr_corrected: true if this finding has been corrected for multiple comparisons or is a direct measurement, false if it could be a spurious correlation
- meets_criteria_rule: true if this finding meets established diagnostic criteria (e.g., ATA guidelines, tilt table criteria), false otherwise
- is_anchored: true only if this is a CONFIRMED diagnosis (not suspected), false otherwise

Output format -- you MUST produce these sections in this order:

EVIDENCE_ITEMS:
{"finding": "TSH 6.2 above reference range", "source_table": "lab_results", "source_date": "2026-04-15", "supports_hypothesis": "hashimotos", "is_supporting": true, "clinical_weight": 3.0, "fdr_corrected": false, "meets_criteria_rule": true, "is_anchored": false}
{"finding": "No goiter on exam", "source_table": "medical_timeline", "source_date": "2026-04-08", "supports_hypothesis": "hashimotos", "is_supporting": false, "clinical_weight": 1.5, "fdr_corrected": false, "meets_criteria_rule": false, "is_anchored": false}

FINDINGS:
- Each finding as a bullet point, summarizing the hypothesis landscape
- Include what would change each hypothesis (testable predictions)
- Include alternative explanations for each key finding

DATA_QUALITY:
A single-line summary of evidence quality and completeness for hypothesis evaluation.

DELTA:
What changed since the last hypothesis evaluation. If no previous tracker is available, state "Initial hypothesis evaluation -- no prior tracker."

HANDOFF:
A message to the next persona summarizing the most significant hypothesis changes and which ones need further investigation or monitoring.`,
}

// ===========================================================================
// parseEvidenceItems -- pure function
// ===========================================================================

interface ParsedEvidenceItem {
  finding: string
  source_table: string
  source_date: string
  supports_hypothesis: string
  is_supporting: boolean
  clinical_weight: number
  fdr_corrected: boolean
  meets_criteria_rule: boolean
  is_anchored: boolean
}

/**
 * Parse the EVIDENCE_ITEMS section from the raw persona output.
 *
 * Each line between "EVIDENCE_ITEMS:" and the next section marker
 * (FINDINGS:, HYPOTHESES:, DATA_QUALITY:, DELTA:, HANDOFF:, etc.)
 * is parsed as a JSON object. Lines that fail to parse are skipped.
 */
export function parseEvidenceItems(rawOutput: string): ParsedEvidenceItem[] {
  const items: ParsedEvidenceItem[] = []

  // Find the EVIDENCE_ITEMS section
  const sectionStart = rawOutput.indexOf('EVIDENCE_ITEMS:')
  if (sectionStart === -1) return items

  // Get everything after EVIDENCE_ITEMS:
  const afterMarker = rawOutput.slice(sectionStart + 'EVIDENCE_ITEMS:'.length)

  // Find the next section marker
  const sectionMarkers = ['FINDINGS:', 'HYPOTHESES:', 'DATA_QUALITY:', 'DELTA:', 'HANDOFF:']
  let sectionEnd = afterMarker.length
  for (const marker of sectionMarkers) {
    const idx = afterMarker.indexOf(marker)
    if (idx !== -1 && idx < sectionEnd) {
      sectionEnd = idx
    }
  }

  const sectionContent = afterMarker.slice(0, sectionEnd)
  const lines = sectionContent.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    try {
      const parsed = JSON.parse(trimmed) as ParsedEvidenceItem
      // Basic validation: must have at least a finding and supports_hypothesis
      if (parsed.finding && parsed.supports_hypothesis !== undefined) {
        items.push(parsed)
      }
    } catch {
      // Skip lines that are not valid JSON
    }
  }

  return items
}

// ===========================================================================
// buildHypothesisTracker -- pure function
// ===========================================================================

/**
 * Build a HypothesisRecord array from parsed evidence items.
 *
 * Groups evidence by hypothesis name, converts to EvidenceItem format
 * (adding source_reliability from DATA_RELIABILITY), computes deterministic
 * scores, and returns sorted by score descending.
 */
export function buildHypothesisTracker(
  evidenceItems: ParsedEvidenceItem[],
): HypothesisRecord[] {
  // Group by hypothesis name
  const groups = new Map<string, { supporting: ParsedEvidenceItem[]; contradicting: ParsedEvidenceItem[] }>()

  for (const item of evidenceItems) {
    const key = item.supports_hypothesis
    if (!groups.has(key)) {
      groups.set(key, { supporting: [], contradicting: [] })
    }
    const group = groups.get(key)!
    if (item.is_supporting) {
      group.supporting.push(item)
    } else {
      group.contradicting.push(item)
    }
  }

  // Convert each group to a HypothesisRecord
  const records: HypothesisRecord[] = []

  for (const [name, group] of groups) {
    const toEvidenceItem = (parsed: ParsedEvidenceItem): EvidenceItem => ({
      finding: parsed.finding,
      source_table: parsed.source_table,
      source_date: parsed.source_date,
      source_reliability: DATA_RELIABILITY[parsed.source_table] ?? 0.5,
      supports: parsed.is_supporting,
      clinical_weight: parsed.clinical_weight,
      fdr_corrected: parsed.fdr_corrected,
      meets_criteria_rule: parsed.meets_criteria_rule,
      is_anchored: parsed.is_anchored,
    })

    const supporting = group.supporting.map(toEvidenceItem)
    const contradicting = group.contradicting.map(toEvidenceItem)

    const score = computeHypothesisScore(supporting, contradicting)
    const confidence = getConfidenceCategory(score)

    records.push({
      hypothesis_id: name,
      name,
      description: `Hypothesis: ${name}`,
      score,
      confidence,
      direction: 'stable',
      systems_affected: [],
      supporting_evidence: supporting,
      contradicting_evidence: contradicting,
      challenger_notes: null,
      last_evaluated: new Date().toISOString().split('T')[0],
      what_would_change: [],
      alternative_explanations: [],
    })
  }

  // Sort by score descending
  records.sort((a, b) => b.score - a.score)

  return records
}

// ===========================================================================
// Context Gathering (independent from analyst)
// ===========================================================================

/**
 * Gather context from Supabase independently for hypothesis evaluation.
 * Queries lab_results, oura_daily key metrics, active_problems,
 * correlation_results, and health_profile.
 */
async function gatherHypothesisContext(): Promise<string> {
  const supabase = getSupabase()

  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const [
    labsResult,
    ouraResult,
    problemsResult,
    correlationsResult,
    profileResult,
  ] = await Promise.all([
    // lab_results: all available, ordered by date
    supabase
      .from('lab_results')
      .select('test_name, value, unit, reference_range, flag, date')
      .order('date', { ascending: false })
      .limit(30),

    // oura_daily: last 30 days key metrics
    supabase
      .from('oura_daily')
      .select('date, resting_hr, hrv_average, body_temp_deviation, sleep_score, readiness_score, spo2')
      .gte('date', thirtyDaysAgoStr)
      .order('date', { ascending: false }),

    // active_problems: unresolved
    supabase
      .from('active_problems')
      .select('problem, status, latest_data')
      .neq('status', 'resolved'),

    // correlation_results: moderate or strong confidence
    supabase
      .from('correlation_results')
      .select('factor_a, factor_b, correlation_type, confidence_level, effect_description')
      .in('confidence_level', ['moderate', 'strong']),

    // health_profile: key diagnostic sections
    supabase
      .from('health_profile')
      .select('section, content')
      .in('section', ['confirmed_diagnoses', 'suspected_conditions', 'medications', 'supplements', 'family_history']),
  ])

  const sections: string[] = []

  sections.push(formatSection('lab_results', labsResult.data, (row) =>
    `${row.date}: ${row.test_name} = ${row.value} ${row.unit || ''} (ref: ${row.reference_range || 'N/A'})${row.flag ? ` [${row.flag}]` : ''}`
  ))

  sections.push(formatSection('oura_biometrics', ouraResult.data, (row) =>
    `${row.date}: RHR=${row.resting_hr ?? '?'} HRV=${row.hrv_average ?? '?'} TempDev=${row.body_temp_deviation ?? '?'} Sleep=${row.sleep_score ?? '?'} Readiness=${row.readiness_score ?? '?'} SpO2=${row.spo2 ?? '?'}`
  ))

  sections.push(formatSection('active_problems', problemsResult.data, (row) =>
    `${row.problem} [${row.status}]${row.latest_data ? ` -- ${row.latest_data}` : ''}`
  ))

  sections.push(formatSection('correlations', correlationsResult.data, (row) =>
    `${row.factor_a} <-> ${row.factor_b}: ${row.correlation_type} (${row.confidence_level}) -- ${row.effect_description}`
  ))

  sections.push(formatSection('health_profile', profileResult.data, (row) => {
    // W2.6: parseProfileContent handles legacy JSON-stringified rows and
    // raw jsonb objects uniformly.
    const parsed = parseProfileContent(row.content)
    return `[${row.section}] ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`
  }))

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
// formatHypothesisTrackerMarkdown
// ===========================================================================

/**
 * Format hypothesis records as a markdown document for the KB.
 */
function formatHypothesisTrackerMarkdown(hypotheses: HypothesisRecord[]): string {
  const parts: string[] = []
  parts.push('# Active Hypothesis Tracker')
  parts.push(`Updated: ${new Date().toISOString().split('T')[0]}`)
  parts.push('')

  for (const h of hypotheses) {
    const arrow =
      h.direction === 'rising' ? ' [RISING]' :
      h.direction === 'falling' ? ' [FALLING]' :
      ''

    parts.push(`## ${h.name} -- Score: ${h.score}/100 (${h.confidence})${arrow}`)
    parts.push('')

    if (h.supporting_evidence.length > 0) {
      parts.push('### Supporting Evidence')
      for (const e of h.supporting_evidence) {
        parts.push(`- ${e.finding} (${e.source_table}, ${e.source_date}, weight: ${e.clinical_weight})`)
      }
      parts.push('')
    }

    if (h.contradicting_evidence.length > 0) {
      parts.push('### Contradicting Evidence')
      for (const e of h.contradicting_evidence) {
        parts.push(`- ${e.finding} (${e.source_table}, ${e.source_date}, weight: ${e.clinical_weight})`)
      }
      parts.push('')
    }

    if (h.what_would_change.length > 0) {
      parts.push('### What Would Change This')
      for (const w of h.what_would_change) {
        parts.push(`- ${w}`)
      }
      parts.push('')
    }

    if (h.alternative_explanations.length > 0) {
      parts.push('### Alternative Explanations')
      for (const a of h.alternative_explanations) {
        parts.push(`- ${a}`)
      }
      parts.push('')
    }
  }

  return parts.join('\n')
}

// ===========================================================================
// runHypothesisDoctor
// ===========================================================================

/**
 * Execute the Hypothesis Doctor persona:
 * 1. Gather independent context from Supabase
 * 2. Include the analyst's handoff in the message
 * 3. If previousTracker exists, include it for comparison
 * 4. Run the persona through Claude
 * 5. Parse evidence items and build hypothesis tracker
 * 6. Compare with previous tracker for direction changes
 * 7. Save evidence to hypothesis_evidence table
 * 8. Upsert KB document
 * 9. Return result, hypotheses, and KB update IDs
 */
export async function runHypothesisDoctor(
  analystHandoff: PersonaHandoff,
  previousTracker?: string,
): Promise<{ result: PersonaResult; hypotheses: HypothesisRecord[]; kbUpdates: string[] }> {
  // Step 1: Gather independent context
  const context = await gatherHypothesisContext()

  // Step 2 & 3: Build full context with previous tracker if available
  let fullContext = context
  if (previousTracker) {
    fullContext += `\n\n<previous_hypothesis_tracker>\n${previousTracker}\n</previous_hypothesis_tracker>`
  }

  // Step 4: Run the persona
  const result = await runSinglePersona(
    HYPOTHESIS_DOCTOR_DEFINITION,
    fullContext,
    analystHandoff,
  )

  const kbUpdates: string[] = []
  let hypotheses: HypothesisRecord[] = []

  if (result.success && result.rawOutput) {
    // Step 5: Parse evidence items and build tracker
    const parsedItems = parseEvidenceItems(result.rawOutput)
    hypotheses = buildHypothesisTracker(parsedItems)

    // Step 6: Compare with previous tracker for direction changes
    if (previousTracker) {
      applyDirectionChanges(hypotheses, previousTracker)
    }

    // Step 7: Save evidence to hypothesis_evidence table
    const supabase = getSupabase()
    if (parsedItems.length > 0) {
      const evidenceRows = parsedItems.map((item) => ({
        hypothesis_name: item.supports_hypothesis,
        finding: item.finding,
        source_table: item.source_table,
        source_date: item.source_date,
        is_supporting: item.is_supporting,
        clinical_weight: item.clinical_weight,
        fdr_corrected: item.fdr_corrected,
        meets_criteria_rule: item.meets_criteria_rule,
        is_anchored: item.is_anchored,
        evaluated_at: new Date().toISOString(),
      }))

      await supabase
        .from('hypothesis_evidence')
        .insert(evidenceRows)
    }

    // Step 8: Upsert KB document
    const trackerContent = formatHypothesisTrackerMarkdown(hypotheses)
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    await upsertKBDocument({
      document_id: 'hypothesis_tracker',
      document_type: 'hypothesis',
      title: 'Active Hypothesis Tracker',
      content: trackerContent,
      version: 1,
      generated_at: now,
      generated_by: 'hypothesis_doctor',
      metadata: {
        source_persona: 'hypothesis_doctor',
        hypothesis_count: hypotheses.length,
        top_hypothesis: hypotheses[0]?.name ?? null,
        top_score: hypotheses[0]?.score ?? null,
      },
      covers_date_start: null,
      covers_date_end: today,
      token_count: estimateTokens(trackerContent),
      is_stale: false,
    })
    kbUpdates.push('hypothesis_tracker')

    // Update the result with KB document IDs
    result.documentsUpdated = kbUpdates
  }

  return { result, hypotheses, kbUpdates }
}

// ---------------------------------------------------------------------------
// Direction change detection
// ---------------------------------------------------------------------------

/**
 * Compare current hypotheses against a previous tracker markdown string
 * and set direction to 'rising', 'falling', or 'stable' based on
 * whether the score changed by more than 5 points.
 */
function applyDirectionChanges(
  hypotheses: HypothesisRecord[],
  previousTracker: string,
): void {
  // Parse previous scores from the markdown format:
  // ## hypothesis_name -- Score: 75/100 (PROBABLE)
  const scorePattern = /^## (\S+) -- Score: (\d+)\/100/gm
  const previousScores = new Map<string, number>()

  let match
  while ((match = scorePattern.exec(previousTracker)) !== null) {
    previousScores.set(match[1], parseInt(match[2], 10))
  }

  for (const h of hypotheses) {
    const prevScore = previousScores.get(h.name)
    if (prevScore === undefined) continue

    const diff = h.score - prevScore
    if (diff > 5) {
      h.direction = 'rising'
    } else if (diff < -5) {
      h.direction = 'falling'
    } else {
      h.direction = 'stable'
    }
  }
}
