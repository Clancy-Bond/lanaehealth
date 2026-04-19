/**
 * Layer 2: Summary Engine
 *
 * Generates, caches, and retrieves pre-computed clinical summaries.
 * Each summary is produced by Claude from raw database data,
 * cached in the context_summaries table with a 7-day TTL,
 * and selectively injected into conversations based on topic relevance.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { SUMMARY_TOPICS, type SummaryTopic } from './summary-prompts'
import { parseProfileContent } from '@/lib/profile/parse-content'
import { sanitizeForPersistedSummary } from '@/lib/ai/safety/wrap-user-content'

const CACHE_TTL_DAYS = 7

// ── Data Fetching ──────────────────────────────────────────────────

/**
 * Queries a single data source table and returns rows as a JSON string
 * wrapped in XML tags for the Claude prompt.
 */
async function fetchDataSource(
  sb: ReturnType<typeof createServiceClient>,
  table: string,
  ninetyDaysAgo: string,
  today: string,
): Promise<string> {
  let query
  let rows: unknown[] = []

  switch (table) {
    case 'daily_logs': {
      const result = await sb
        .from('daily_logs')
        .select('date, overall_pain, fatigue, bloating, stress, sleep_quality, cycle_phase, notes, daily_impact, what_helped, triggers')
        .gte('date', ninetyDaysAgo)
        .lte('date', today)
        .not('overall_pain', 'is', null)
        .order('date', { ascending: false })
        .limit(50)
      if (result.error) throw new Error(`daily_logs: ${result.error.message}`)
      rows = result.data ?? []
      break
    }

    case 'oura_daily': {
      const result = await sb
        .from('oura_daily')
        .select('date, sleep_score, sleep_duration, deep_sleep_min, rem_sleep_min, hrv_avg, hrv_max, resting_hr, body_temp_deviation, spo2_avg, stress_score, readiness_score, respiratory_rate')
        .gte('date', ninetyDaysAgo)
        .lte('date', today)
        .order('date', { ascending: false })
        .limit(50)
      if (result.error) throw new Error(`oura_daily: ${result.error.message}`)
      rows = result.data ?? []
      break
    }

    case 'symptoms': {
      const result = await sb
        .from('symptoms')
        .select('category, symptom, severity, logged_at')
        .gte('logged_at', ninetyDaysAgo)
        .lte('logged_at', today + 'T23:59:59')
        .order('logged_at', { ascending: false })
        .limit(50)
      if (result.error) throw new Error(`symptoms: ${result.error.message}`)
      rows = result.data ?? []
      break
    }

    case 'lab_results': {
      // Lab results: get ALL results (not just 90 days) to show trajectories
      const result = await sb
        .from('lab_results')
        .select('date, category, test_name, value, unit, reference_range_low, reference_range_high, flag')
        .order('date', { ascending: false })
        .limit(50)
      if (result.error) throw new Error(`lab_results: ${result.error.message}`)
      rows = result.data ?? []
      break
    }

    case 'cycle_entries': {
      const result = await sb
        .from('cycle_entries')
        .select('date, flow_level, menstruation, ovulation_signs, lh_test_result, cervical_mucus_consistency, cervical_mucus_quantity')
        .gte('date', ninetyDaysAgo)
        .lte('date', today)
        .order('date', { ascending: false })
        .limit(50)
      if (result.error) throw new Error(`cycle_entries: ${result.error.message}`)
      rows = result.data ?? []
      break
    }

    case 'nc_imported': {
      const result = await sb
        .from('nc_imported')
        .select('date, temperature, menstruation, flow_quantity, cervical_mucus_consistency, cervical_mucus_quantity, mood_flags, lh_test, cycle_day, cycle_number, fertility_color, ovulation_status')
        .gte('date', ninetyDaysAgo)
        .lte('date', today)
        .order('date', { ascending: false })
        .limit(50)
      if (result.error) throw new Error(`nc_imported: ${result.error.message}`)
      rows = result.data ?? []
      break
    }

    case 'food_entries': {
      const result = await sb
        .from('food_entries')
        .select('meal_type, food_items, calories, macros, flagged_triggers, logged_at')
        .gte('logged_at', ninetyDaysAgo)
        .lte('logged_at', today + 'T23:59:59')
        .order('logged_at', { ascending: false })
        .limit(40)
      if (result.error) throw new Error(`food_entries: ${result.error.message}`)
      rows = result.data ?? []
      break
    }

    case 'correlation_results': {
      // Only moderate + strong correlations
      const result = await sb
        .from('correlation_results')
        .select('factor_a, factor_b, correlation_type, coefficient, p_value, effect_size, effect_description, confidence_level, sample_size, lag_days, cycle_phase, passed_fdr')
        .in('confidence_level', ['moderate', 'strong'])
        .order('computed_at', { ascending: false })
        .limit(30)
      if (result.error) throw new Error(`correlation_results: ${result.error.message}`)
      rows = result.data ?? []
      break
    }

    case 'health_profile': {
      const result = await sb
        .from('health_profile')
        .select('section, content')
      if (result.error) throw new Error(`health_profile: ${result.error.message}`)
      // Normalize legacy JSON-stringified content into raw objects so the
      // Claude prompt sees clean JSON, not double-escaped strings. W2.6.
      rows = (result.data ?? []).map((row) => ({
        section: (row as { section: string }).section,
        content: parseProfileContent((row as { content: unknown }).content),
      }))
      break
    }

    case 'imaging_studies': {
      const result = await sb
        .from('imaging_studies')
        .select('study_date, modality, body_part, indication, findings_summary, report_text')
        .order('study_date', { ascending: false })
        .limit(30)
      if (result.error) throw new Error(`imaging_studies: ${result.error.message}`)
      rows = result.data ?? []
      break
    }

    default: {
      query = null
      break
    }
  }

  // XML tag name derived from table name
  const tagName = table === 'oura_daily' ? 'oura_data' : table
  if (rows.length === 0) {
    return `<${tagName}>No data available</${tagName}>`
  }
  return `<${tagName}>\n${JSON.stringify(rows, null, 1)}\n</${tagName}>`
}

// ── Summary Generation ─────────────────────────────────────────────

/**
 * Generates a clinical summary for a given topic by querying raw data
 * and sending it to Claude for structured summarization.
 */
export async function generateSummary(topic: SummaryTopic): Promise<string> {
  const topicDef = SUMMARY_TOPICS[topic]
  const sb = createServiceClient()

  // Date range
  const today = new Date()
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const todayStr = today.toISOString().split('T')[0]
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0]

  // Fetch all data sources for this topic
  const dataBlocks: string[] = []
  for (const source of topicDef.dataSources) {
    try {
      const block = await fetchDataSource(sb, source, ninetyDaysAgoStr, todayStr)
      dataBlocks.push(block)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      dataBlocks.push(`<${source}>Error fetching data: ${msg}</${source}>`)
    }
  }

  const rawDataXml = dataBlocks.join('\n\n')

  // Build the Claude prompt
  const systemPrompt = `You are a clinical data summarizer for a patient health tracking system. You produce concise, factual summaries from raw health data. You never invent or hallucinate data points. You use exact numbers and dates from the source data.`

  const userPrompt = `Summarize the following raw patient health data into a structured "${topicDef.name}" summary.

Rules:
- Generate a structured summary. Maximum 300 words.
- Use exact numbers and dates from the data.
- Convert any relative dates to absolute dates (today is ${todayStr}).
- DO NOT invent data not present in the raw data.
- If a data source has no data, note its absence briefly and move on.
- Group findings by sub-theme where appropriate.
- Highlight trends, anomalies, and clinically significant values.

Raw data:
${rawDataXml}`

  // Call Claude
  const client = new Anthropic()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: topicDef.maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  // Extract text from response, then scrub any embedded delimiters or
  // injection-style directives that survived from the raw data. Summaries
  // are persisted and reinjected by the assembler on every subsequent
  // call, so this is the round-trip redaction gate.
  const rawSummaryText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
  const summaryText = sanitizeForPersistedSummary(rawSummaryText)

  // Token count estimate
  const tokenCount = Math.round(summaryText.length / 4)

  // Upsert into context_summaries (on conflict with topic column)
  const { error: upsertError } = await sb
    .from('context_summaries')
    .upsert(
      {
        topic,
        content: summaryText,
        generated_at: new Date().toISOString(),
        data_range_start: ninetyDaysAgoStr,
        data_range_end: todayStr,
        token_count: tokenCount,
        version: 1,
      },
      { onConflict: 'topic' },
    )

  if (upsertError) {
    console.error(`Failed to cache summary for ${topic}:`, upsertError.message)
  }

  return summaryText
}

// ── Cache Retrieval ────────────────────────────────────────────────

/**
 * Returns a cached summary if fresh (< 7 days), otherwise regenerates.
 */
export async function getSummary(topic: SummaryTopic): Promise<string> {
  const sb = createServiceClient()

  const { data, error } = await sb
    .from('context_summaries')
    .select('content, generated_at')
    .eq('topic', topic)
    .single()

  if (!error && data) {
    const generatedAt = new Date(data.generated_at)
    const ageMs = Date.now() - generatedAt.getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)

    if (ageDays < CACHE_TTL_DAYS) {
      return data.content
    }
  }

  // Cache miss or stale -- regenerate
  return generateSummary(topic)
}

// ── Batch Regeneration ─────────────────────────────────────────────

/**
 * Regenerates all 32 micro-summaries sequentially to avoid rate limits.
 * Returns a map of topic -> summary text.
 * Individual failures are caught so one bad topic doesn't stop the rest.
 */
export async function regenerateAllSummaries(): Promise<Record<string, string>> {
  const results: Record<string, string> = {}
  const topics = Object.keys(SUMMARY_TOPICS) as SummaryTopic[]

  for (const topic of topics) {
    try {
      results[topic] = await generateSummary(topic)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results[topic] = `ERROR: ${msg}`
      console.error(`Failed to generate summary for ${topic}:`, msg)
    }
  }

  return results
}

// ── Topic Detection ────────────────────────────────────────────────

/**
 * Detects which summary topics are relevant to a user's query
 * by matching keywords. Always includes 'last_90_days' as a baseline.
 */
export function detectRelevantTopics(query: string): SummaryTopic[] {
  const lowerQuery = query.toLowerCase()
  const matched = new Set<SummaryTopic>()

  // Always include baseline
  matched.add('last_90_days')

  const topics = Object.entries(SUMMARY_TOPICS) as [SummaryTopic, (typeof SUMMARY_TOPICS)[SummaryTopic]][]

  for (const [topicKey, topicDef] of topics) {
    if (topicKey === 'last_90_days') continue // already included

    for (const keyword of topicDef.keywords) {
      if (lowerQuery.includes(keyword)) {
        matched.add(topicKey)
        break // one match is enough to include the topic
      }
    }
  }

  return Array.from(matched)
}
