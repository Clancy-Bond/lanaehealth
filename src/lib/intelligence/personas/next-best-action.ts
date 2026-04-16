// ---------------------------------------------------------------------------
// Next Best Action Persona
// Fifth persona in the analysis pipeline. Determines what single piece of new
// information would most reduce diagnostic uncertainty, ranks actions by
// potential to change the hypothesis landscape, and generates doctor visit briefs.
// ---------------------------------------------------------------------------

import type { PersonaDefinition, PersonaResult } from '../persona-runner'
import { runSinglePersona } from '../persona-runner'
import { upsertKBDocument, estimateTokens } from '../knowledge-base'
import type { PersonaHandoff, HypothesisRecord } from '../types'

// ===========================================================================
// Persona Definition
// ===========================================================================

export const NEXT_BEST_ACTION_DEFINITION: PersonaDefinition = {
  name: 'next_best_action',
  displayName: 'Next Best Action',
  requiresHandoffFrom: 'research_librarian',
  systemPrompt: `You are the Next Best Action advisor. Your job is to determine what information would most reduce diagnostic uncertainty for this patient.

For each potential action (lab test, imaging, specialist referral, lifestyle measurement, data logging improvement), estimate:
1. Which hypotheses it would affect
2. How much it could change the confidence score (potential swing)
3. How difficult/costly it is to obtain
4. How urgent it is given the patient's current symptoms

OUTPUT FORMAT:

ACTIONS:
1. [Action name] | Affects: [hypothesis names] | Potential swing: [+/- points] | Difficulty: [low/medium/high] | Urgency: [routine/soon/urgent]
   Rationale: [Why this is the highest-yield action]
2. [Next action...]

APPOINTMENT_BRIEFS:
For each upcoming appointment, provide:
### [Specialty] - [Date]
- Key data to bring: [specific values with dates]
- Questions to ask: [derived from hypothesis uncertainties]
- Tests to request: [from ACTIONS list relevant to this specialty]
- Hypothesis context: [which hypotheses this doctor can help resolve]

FINDINGS:
[Summary]

DATA_QUALITY:
[Assessment]

DELTA:
[Changes]

HANDOFF:
Synthesizer should prioritize: [key items]`,
}

// ===========================================================================
// Parsed action type
// ===========================================================================

export interface ParsedAction {
  action: string
  affects: string[]
  potentialSwing: string
  difficulty: string
  urgency: string
  rationale: string
}

// ===========================================================================
// parseActions -- pure function, no DB/API calls
// ===========================================================================

/**
 * Parse the ACTIONS section from the persona's raw output.
 *
 * Each action starts with a number followed by a period and pipe-delimited
 * fields: action name | Affects: ... | Potential swing: ... | Difficulty: ... | Urgency: ...
 * An optional indented "Rationale:" line may follow.
 *
 * Extracts up to 10 actions.
 */
export function parseActions(rawOutput: string): ParsedAction[] {
  // Find the ACTIONS section
  const actionsIdx = rawOutput.indexOf('ACTIONS:')
  if (actionsIdx === -1) return []

  const afterActions = rawOutput.slice(actionsIdx + 'ACTIONS:'.length)

  // Find the end of the ACTIONS section (next major section marker)
  const endMarkers = [
    'APPOINTMENT_BRIEFS:',
    'FINDINGS:',
    'DATA_QUALITY:',
    'DELTA:',
    'HANDOFF:',
  ]
  let endIdx = afterActions.length
  for (const marker of endMarkers) {
    const mIdx = afterActions.indexOf(marker)
    if (mIdx !== -1 && mIdx < endIdx) {
      endIdx = mIdx
    }
  }

  const actionsText = afterActions.slice(0, endIdx)
  const lines = actionsText.split('\n')

  const actions: ParsedAction[] = []
  let currentAction: ParsedAction | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Check for numbered action line: "1. Action name | Affects: ..."
    const actionMatch = trimmed.match(/^\d+\.\s+(.+)/)
    if (actionMatch) {
      // Save previous action
      if (currentAction) {
        actions.push(currentAction)
        if (actions.length >= 10) break
      }

      currentAction = parseActionLine(actionMatch[1])
      continue
    }

    // Check for rationale continuation line
    if (currentAction && trimmed.startsWith('Rationale:')) {
      currentAction.rationale = trimmed.slice('Rationale:'.length).trim()
      continue
    }
  }

  // Save the last action
  if (currentAction && actions.length < 10) {
    actions.push(currentAction)
  }

  return actions
}

/**
 * Parse a single pipe-delimited action line into a ParsedAction.
 *
 * Expected format:
 *   Action name | Affects: hyp1, hyp2 | Potential swing: +15 points | Difficulty: low | Urgency: soon
 */
function parseActionLine(line: string): ParsedAction {
  const parts = line.split('|').map((p) => p.trim())

  const result: ParsedAction = {
    action: parts[0] || '',
    affects: [],
    potentialSwing: '',
    difficulty: '',
    urgency: '',
    rationale: '',
  }

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]

    if (part.startsWith('Affects:')) {
      const affectsStr = part.slice('Affects:'.length).trim()
      result.affects = affectsStr.split(',').map((a) => a.trim()).filter(Boolean)
    } else if (part.startsWith('Potential swing:')) {
      result.potentialSwing = part.slice('Potential swing:'.length).trim()
    } else if (part.startsWith('Difficulty:')) {
      result.difficulty = part.slice('Difficulty:'.length).trim()
    } else if (part.startsWith('Urgency:')) {
      result.urgency = part.slice('Urgency:'.length).trim()
    }
  }

  return result
}

// ===========================================================================
// runNextBestAction
// ===========================================================================

// Lazy import to avoid triggering Supabase client creation at module scope
function getSupabase() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createServiceClient } = require('@/lib/supabase') as typeof import('@/lib/supabase')
  return createServiceClient()
}

/**
 * Execute the Next Best Action persona:
 * 1. Query upcoming appointments from Supabase
 * 2. Build context from librarian handoff + hypothesis tracker + appointments
 * 3. Run the persona via runSinglePersona()
 * 4. Parse actions from output
 * 5. Upsert KB documents for next best actions and doctor briefs
 * 6. Return result, actions, and list of KB document IDs updated
 */
export async function runNextBestAction(
  librarianHandoff: PersonaHandoff,
  hypotheses: HypothesisRecord[],
  hypothesisTrackerContent: string,
): Promise<{
  result: PersonaResult
  actions: ParsedAction[]
  kbUpdates: string[]
}> {
  const supabase = getSupabase()

  // Step 1: Query upcoming appointments
  const today = new Date().toISOString().split('T')[0]
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .gte('date', today)
    .order('date', { ascending: true })

  const appointmentsList = appointments ?? []

  // Step 2: Build context
  let fullContext = `<hypothesis_tracker>\n${hypothesisTrackerContent}\n</hypothesis_tracker>\n\n`

  // Include hypothesis summary
  if (hypotheses.length > 0) {
    fullContext += '<hypothesis_summary>\n'
    for (const h of hypotheses) {
      fullContext += `- ${h.name} (${h.hypothesis_id}): score=${h.score}, confidence=${h.confidence}, direction=${h.direction}\n`
      if (h.what_would_change.length > 0) {
        fullContext += `  What would change: ${h.what_would_change.join('; ')}\n`
      }
    }
    fullContext += '</hypothesis_summary>\n\n'
  }

  // Include upcoming appointments
  if (appointmentsList.length > 0) {
    fullContext += '<upcoming_appointments>\n'
    for (const appt of appointmentsList) {
      fullContext += `- ${appt.specialty || appt.type || 'Appointment'} on ${appt.date}`
      if (appt.provider) fullContext += ` with ${appt.provider}`
      if (appt.notes) fullContext += ` -- ${appt.notes}`
      fullContext += '\n'
    }
    fullContext += '</upcoming_appointments>\n\n'
  }

  // Step 3: Run the persona
  const result = await runSinglePersona(
    NEXT_BEST_ACTION_DEFINITION,
    fullContext,
    librarianHandoff,
  )

  const kbUpdates: string[] = []
  let actions: ParsedAction[] = []

  if (result.success && result.rawOutput) {
    // Step 4: Parse actions
    actions = parseActions(result.rawOutput)

    // Step 5: Upsert KB documents
    const now = new Date().toISOString()

    // Main next best actions document
    await upsertKBDocument({
      document_id: 'next_best_actions',
      document_type: 'next_action',
      title: 'Next Best Actions',
      content: result.rawOutput,
      version: 1,
      generated_at: now,
      generated_by: 'next_best_action',
      metadata: {
        action_count: actions.length,
        actions_summary: actions.map((a) => ({
          action: a.action,
          urgency: a.urgency,
          difficulty: a.difficulty,
        })),
        hypotheses_evaluated: hypotheses.map((h) => h.hypothesis_id),
      },
      covers_date_start: today,
      covers_date_end: null,
      token_count: estimateTokens(result.rawOutput),
      is_stale: false,
    })
    kbUpdates.push('next_best_actions')

    // Doctor briefs for appointments within 30 days
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const thirtyDaysCutoff = thirtyDaysFromNow.toISOString().split('T')[0]

    for (const appt of appointmentsList) {
      if (appt.date <= thirtyDaysCutoff) {
        const specialty = appt.specialty || appt.type || 'general'
        const docId = `doctor_brief_${specialty.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

        // Extract the appointment brief section for this specialty from raw output
        const briefContent = extractAppointmentBrief(result.rawOutput, specialty, appt.date)

        await upsertKBDocument({
          document_id: docId,
          document_type: 'doctor_brief',
          title: `Doctor Visit Brief: ${specialty}`,
          content: briefContent || `Upcoming ${specialty} appointment on ${appt.date}. See next_best_actions for recommended tests and questions.`,
          version: 1,
          generated_at: now,
          generated_by: 'next_best_action',
          metadata: {
            specialty,
            appointment_date: appt.date,
            provider: appt.provider || null,
          },
          covers_date_start: today,
          covers_date_end: appt.date,
          token_count: estimateTokens(briefContent || ''),
          is_stale: false,
        })
        kbUpdates.push(docId)
      }
    }

    // Update the result with KB document IDs
    result.documentsUpdated = kbUpdates
  }

  return { result, actions, kbUpdates }
}

// ---------------------------------------------------------------------------
// Internal helper: extract appointment brief for a specific specialty
// ---------------------------------------------------------------------------

/**
 * Extract the appointment brief section for a given specialty from the raw output.
 * Looks for "### Specialty - Date" or "### Specialty" patterns in the APPOINTMENT_BRIEFS section.
 */
function extractAppointmentBrief(
  rawOutput: string,
  specialty: string,
  date: string,
): string {
  const briefsIdx = rawOutput.indexOf('APPOINTMENT_BRIEFS:')
  if (briefsIdx === -1) return ''

  const afterBriefs = rawOutput.slice(briefsIdx + 'APPOINTMENT_BRIEFS:'.length)

  // Find the end of the APPOINTMENT_BRIEFS section
  const endMarkers = ['FINDINGS:', 'DATA_QUALITY:', 'DELTA:', 'HANDOFF:']
  let endIdx = afterBriefs.length
  for (const marker of endMarkers) {
    const mIdx = afterBriefs.indexOf(marker)
    if (mIdx !== -1 && mIdx < endIdx) {
      endIdx = mIdx
    }
  }

  const briefsText = afterBriefs.slice(0, endIdx)

  // Look for the specific specialty section (case-insensitive)
  const specialtyLower = specialty.toLowerCase()
  const lines = briefsText.split('\n')
  let capturing = false
  const capturedLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Check if this is a header for a specialty
    if (trimmed.startsWith('###')) {
      if (capturing) {
        // We hit the next specialty header, stop capturing
        break
      }

      const headerLower = trimmed.toLowerCase()
      if (headerLower.includes(specialtyLower) || headerLower.includes(date)) {
        capturing = true
        capturedLines.push(trimmed)
      }
    } else if (capturing) {
      capturedLines.push(line)
    }
  }

  return capturedLines.join('\n').trim()
}
