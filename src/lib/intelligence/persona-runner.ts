// ---------------------------------------------------------------------------
// Persona Execution Framework
// Runs personas in sequence with independent DB access and structured handoff.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import type { PersonaHandoff, AnalysisMode, AnalysisTrigger } from './types'

// ===========================================================================
// Interfaces
// ===========================================================================

export interface PersonaDefinition {
  name: string
  displayName: string
  systemPrompt: string
  requiresHandoffFrom?: string
}

export interface PersonaResult {
  persona: string
  success: boolean
  handoff: PersonaHandoff | null
  rawOutput: string
  documentsUpdated: string[]
  durationMs: number
  error?: string
}

export interface AnalysisResult {
  mode: AnalysisMode
  trigger: AnalysisTrigger
  personaResults: PersonaResult[]
  totalDurationMs: number
  documentsUpdated: string[]
  errors: string[]
}

// ===========================================================================
// parseHandoff -- pure function, no DB/API calls
// ===========================================================================

const SECTION_MARKERS = ['FINDINGS:', 'DATA_QUALITY:', 'DELTA:', 'HANDOFF:'] as const

/**
 * Parse a persona's raw text output into a structured PersonaHandoff.
 *
 * Looks for these section markers:
 *   FINDINGS:     (capture bullet lines until next marker)
 *   DATA_QUALITY: (single line)
 *   DELTA:        (single line)
 *   HANDOFF:      (capture remaining text)
 *
 * Returns null when none of the markers are found.
 * The `persona` field is left as '' -- the caller sets it.
 */
export function parseHandoff(rawOutput: string): PersonaHandoff | null {
  // Quick check: does the output contain at least one marker?
  const hasAnyMarker = SECTION_MARKERS.some((m) => rawOutput.includes(m))
  if (!hasAnyMarker) return null

  const sections = extractSections(rawOutput)

  const findings = parseFindings(sections.FINDINGS ?? '')
  const dataQuality = (sections.DATA_QUALITY ?? '').trim()
  const delta = (sections.DELTA ?? '').trim()
  const handoffMessage = (sections.HANDOFF ?? '').trim()

  return {
    persona: '',
    findings,
    data_quality: dataQuality,
    delta,
    handoff_message: handoffMessage,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Split raw output into named sections based on markers.
 * Each marker captures everything up to the next marker (or end of string).
 */
function extractSections(
  raw: string,
): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = raw.split('\n')

  let currentKey: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const markerMatch = matchMarker(line)
    if (markerMatch) {
      // Save previous section
      if (currentKey !== null) {
        result[currentKey] = currentLines.join('\n')
      }
      currentKey = markerMatch.key
      // The rest of the line after the marker is the first content
      currentLines = markerMatch.rest ? [markerMatch.rest] : []
    } else if (currentKey !== null) {
      currentLines.push(line)
    }
  }

  // Save the last section
  if (currentKey !== null) {
    result[currentKey] = currentLines.join('\n')
  }

  return result
}

/**
 * Check if a line starts with one of our section markers.
 * Returns the key name and the rest of the line after the marker.
 */
function matchMarker(
  line: string,
): { key: string; rest: string } | null {
  const trimmed = line.trimStart()
  for (const marker of SECTION_MARKERS) {
    if (trimmed.startsWith(marker)) {
      const key = marker.replace(':', '')
      const rest = trimmed.slice(marker.length).trim()
      return { key, rest }
    }
  }
  return null
}

/**
 * Parse the FINDINGS section into an array of finding strings.
 * Each finding starts with "- " and may span multiple continuation lines.
 */
function parseFindings(raw: string): string[] {
  const findings: string[] = []
  const lines = raw.split('\n')

  let current: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('- ')) {
      // Save previous finding
      if (current !== null) {
        findings.push(current)
      }
      current = trimmed.slice(2).trim()
    } else if (current !== null) {
      // Continuation line
      current += ' ' + trimmed
    }
  }

  // Save the last finding
  if (current !== null) {
    findings.push(current)
  }

  return findings
}

// ===========================================================================
// runSinglePersona
// ===========================================================================

/**
 * Run one persona with its own independent DB connection.
 * Calls Claude (claude-sonnet-4-6) with the persona's system prompt,
 * the provided context, and optionally the previous persona's handoff.
 */
export async function runSinglePersona(
  persona: PersonaDefinition,
  context: string,
  handoffFromPrevious?: PersonaHandoff,
): Promise<PersonaResult> {
  const start = Date.now()

  try {
    // Each persona gets its own DB client (independent access)
    const _supabase = createServiceClient()

    // Build the user message with context and optional handoff
    let userContent = context
    if (handoffFromPrevious) {
      userContent += `\n\n--- HANDOFF FROM ${handoffFromPrevious.persona} ---\n`
      userContent += `Findings:\n${handoffFromPrevious.findings.map((f) => `- ${f}`).join('\n')}\n`
      userContent += `Data Quality: ${handoffFromPrevious.data_quality}\n`
      userContent += `Delta: ${handoffFromPrevious.delta}\n`
      userContent += `Message: ${handoffFromPrevious.handoff_message}\n`
    }

    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: persona.systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    const rawOutput =
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n') || ''

    let handoff = parseHandoff(rawOutput)
    if (handoff) {
      handoff.persona = persona.name
    } else if (rawOutput.length > 0) {
      // Fallback: if the persona produced output but didn't use exact markers,
      // create a minimal handoff so the pipeline continues.
      handoff = {
        persona: persona.name,
        findings: [rawOutput.substring(0, 500)],
        data_quality: 'Handoff markers not found in output; using raw output as fallback.',
        delta: '',
        handoff_message: `Review raw output from ${persona.name} for full analysis.`,
      }
    }

    return {
      persona: persona.name,
      success: true,
      handoff,
      rawOutput,
      documentsUpdated: [],
      durationMs: Date.now() - start,
    }
  } catch (err) {
    return {
      persona: persona.name,
      success: false,
      handoff: null,
      rawOutput: '',
      documentsUpdated: [],
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ===========================================================================
// runAnalysis
// ===========================================================================

/**
 * Run a sequence of personas, passing each one's handoff to the next.
 * If a persona fails, the error is logged but the pipeline continues
 * (resilience -- downstream personas simply won't receive the failed handoff).
 */
export async function runAnalysis(
  trigger: AnalysisTrigger,
  personas: PersonaDefinition[],
): Promise<AnalysisResult> {
  const totalStart = Date.now()
  const personaResults: PersonaResult[] = []
  const allDocumentsUpdated: string[] = []
  const errors: string[] = []

  let previousHandoff: PersonaHandoff | undefined

  for (const persona of personas) {
    const result = await runSinglePersona(
      persona,
      `Analysis triggered: ${trigger.reason}\nMode: ${trigger.mode}`,
      previousHandoff,
    )

    personaResults.push(result)

    if (result.success && result.handoff) {
      previousHandoff = result.handoff
    } else if (!result.success) {
      errors.push(`${persona.name}: ${result.error ?? 'Unknown error'}`)
      // Do NOT update previousHandoff -- next persona runs without it
    }

    allDocumentsUpdated.push(...result.documentsUpdated)
  }

  return {
    mode: trigger.mode,
    trigger,
    personaResults,
    totalDurationMs: Date.now() - totalStart,
    documentsUpdated: allDocumentsUpdated,
    errors,
  }
}
