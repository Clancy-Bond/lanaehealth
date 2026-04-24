// Sentry beforeSend hook for redacting Protected Health Information (PHI)
// before events leave the process.
//
// Scope of this scrubber:
//   - Redacts known PHI field names (medication, diagnosis, symptom, etc.)
//     from the event extra/contexts/breadcrumbs.
//   - Redacts request bodies entirely (we never need the raw POST body in
//     a stack trace).
//   - Redacts query string values that match PHI-shaped keys.
//   - Strips cookies and Authorization headers.
//
// What this scrubber does NOT do:
//   - It does not guarantee HIPAA compliance. The free Sentry tier is not a
//     HIPAA Business Associate. This is acceptable risk only because Lanae is
//     the sole user during this phase.
//   - It does not catch novel field names. If you add a column called
//     `tumor_marker` or similar, add it to PHI_FIELD_NAMES below.
//
// TODO(productization): when we open this app to additional users, either
// upgrade to a Sentry Business plan with a signed BAA, or self-host Sentry.
// At that point this scrubber stays in place as defense in depth, but the
// transport itself becomes the primary control.

import type { ErrorEvent, EventHint } from '@sentry/core'

const REDACTED = '[REDACTED]'

// Lower-cased field names we treat as PHI. Match is case-insensitive and
// substring (so `current_medications` matches `medication`).
const PHI_FIELD_NAMES: readonly string[] = [
  'medication',
  'medications',
  'med',
  'meds',
  'rx',
  'prescription',
  'diagnosis',
  'diagnoses',
  'condition',
  'symptom',
  'symptoms',
  'pain',
  'pain_level',
  'pain_score',
  'lab',
  'lab_result',
  'lab_value',
  'cycle',
  'menstruation',
  'menstrual',
  'period',
  'cervical',
  'bbt',
  'basal_temp',
  'phase',
  'food',
  'meal',
  'biometric',
  'oura',
  'heart_rate',
  'hrv',
  'sleep',
  'note',
  'notes',
  'narrative',
  'free_text',
  'message',
  'content',
  'patient',
  'patient_name',
  'mrn',
  'medical_record',
  'dob',
  'date_of_birth',
  'ssn',
  'phi',
]

const PHI_HEADER_NAMES: readonly string[] = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-anthropic-key',
  'x-supabase-auth',
]

function looksLikePhiKey(key: string): boolean {
  const lowered = key.toLowerCase()
  return PHI_FIELD_NAMES.some((name) => lowered.includes(name))
}

// Recursively walk an unknown structure and redact values whose key looks
// like PHI. Returns a new object; does not mutate the input.
function scrubValue(value: unknown, parentKey?: string): unknown {
  if (value === null || value === undefined) return value

  if (parentKey && looksLikePhiKey(parentKey)) {
    return REDACTED
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, parentKey))
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result[key] = scrubValue(child, key)
    }
    return result
  }

  return value
}

function scrubHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return headers
  const result: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    if (PHI_HEADER_NAMES.includes(name.toLowerCase())) {
      result[name] = REDACTED
    } else {
      result[name] = value
    }
  }
  return result
}

export function sentryBeforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  // Strip request bodies entirely. We never need them for debugging stack
  // traces and they are the most likely source of PHI leakage.
  if (event.request) {
    event.request = {
      ...event.request,
      data: REDACTED,
      cookies: undefined,
      headers: scrubHeaders(event.request.headers as Record<string, string> | undefined),
      // Query strings can also carry PHI (e.g. ?medication=lyrica). Drop
      // the parsed query and keep only the URL path.
      query_string: undefined,
    }
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>
  }

  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as typeof event.contexts
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      data: crumb.data ? (scrubValue(crumb.data) as Record<string, unknown>) : crumb.data,
      // Drop free-text messages from console/debug breadcrumbs; they often
      // include logged request payloads.
      message: crumb.category === 'console' ? REDACTED : crumb.message,
    }))
  }

  // The user object is patient identity by definition. We intentionally do
  // not call setUser anywhere, but if some integration sets it, redact.
  if (event.user) {
    event.user = {
      id: event.user.id ? 'patient' : undefined,
    }
  }

  return event
}
