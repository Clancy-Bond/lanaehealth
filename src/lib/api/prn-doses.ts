// ---------------------------------------------------------------------------
// prn-doses api helpers
//
// Thin wrapper around the `prn_dose_events` table (migration 022). Backs
// the Wave 2e Bearable F7 feature: post-dose efficacy polling for
// as-needed medications.
//
// Flow:
//   1. User logs a PRN dose in the Log UI.
//   2. Frontend calls recordPrnDose(). A row is inserted, and
//      poll_scheduled_for is set to dose_time + configurable delay
//      (default 90 min, overridable per med).
//   3. A cron hits /api/push/prn-poll. Pending rows are dispatched to
//      push_subscriptions with payload "Did [med] help?". Each sent row
//      is stamped with poll_sent_at.
//   4. Lanae taps one of three responses in the in-app surface (or from
//      the notification if it delivered): helped / no_change / worse.
//      recordEfficacyResponse() writes poll_response + poll_responded_at.
//
// Voice rule: the question is always "Did [med] help?" not "Did you take
// [med]?". We do NOT compute adherence, streaks, or "missed poll" ratios.
// A NULL poll_response is a valid "ignored" state forever.
// ---------------------------------------------------------------------------

import { createServiceClient } from '@/lib/supabase'

// --- constants -------------------------------------------------------------

/** Default delay between dose and efficacy poll, in minutes. */
export const DEFAULT_POLL_DELAY_MINUTES = 90

/**
 * Per-medication override of the poll delay in minutes. Case-insensitive
 * match on medication_name. Extend as clinical knowledge grows. Values
 * here reflect roughly when each med reaches peak therapeutic effect.
 */
const PER_MED_POLL_DELAY_MINUTES: Record<string, number> = {
  // Fast-acting triptans peak ~30 min in (injection) to 60 min (oral).
  sumatriptan: 60,
  rizatriptan: 60,
  // Tylenol / acetaminophen peaks ~60 min.
  tylenol: 60,
  acetaminophen: 60,
  // NSAIDs: ibuprofen ~90 min, naproxen ~120 min.
  ibuprofen: 90,
  naproxen: 120,
  // Benzodiazepines (if ever added for breakthrough anxiety): ~60 min.
  lorazepam: 60,
  diazepam: 60,
}

export type PrnEfficacyResponse = 'helped' | 'no_change' | 'worse'

// --- types -----------------------------------------------------------------

export interface PrnDoseEvent {
  id: string
  patient_id: string
  medication_name: string
  dose_amount: number | null
  dose_unit: string | null
  dose_time: string
  reason: string | null
  poll_scheduled_for: string | null
  poll_sent_at: string | null
  poll_response: PrnEfficacyResponse | null
  poll_responded_at: string | null
}

export interface RecordPrnDoseInput {
  medicationName: string
  doseAmount?: number | null
  doseUnit?: string | null
  /** ISO timestamp the dose was taken. Defaults to now() on the DB side. */
  doseTime?: string | null
  reason?: string | null
  /**
   * Override the default 90-minute poll delay (minutes). Values <= 0
   * disable polling for this dose (useful for "already know it
   * worked" logging flows).
   */
  pollDelayMinutes?: number | null
}

export interface RecordEfficacyResponseInput {
  id: string
  response: PrnEfficacyResponse
  respondedAt?: string | null
}

// --- helpers --------------------------------------------------------------

/**
 * Resolve the poll delay for a given medication. Exposed for UI and tests
 * so the same logic drives both the scheduler and any user-facing copy.
 */
export function resolvePollDelayMinutes(medicationName: string): number {
  if (!medicationName) return DEFAULT_POLL_DELAY_MINUTES
  const key = medicationName.trim().toLowerCase()
  // Simple exact match first; then contains-match so "Sumatriptan 50mg"
  // still resolves to the sumatriptan override.
  if (key in PER_MED_POLL_DELAY_MINUTES) {
    return PER_MED_POLL_DELAY_MINUTES[key]
  }
  for (const known of Object.keys(PER_MED_POLL_DELAY_MINUTES)) {
    if (key.includes(known)) return PER_MED_POLL_DELAY_MINUTES[known]
  }
  return DEFAULT_POLL_DELAY_MINUTES
}

/**
 * Compute the absolute poll timestamp from a dose time + delay. Pure
 * function; exported for testing.
 */
export function computePollScheduledFor(
  doseTime: Date,
  delayMinutes: number,
): Date {
  return new Date(doseTime.getTime() + delayMinutes * 60 * 1000)
}

// --- record dose ----------------------------------------------------------

/**
 * Insert a prn_dose_events row and schedule the efficacy poll.
 *
 * Returns the inserted row. Does NOT send the notification itself - that
 * is the job of /api/push/prn-poll, which a cron triggers periodically.
 *
 * Passing pollDelayMinutes <= 0 leaves poll_scheduled_for NULL so no
 * follow-up is ever scheduled for this dose.
 */
export async function recordPrnDose(
  input: RecordPrnDoseInput,
): Promise<PrnDoseEvent> {
  if (!input.medicationName || typeof input.medicationName !== 'string') {
    throw new Error('recordPrnDose: medicationName is required')
  }

  const medicationName = input.medicationName.trim()
  if (medicationName.length === 0) {
    throw new Error('recordPrnDose: medicationName cannot be blank')
  }

  const doseTimeIso = input.doseTime ?? new Date().toISOString()
  const doseTime = new Date(doseTimeIso)
  if (Number.isNaN(doseTime.getTime())) {
    throw new Error(`recordPrnDose: invalid doseTime '${doseTimeIso}'`)
  }

  const explicitDelay = input.pollDelayMinutes
  let pollScheduledForIso: string | null
  if (explicitDelay !== undefined && explicitDelay !== null) {
    if (!Number.isFinite(explicitDelay)) {
      throw new Error(
        `recordPrnDose: pollDelayMinutes must be finite, got ${explicitDelay}`,
      )
    }
    pollScheduledForIso = explicitDelay > 0
      ? computePollScheduledFor(doseTime, explicitDelay).toISOString()
      : null
  } else {
    const delay = resolvePollDelayMinutes(medicationName)
    pollScheduledForIso = computePollScheduledFor(doseTime, delay).toISOString()
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('prn_dose_events')
    .insert({
      medication_name: medicationName,
      dose_amount: input.doseAmount ?? null,
      dose_unit: input.doseUnit ?? null,
      dose_time: doseTimeIso,
      reason: input.reason ?? null,
      poll_scheduled_for: pollScheduledForIso,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to record PRN dose: ${error.message}`)
  }
  return data as PrnDoseEvent
}

// --- record response ------------------------------------------------------

/**
 * Persist Lanae's 2-tap response to an efficacy poll. No-op if the row
 * is already answered; we never overwrite an existing response (first
 * answer wins).
 */
export async function recordEfficacyResponse(
  input: RecordEfficacyResponseInput,
): Promise<PrnDoseEvent> {
  if (!input.id) {
    throw new Error('recordEfficacyResponse: id is required')
  }
  if (!isValidResponse(input.response)) {
    throw new Error(
      `recordEfficacyResponse: invalid response '${input.response}'`,
    )
  }

  const supabase = createServiceClient()

  // Idempotency: only patch rows whose poll_response is still NULL.
  const respondedAt = input.respondedAt ?? new Date().toISOString()
  const { data, error } = await supabase
    .from('prn_dose_events')
    .update({
      poll_response: input.response,
      poll_responded_at: respondedAt,
    })
    .eq('id', input.id)
    .is('poll_response', null)
    .select()
    .single()

  if (error) {
    // maybeSingle path would return data: null with no error; .single()
    // throws PGRST116 on zero rows. Convert that to a clear message.
    if (error.code === 'PGRST116') {
      throw new Error(
        'Failed to record efficacy response: dose event not found or already answered',
      )
    }
    throw new Error(`Failed to record efficacy response: ${error.message}`)
  }
  return data as PrnDoseEvent
}

/**
 * Fetch pending polls that are due: poll_scheduled_for has passed,
 * poll_sent_at is still NULL, and poll_response is still NULL. Ordered
 * oldest-first so the cron drains them in FIFO order.
 *
 * The result is bounded by `limit` to keep a single cron tick bounded.
 */
export async function getPendingPolls(limit = 50): Promise<PrnDoseEvent[]> {
  const supabase = createServiceClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('prn_dose_events')
    .select('*')
    .is('poll_sent_at', null)
    .is('poll_response', null)
    .not('poll_scheduled_for', 'is', null)
    .lte('poll_scheduled_for', nowIso)
    .order('poll_scheduled_for', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch pending PRN polls: ${error.message}`)
  }
  return (data ?? []) as PrnDoseEvent[]
}

/**
 * Mark a poll as having been delivered (push fired or in-app surface
 * shown). Idempotent: only patches rows where poll_sent_at is still
 * NULL.
 */
export async function markPollSent(
  id: string,
  sentAt?: string,
): Promise<void> {
  if (!id) throw new Error('markPollSent: id is required')
  const supabase = createServiceClient()
  const stamp = sentAt ?? new Date().toISOString()
  const { error } = await supabase
    .from('prn_dose_events')
    .update({ poll_sent_at: stamp })
    .eq('id', id)
    .is('poll_sent_at', null)
  if (error) {
    throw new Error(`Failed to mark PRN poll sent: ${error.message}`)
  }
}

/**
 * Look up PRN doses whose polls are "open" for Lanae to answer right
 * now - the delay has passed and she has not yet responded. Used by the
 * in-app fallback surface on /log when push delivery is flaky (iOS
 * PWA). `gracePeriodHours` caps how far back we surface unanswered
 * polls; older ones are considered ignored and never re-raised.
 */
export async function getOpenInAppPolls(
  gracePeriodHours = 6,
  limit = 10,
): Promise<PrnDoseEvent[]> {
  const supabase = createServiceClient()
  const now = new Date()
  const graceStart = new Date(
    now.getTime() - gracePeriodHours * 60 * 60 * 1000,
  ).toISOString()
  const nowIso = now.toISOString()

  const { data, error } = await supabase
    .from('prn_dose_events')
    .select('*')
    .is('poll_response', null)
    .not('poll_scheduled_for', 'is', null)
    .lte('poll_scheduled_for', nowIso)
    .gte('poll_scheduled_for', graceStart)
    .order('poll_scheduled_for', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch open PRN polls: ${error.message}`)
  }
  return (data ?? []) as PrnDoseEvent[]
}

function isValidResponse(value: unknown): value is PrnEfficacyResponse {
  return value === 'helped' || value === 'no_change' || value === 'worse'
}
