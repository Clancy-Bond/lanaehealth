// ---------------------------------------------------------------------------
// Clinical Analyst Persona
// First persona in the analysis pipeline. Queries ALL data tables
// independently, generates micro-summaries, maps findings to IFM Matrix
// nodes, and produces a data completeness report.
// ---------------------------------------------------------------------------

import type { PersonaDefinition } from '../persona-runner'
import type { PersonaResult } from '../persona-runner'
import { runSinglePersona } from '../persona-runner'
import { upsertKBDocument } from '../knowledge-base'
import { estimateTokens } from '../knowledge-base'
import { computeCompleteness } from '../data-validation'
import { IFM_NODES } from '../types'
import { parseProfileContent } from '@/lib/profile/parse-content'

// Lazy import to avoid triggering Supabase client creation at module scope
function getSupabase() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createServiceClient } = require('@/lib/supabase') as typeof import('@/lib/supabase')
  return createServiceClient()
}

// ===========================================================================
// Persona Definition
// ===========================================================================

export const CLINICAL_ANALYST_DEFINITION: PersonaDefinition = {
  name: 'clinical_analyst',
  displayName: 'Clinical Analyst',
  systemPrompt: `You are a Clinical Analyst persona within a multi-persona clinical intelligence engine. Your role is to analyze ALL provided patient data from multiple body systems and produce a structured analysis.

Your responsibilities:
1. Review all data sections provided (labs, biometrics, symptoms, food, cycle, correlations, active problems, medical history)
2. Map findings to IFM (Institute for Functional Medicine) Matrix nodes:
   ${IFM_NODES.map((n) => `- ${n}`).join('\n   ')}
3. Identify cross-system patterns and temporal trends (e.g., does fatigue worsen in luteal phase? does HRV drop before flare days?)
4. Note data quality issues: gaps in logging, low reliability sources, missing data periods
5. Be specific with dates and values. NEVER paraphrase numbers. Quote exact lab values, dates, and scores.
6. Focus on what CHANGED since the last analysis (delta detection). If previous analysis context is provided, compare current data against it.

Output format - you MUST use these exact section markers:

FINDINGS:
- Each finding as a bullet point with specific dates and values
- Map each finding to one or more IFM Matrix nodes in parentheses
- Include temporal trends where visible
- Note cross-system connections

DATA_QUALITY:
A single-line summary of data completeness and reliability. Include percentages for key data sources.

DELTA:
What changed since the last analysis. If no previous analysis is available, state "Initial analysis - no prior baseline."

HANDOFF:
A message to the next persona (Hypothesis Doctor) summarizing the most clinically significant findings and suggesting which hypotheses to evaluate. Be specific about which patterns warrant deeper investigation.`,
}

// ===========================================================================
// Context Gathering
// ===========================================================================

/**
 * Query ALL relevant Supabase tables independently and assemble a text
 * summary for the Clinical Analyst persona. Each section is wrapped in
 * XML-like tags for clarity.
 */
export async function gatherAnalystContext(): Promise<string> {
  const supabase = getSupabase()

  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const fourteenDaysAgo = new Date(today)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0]
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0]

  // Run all queries in parallel for speed
  const [
    labsResult,
    ouraResult,
    logsResult,
    symptomsResult,
    foodResult,
    cycleResult,
    correlationsResult,
    problemsResult,
    profileResult,
    timelineResult,
  ] = await Promise.all([
    // lab_results: last 20 results ordered by date DESC
    supabase
      .from('lab_results')
      .select('test_name, value, unit, reference_range, flag, date')
      .order('date', { ascending: false })
      .limit(20),

    // oura_daily: last 30 days
    supabase
      .from('oura_daily')
      .select('date, resting_hr, hrv_average, body_temp_deviation, sleep_score, readiness_score, spo2')
      .gte('date', thirtyDaysAgoStr)
      .order('date', { ascending: false }),

    // daily_logs: last 30 days where overall_pain IS NOT NULL.
    // rest_day (migration 020) is selected so the completeness denominator
    // can exclude user-declared rest days. Rest days are expected absences,
    // not missing data. See docs/plans/2026-04-16-non-shaming-voice-rule.md.
    supabase
      .from('daily_logs')
      .select('date, overall_pain, fatigue_level, cycle_phase, notes, rest_day')
      .gte('date', thirtyDaysAgoStr)
      .not('overall_pain', 'is', null)
      .order('date', { ascending: false }),

    // symptoms: last 30 days
    supabase
      .from('symptoms')
      .select('logged_at, symptom, severity, category')
      .gte('logged_at', thirtyDaysAgo.toISOString())
      .order('logged_at', { ascending: false }),

    // food_entries: last 14 days
    supabase
      .from('food_entries')
      .select('logged_at, food_name, meal_type, is_trigger')
      .gte('logged_at', fourteenDaysAgo.toISOString())
      .order('logged_at', { ascending: false }),

    // cycle_entries: last 90 days
    supabase
      .from('cycle_entries')
      .select('date, flow_intensity, menstruation, ovulation_signs')
      .gte('date', ninetyDaysAgoStr)
      .order('date', { ascending: false }),

    // correlation_results: moderate or strong confidence
    supabase
      .from('correlation_results')
      .select('factor_a, factor_b, correlation_type, confidence_level, effect_description')
      .in('confidence_level', ['moderate', 'strong']),

    // active_problems: unresolved
    supabase
      .from('active_problems')
      .select('problem, status, latest_data')
      .neq('status', 'resolved'),

    // health_profile: specific sections
    supabase
      .from('health_profile')
      .select('section, content')
      .in('section', ['confirmed_diagnoses', 'suspected_conditions', 'medications', 'supplements']),

    // medical_timeline: last 10 events
    supabase
      .from('medical_timeline')
      .select('event_date, title, description, significance')
      .order('event_date', { ascending: false })
      .limit(10),
  ])

  // Build the context string with XML-like tags
  const sections: string[] = []

  // Lab results
  sections.push(formatSection('lab_results', labsResult.data, (row) =>
    `${row.date}: ${row.test_name} = ${row.value} ${row.unit || ''} (ref: ${row.reference_range || 'N/A'})${row.flag ? ` [${row.flag}]` : ''}`
  ))

  // Oura biometrics
  sections.push(formatSection('oura_biometrics', ouraResult.data, (row) =>
    `${row.date}: RHR=${row.resting_hr ?? '?'} HRV=${row.hrv_average ?? '?'} TempDev=${row.body_temp_deviation ?? '?'} Sleep=${row.sleep_score ?? '?'} Readiness=${row.readiness_score ?? '?'} SpO2=${row.spo2 ?? '?'}`
  ))

  // Daily logs
  sections.push(formatSection('daily_logs', logsResult.data, (row) =>
    `${row.date}: Pain=${row.overall_pain} Fatigue=${row.fatigue_level ?? '?'} Phase=${row.cycle_phase ?? '?'}${row.notes ? ` Notes: ${row.notes}` : ''}`
  ))

  // Symptoms
  sections.push(formatSection('symptoms', symptomsResult.data, (row) =>
    `${row.logged_at}: ${row.symptom} (severity=${row.severity}, category=${row.category ?? 'uncategorized'})`
  ))

  // Food entries
  sections.push(formatSection('food_entries', foodResult.data, (row) =>
    `${row.logged_at}: ${row.food_name} (${row.meal_type ?? 'unspecified'})${row.is_trigger ? ' [TRIGGER]' : ''}`
  ))

  // Cycle entries
  sections.push(formatSection('cycle_entries', cycleResult.data, (row) =>
    `${row.date}: Flow=${row.flow_intensity ?? 'none'} Menstruation=${row.menstruation ?? false} Ovulation=${row.ovulation_signs ?? 'none'}`
  ))

  // Correlations
  sections.push(formatSection('correlations', correlationsResult.data, (row) =>
    `${row.factor_a} <-> ${row.factor_b}: ${row.correlation_type} (${row.confidence_level}) - ${row.effect_description}`
  ))

  // Active problems
  sections.push(formatSection('active_problems', problemsResult.data, (row) =>
    `${row.problem} [${row.status}]${row.latest_data ? ` - ${row.latest_data}` : ''}`
  ))

  // Health profile
  sections.push(formatSection('health_profile', profileResult.data, (row) => {
    // W2.6: parseProfileContent handles legacy JSON-stringified rows and
    // raw jsonb objects uniformly.
    const parsed = parseProfileContent(row.content)
    return `[${row.section}] ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`
  }))

  // Medical timeline
  sections.push(formatSection('medical_timeline', timelineResult.data, (row) =>
    `${row.event_date}: ${row.title}${row.description ? ` - ${row.description}` : ''} (significance: ${row.significance ?? 'standard'})`
  ))

  // Data completeness section.
  // Rest days (migration 020) are user-declared intentional absences and
  // MUST be subtracted from the denominator so they never register as
  // missing data. This matches the non-shaming-voice rule
  // (docs/plans/2026-04-16-non-shaming-voice-rule.md): rest is not regression.
  type DailyLogForCompleteness = { rest_day?: boolean | null }
  const restDayCount = ((logsResult.data ?? []) as DailyLogForCompleteness[])
    .filter((row) => row?.rest_day === true)
    .length
  const completeness = computeDataCompleteness(
    ouraResult.data?.length ?? 0,
    logsResult.data?.length ?? 0,
    symptomsResult.data?.length ?? 0,
    foodResult.data?.length ?? 0,
    cycleResult.data?.length ?? 0,
    restDayCount,
  )
  sections.push(`<data_completeness>\n${completeness}\n</data_completeness>`)

  return sections.join('\n\n')
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format a query result section with XML-like tags.
 * Returns an empty section tag with "No data available" if data is null/empty.
 */
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

/**
 * Compute data completeness percentages for each source over the last 30 days.
 *
 * restDayCount is subtracted from the daily-logs denominator so user-declared
 * rest days are treated as expected absences, not missing data. See
 * docs/plans/2026-04-16-non-shaming-voice-rule.md for the rule.
 */
function computeDataCompleteness(
  ouraDays: number,
  logDays: number,
  symptomDays: number,
  foodDays: number,
  cycleDays: number,
  restDayCount: number = 0,
): string {
  const totalDays = 30
  // Denominators shrink by the number of rest days so rest days are neutral,
  // never counted as missing. Cap at 1 to avoid divide-by-zero on hypothetical
  // full-rest windows.
  const logDenominator = Math.max(1, totalDays - restDayCount)
  const ouraDenominator = Math.max(1, totalDays - restDayCount)
  const symptomDenominator = Math.max(1, totalDays - restDayCount)

  const lines = [
    `Oura biometrics: ${computeCompleteness(ouraDays, ouraDenominator)}% (${ouraDays}/${ouraDenominator} non-rest days)`,
    `Daily logs (with pain): ${computeCompleteness(logDays, logDenominator)}% (${logDays}/${logDenominator} non-rest days)`,
    `Symptom entries: ${computeCompleteness(symptomDays, symptomDenominator)}% (${symptomDays}/${symptomDenominator} non-rest days)`,
    `Food diary (14-day window): ${computeCompleteness(foodDays, 14)}% (${foodDays}/14 days)`,
    `Cycle entries (90-day window): ${computeCompleteness(cycleDays, 90)}% (${cycleDays}/90 days)`,
    `Rest days logged (last ${totalDays}d): ${restDayCount}`,
  ]
  return lines.join('\n')
}

// ===========================================================================
// Run Clinical Analyst
// ===========================================================================

/**
 * Execute the Clinical Analyst persona:
 * 1. Gather all data context from Supabase
 * 2. Optionally include previous KB content for delta detection
 * 3. Run the persona through Claude
 * 4. Upsert KB documents based on the analysis output
 * 5. Return the result and list of updated KB document IDs
 */
export async function runClinicalAnalyst(
  previousKBContent?: string,
): Promise<{ result: PersonaResult; kbUpdates: string[] }> {
  // Step 1: Gather context
  const context = await gatherAnalystContext()

  // Step 2: Build full context with optional previous analysis
  let fullContext = context
  if (previousKBContent) {
    fullContext += `\n\n<previous_analysis>\n${previousKBContent}\n</previous_analysis>`
  }

  // Step 3: Run the persona
  const result = await runSinglePersona(CLINICAL_ANALYST_DEFINITION, fullContext)

  const kbUpdates: string[] = []

  if (result.success && result.rawOutput) {
    const now = new Date().toISOString()
    const today = now.split('T')[0]
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    // Step 4a: Extract IFM matrix content and upsert
    const ifmContent = extractIFMContent(result.rawOutput)
    await upsertKBDocument({
      document_id: 'ifm_matrix_overview',
      document_type: 'ifm_review',
      title: 'IFM Matrix Overview',
      content: ifmContent,
      version: 1, // upsertKBDocument handles version incrementing
      generated_at: now,
      generated_by: 'clinical_analyst',
      metadata: { source_persona: 'clinical_analyst' },
      covers_date_start: thirtyDaysAgoStr,
      covers_date_end: today,
      token_count: estimateTokens(ifmContent),
      is_stale: false,
    })
    kbUpdates.push('ifm_matrix_overview')

    // Step 4b: Extract completeness content and upsert
    const completenessContent = extractCompletenessContent(result.rawOutput)
    await upsertKBDocument({
      document_id: 'data_completeness',
      document_type: 'completeness',
      title: 'Data Completeness Report',
      content: completenessContent,
      version: 1,
      generated_at: now,
      generated_by: 'clinical_analyst',
      metadata: { source_persona: 'clinical_analyst' },
      covers_date_start: thirtyDaysAgoStr,
      covers_date_end: today,
      token_count: estimateTokens(completenessContent),
      is_stale: false,
    })
    kbUpdates.push('data_completeness')

    // Update the result with KB document IDs
    result.documentsUpdated = kbUpdates
  }

  return { result, kbUpdates }
}

// ---------------------------------------------------------------------------
// Content extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract IFM Matrix-related content from the analyst's raw output.
 * Looks for the FINDINGS section. If not cleanly separated, returns
 * the full analysis minus the DATA_QUALITY section.
 */
function extractIFMContent(rawOutput: string): string {
  // Try to extract the FINDINGS section (which contains IFM mappings)
  const findingsMatch = rawOutput.match(/FINDINGS:\s*([\s\S]*?)(?=DATA_QUALITY:|DELTA:|HANDOFF:|$)/)
  if (findingsMatch && findingsMatch[1].trim().length > 0) {
    return findingsMatch[1].trim()
  }
  // Fallback: return the full output as the IFM overview
  return rawOutput
}

/**
 * Extract data completeness content from the analyst's raw output.
 * Looks for the DATA_QUALITY section.
 */
function extractCompletenessContent(rawOutput: string): string {
  const qualityMatch = rawOutput.match(/DATA_QUALITY:\s*([\s\S]*?)(?=DELTA:|HANDOFF:|$)/)
  if (qualityMatch && qualityMatch[1].trim().length > 0) {
    return qualityMatch[1].trim()
  }
  // Fallback: return a note that the section was not found
  return 'Data quality section not found in analyst output.'
}
