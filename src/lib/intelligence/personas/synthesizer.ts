// ---------------------------------------------------------------------------
// Synthesizer Persona
// Final persona in the analysis pipeline. Integrates all other personas'
// outputs, resolves contradictions, writes final KB updates, and flags
// urgent findings.
// ---------------------------------------------------------------------------

import type { PersonaDefinition, PersonaResult } from '../persona-runner'
import { runSinglePersona } from '../persona-runner'
import { upsertKBDocument, getKBDocument, estimateTokens } from '../knowledge-base'
import type { PersonaHandoff, HypothesisRecord } from '../types'

// ===========================================================================
// Persona Definition
// ===========================================================================

export const SYNTHESIZER_DEFINITION: PersonaDefinition = {
  name: 'synthesizer',
  displayName: 'Synthesizer',
  requiresHandoffFrom: 'next_best_action',
  systemPrompt: `You are the Synthesizer. You integrate the outputs of all other clinical personas into a coherent, actionable knowledge base.

YOUR RESPONSIBILITIES:
1. Review ALL persona outputs for contradictions (e.g., analyst says fatigue improving but doctor says worsening)
2. When contradictions exist, check raw data to determine which is correct
3. Write a clear, consolidated summary that resolves all contradictions
4. Flag any URGENT findings that require immediate attention (e.g., critical lab values, dangerous drug interactions, symptoms suggesting acute conditions)
5. Identify the top 3 most important insights from this analysis cycle
6. Note what changed since the last analysis (delta summary)

OUTPUT FORMAT:

CONTRADICTIONS:
- [Description of contradiction and resolution]

URGENT:
- [Any findings requiring immediate patient attention]

TOP_INSIGHTS:
1. [Most important insight from this analysis]
2. [Second most important]
3. [Third most important]

CONSOLIDATED_SUMMARY:
[A coherent 200-300 word narrative integrating all persona findings into a single clinical picture. Write as if briefing a physician.]

FINDINGS:
[Summary of synthesis work]

DATA_QUALITY:
[Overall assessment]

DELTA:
[Key changes from this analysis cycle]

HANDOFF:
[What the next analysis cycle should focus on]`,
}

// ===========================================================================
// Pure parsing functions (no DB/API calls)
// ===========================================================================

/**
 * Parse the URGENT section from the persona's raw output.
 * Returns an array of urgent finding strings.
 * Returns empty array if no URGENT section, or if it says "None" or "No urgent findings".
 */
export function parseUrgentFindings(rawOutput: string): string[] {
  const urgentIdx = rawOutput.indexOf('URGENT:')
  if (urgentIdx === -1) return []

  const afterUrgent = rawOutput.slice(urgentIdx + 'URGENT:'.length)

  // Find the end of the URGENT section (next major section marker)
  const endMarkers = [
    'TOP_INSIGHTS:',
    'CONSOLIDATED_SUMMARY:',
    'FINDINGS:',
    'DATA_QUALITY:',
    'DELTA:',
    'HANDOFF:',
  ]
  let endIdx = afterUrgent.length
  for (const marker of endMarkers) {
    const mIdx = afterUrgent.indexOf(marker)
    if (mIdx !== -1 && mIdx < endIdx) {
      endIdx = mIdx
    }
  }

  const urgentText = afterUrgent.slice(0, endIdx).trim()

  // Check for "None" or "No urgent findings" variants
  const lowerText = urgentText.toLowerCase()
  if (
    lowerText === 'none' ||
    lowerText === '- none' ||
    lowerText.includes('no urgent findings') ||
    lowerText.includes('no urgent')
  ) {
    return []
  }

  // Parse bullet items
  const lines = urgentText.split('\n')
  const findings: string[] = []
  let current: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('- ')) {
      if (current !== null) {
        findings.push(current)
      }
      current = trimmed.slice(2).trim()
    } else if (current !== null) {
      // Continuation line
      current += ' ' + trimmed
    }
  }

  if (current !== null) {
    findings.push(current)
  }

  return findings
}

/**
 * Parse the TOP_INSIGHTS section from the persona's raw output.
 * Returns up to 3 insight strings.
 */
export function parseTopInsights(rawOutput: string): string[] {
  const insightsIdx = rawOutput.indexOf('TOP_INSIGHTS:')
  if (insightsIdx === -1) return []

  const afterInsights = rawOutput.slice(insightsIdx + 'TOP_INSIGHTS:'.length)

  // Find the end of the TOP_INSIGHTS section
  const endMarkers = [
    'CONSOLIDATED_SUMMARY:',
    'FINDINGS:',
    'DATA_QUALITY:',
    'DELTA:',
    'HANDOFF:',
    'CONTRADICTIONS:',
    'URGENT:',
  ]
  let endIdx = afterInsights.length
  for (const marker of endMarkers) {
    const mIdx = afterInsights.indexOf(marker)
    if (mIdx !== -1 && mIdx < endIdx) {
      endIdx = mIdx
    }
  }

  const insightsText = afterInsights.slice(0, endIdx).trim()
  const lines = insightsText.split('\n')
  const insights: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Match numbered items: "1. ...", "2. ...", "3. ..."
    const match = trimmed.match(/^\d+\.\s+(.+)/)
    if (match) {
      insights.push(match[1].trim())
      if (insights.length >= 3) break
    }
  }

  return insights
}

/**
 * Extract the CONSOLIDATED_SUMMARY section content.
 * Returns empty string if the section is not found.
 */
export function parseConsolidatedSummary(rawOutput: string): string {
  const summaryIdx = rawOutput.indexOf('CONSOLIDATED_SUMMARY:')
  if (summaryIdx === -1) return ''

  const afterSummary = rawOutput.slice(summaryIdx + 'CONSOLIDATED_SUMMARY:'.length)

  // Find the end of the CONSOLIDATED_SUMMARY section
  const endMarkers = [
    'FINDINGS:',
    'DATA_QUALITY:',
    'DELTA:',
    'HANDOFF:',
    'CONTRADICTIONS:',
    'URGENT:',
    'TOP_INSIGHTS:',
  ]
  let endIdx = afterSummary.length
  for (const marker of endMarkers) {
    const mIdx = afterSummary.indexOf(marker)
    if (mIdx !== -1 && mIdx < endIdx) {
      endIdx = mIdx
    }
  }

  return afterSummary.slice(0, endIdx).trim()
}

// ===========================================================================
// runSynthesizer
// ===========================================================================

/**
 * Execute the Synthesizer persona:
 * 1. Build context from ALL previous persona handoffs (not just the last one)
 * 2. Include the current hypothesis tracker from KB
 * 3. Run the persona via runSinglePersona()
 * 4. Parse urgent findings, top insights, and consolidated summary
 * 5. Upsert KB documents:
 *    - Update 'hypothesis_tracker' with a "## Synthesis Summary" section
 *    - Create/update 'conversation_insights' with top insights and urgent findings
 * 6. Return all parsed outputs and KB updates
 */
export async function runSynthesizer(
  allHandoffs: PersonaHandoff[],
  hypotheses: HypothesisRecord[],
): Promise<{
  result: PersonaResult
  urgent: string[]
  topInsights: string[]
  consolidatedSummary: string
  kbUpdates: string[]
}> {
  // Step 1: Build context from ALL previous persona handoffs
  let fullContext = ''

  // Include all handoffs as sections
  for (const handoff of allHandoffs) {
    fullContext += `--- PERSONA: ${handoff.persona} ---\n`
    fullContext += `Findings:\n${handoff.findings.map((f) => `- ${f}`).join('\n')}\n`
    fullContext += `Data Quality: ${handoff.data_quality}\n`
    fullContext += `Delta: ${handoff.delta}\n`
    fullContext += `Handoff Message: ${handoff.handoff_message}\n\n`
  }

  // Step 2: Include hypothesis tracker from KB
  const trackerDoc = await getKBDocument('hypothesis_tracker')
  const trackerContent = trackerDoc?.content ?? ''

  if (trackerContent) {
    fullContext += `<hypothesis_tracker>\n${trackerContent}\n</hypothesis_tracker>\n\n`
  }

  // Include hypothesis summary
  if (hypotheses.length > 0) {
    fullContext += '<hypothesis_summary>\n'
    for (const h of hypotheses) {
      fullContext += `- ${h.name} (${h.hypothesis_id}): score=${h.score}, confidence=${h.confidence}, direction=${h.direction}\n`
    }
    fullContext += '</hypothesis_summary>\n\n'
  }

  // Step 3: Run the persona (use last handoff for the standard handoff parameter)
  const lastHandoff = allHandoffs.length > 0 ? allHandoffs[allHandoffs.length - 1] : undefined
  const result = await runSinglePersona(
    SYNTHESIZER_DEFINITION,
    fullContext,
    lastHandoff,
  )

  const kbUpdates: string[] = []
  let urgent: string[] = []
  let topInsights: string[] = []
  let consolidatedSummary = ''

  if (result.success && result.rawOutput) {
    // Step 4: Parse outputs
    urgent = parseUrgentFindings(result.rawOutput)
    topInsights = parseTopInsights(result.rawOutput)
    consolidatedSummary = parseConsolidatedSummary(result.rawOutput)

    // Step 5: Upsert KB documents
    const now = new Date().toISOString()

    // 5a: Update hypothesis_tracker with synthesis summary section
    if (trackerDoc) {
      const updatedTrackerContent = trackerDoc.content + '\n\n## Synthesis Summary\n' + consolidatedSummary
      await upsertKBDocument({
        document_id: 'hypothesis_tracker',
        document_type: 'hypothesis',
        title: trackerDoc.title,
        content: updatedTrackerContent,
        version: trackerDoc.version,
        generated_at: now,
        generated_by: 'synthesizer',
        metadata: {
          ...(trackerDoc.metadata ?? {}),
          last_synthesis: now,
          urgent_count: urgent.length,
          insights_count: topInsights.length,
        },
        covers_date_start: trackerDoc.covers_date_start,
        covers_date_end: trackerDoc.covers_date_end,
        token_count: estimateTokens(updatedTrackerContent),
        is_stale: false,
      })
      kbUpdates.push('hypothesis_tracker')
    }

    // 5b: Create/update conversation_insights
    let insightsContent = '## Top Insights\n'
    for (let i = 0; i < topInsights.length; i++) {
      insightsContent += `${i + 1}. ${topInsights[i]}\n`
    }

    if (urgent.length > 0) {
      insightsContent += '\n## Urgent Findings\n'
      for (const u of urgent) {
        insightsContent += `- ${u}\n`
      }
    }

    insightsContent += '\n## Consolidated Summary\n' + consolidatedSummary

    await upsertKBDocument({
      document_id: 'conversation_insights',
      document_type: 'conversation',
      title: 'Conversation and Analysis Insights',
      content: insightsContent,
      version: 1,
      generated_at: now,
      generated_by: 'synthesizer',
      metadata: {
        urgent_count: urgent.length,
        insights_count: topInsights.length,
        personas_synthesized: allHandoffs.map((h) => h.persona),
        hypotheses_evaluated: hypotheses.map((h) => h.hypothesis_id),
      },
      covers_date_start: null,
      covers_date_end: null,
      token_count: estimateTokens(insightsContent),
      is_stale: false,
    })
    kbUpdates.push('conversation_insights')

    // Update the result with KB document IDs
    result.documentsUpdated = kbUpdates
  }

  return { result, urgent, topInsights, consolidatedSummary, kbUpdates }
}
