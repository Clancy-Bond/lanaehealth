/**
 * AI extraction of structured candidate stamps from a free-form note.
 *
 * Calls Claude with the note body + the user's med list (slug + names)
 * so the model can suggest med_dose stamps that map cleanly onto rows
 * the meds card can write. Pain / headache_attack / symptom suggestions
 * pass through too.
 *
 * Critical guarantees:
 *   - The verbatim note body is NEVER overwritten or paraphrased here.
 *     We persist the original body separately on notes.body. The
 *     extraction output goes to notes.extractions.
 *   - Nothing is stamped into med_doses / pain_points / etc. by this
 *     function. It only surfaces *candidates*. The apply route writes
 *     a structured row only when the user taps the chip.
 *   - All numeric / enum fields are validated by zod before persist
 *     so a malformed model response cannot corrupt downstream rows.
 *   - Failures are non-fatal: an empty extraction list is the
 *     graceful fallback. The note still saves, no chips appear.
 */
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { MedsConfig } from '@/lib/meds/types'
import type {
  Extraction,
  HeadacheAttackExtraction,
  MedDoseExtraction,
  PainExtraction,
  SymptomExtraction,
} from './extraction-types'

const EXTRACTION_MODEL = 'claude-sonnet-4-6'

/**
 * Light timeout to keep the post-save UX snappy. The composer fires
 * extraction in the background so a slow model run does not block
 * the user, but if Claude is having a bad minute we cut at 6s.
 */
const EXTRACTION_TIMEOUT_MS = 6000

const BaseSchema = {
  id: z.string().min(1).max(40),
  chip_label: z.string().min(1).max(80),
  confidence: z.enum(['low', 'medium', 'high']),
  evidence_quote: z.string().max(280).optional(),
}

const MedDoseSchema = z.object({
  ...BaseSchema,
  kind: z.literal('med_dose'),
  med_slug: z.string().min(1).max(80),
  med_name: z.string().min(1).max(120),
  scheduled_or_prn: z.enum(['scheduled', 'prn']),
  slot: z.enum(['morning', 'midday', 'night']).nullable().optional(),
  taken_at_iso: z.string().datetime(),
  dose_text: z.string().max(120).nullable().optional(),
})

const PainSchema = z.object({
  ...BaseSchema,
  kind: z.literal('pain'),
  intensity: z.number().min(0).max(10),
  body_region: z.string().max(80).nullable().optional(),
  pain_quality: z.string().max(80).nullable().optional(),
  noted_at_iso: z.string().datetime(),
})

const HeadacheSchema = z.object({
  ...BaseSchema,
  kind: z.literal('headache_attack'),
  started_at_iso: z.string().datetime(),
  intensity: z.number().min(0).max(10).nullable().optional(),
  side: z.string().max(40).nullable().optional(),
  aura: z.string().max(280).nullable().optional(),
  trigger: z.string().max(120).nullable().optional(),
})

const SymptomSchema = z.object({
  ...BaseSchema,
  kind: z.literal('symptom'),
  label: z.string().min(1).max(80),
  intensity: z.number().min(0).max(10).nullable().optional(),
  noted_at_iso: z.string().datetime(),
})

const ExtractionSchema = z.discriminatedUnion('kind', [
  MedDoseSchema,
  PainSchema,
  HeadacheSchema,
  SymptomSchema,
])

const ExtractionListSchema = z.array(ExtractionSchema).max(8)

interface ExtractInput {
  noteBody: string
  capturedAt: string
  meds: MedsConfig
}

export interface ExtractResult {
  ok: true
  extractions: Extraction[]
}
export interface ExtractFail {
  ok: false
  error: string
  reason: 'no_api_key' | 'model_error' | 'timeout' | 'parse_error' | 'unknown'
}

/**
 * Extract candidate stamps from a note. Always returns successfully
 * (an empty extractions list is fine). Errors are surfaced for
 * logging but the note save flow does not depend on extraction
 * succeeding.
 */
export async function extractCandidates(
  input: ExtractInput,
): Promise<ExtractResult | ExtractFail> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'ANTHROPIC_API_KEY not set', reason: 'no_api_key' }
  }
  if (!input.noteBody.trim()) {
    return { ok: true, extractions: [] }
  }

  // Trim very long notes so we never push past sensible token cost.
  // 4000 chars is well past anything Lanae will type and keeps the
  // call cheap.
  const body = input.noteBody.slice(0, 4000)

  const medsCatalog = JSON.stringify(
    {
      scheduled: input.meds.scheduled.map((m) => ({
        slug: m.slug,
        name: m.name,
        slots: m.slots,
      })),
      as_needed: input.meds.as_needed.map((m) => ({
        slug: m.slug,
        name: m.name,
        indication: m.indication,
        default_dose_text: m.default_dose_text ?? null,
      })),
    },
    null,
    2,
  )

  const userMessage = [
    `The user's local capture time is ${input.capturedAt}.`,
    '',
    "Their medications:",
    medsCatalog,
    '',
    'Note body (verbatim, do not paraphrase):',
    body,
  ].join('\n')

  const client = new Anthropic({ apiKey })

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), EXTRACTION_TIMEOUT_MS)

  let raw: string
  try {
    const resp = await client.messages.create(
      {
        model: EXTRACTION_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: ctrl.signal },
    )
    const block = resp.content[0]
    if (!block || block.type !== 'text') {
      return { ok: false, error: 'unexpected response shape', reason: 'parse_error' }
    }
    raw = block.text
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    if (message.toLowerCase().includes('abort')) {
      return { ok: false, error: 'extraction timed out', reason: 'timeout' }
    }
    return { ok: false, error: message, reason: 'model_error' }
  } finally {
    clearTimeout(timer)
  }

  // Find the JSON array in the response. We tolerate the model
  // wrapping it in a fenced code block (```json) or prose.
  const json = sliceJsonArray(raw)
  if (!json) {
    return { ok: true, extractions: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'json parse failed', reason: 'parse_error' }
  }

  const validated = ExtractionListSchema.safeParse(parsed)
  if (!validated.success) {
    // Best-effort: drop entries that failed and keep the valid ones.
    if (Array.isArray(parsed)) {
      const surviving: Extraction[] = []
      for (const item of parsed as unknown[]) {
        const one = ExtractionSchema.safeParse(item)
        if (one.success) surviving.push(one.data as Extraction)
      }
      return { ok: true, extractions: surviving }
    }
    return { ok: false, error: 'extractions did not validate', reason: 'parse_error' }
  }

  return { ok: true, extractions: validated.data as Extraction[] }
}

/**
 * Type-guards for the apply route.
 */
export function isMedDose(e: Extraction): e is MedDoseExtraction {
  return e.kind === 'med_dose'
}
export function isPain(e: Extraction): e is PainExtraction {
  return e.kind === 'pain'
}
export function isHeadache(e: Extraction): e is HeadacheAttackExtraction {
  return e.kind === 'headache_attack'
}
export function isSymptom(e: Extraction): e is SymptomExtraction {
  return e.kind === 'symptom'
}

// ── System prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You read free-form patient notes and propose
candidate structured "stamps" the patient can confirm with one tap.

You output ONLY a JSON array. No prose, no markdown, no explanation.
Empty array (\`[]\`) is acceptable when the note has nothing
structured worth surfacing.

Each item in the array is one of these shapes:

1. med_dose - the patient mentions taking a medication.
   {
     "id": "<short slug-ish id unique within this array>",
     "kind": "med_dose",
     "chip_label": "<short imperative; e.g. 'Tylenol at 2:15 pm'>",
     "confidence": "low" | "medium" | "high",
     "evidence_quote": "<verbatim substring from the note>",
     "med_slug": "<must match a slug from the medications catalog provided>",
     "med_name": "<must match the matching name from the catalog>",
     "scheduled_or_prn": "scheduled" | "prn",
     "slot": "morning" | "midday" | "night" | null,
     "taken_at_iso": "<ISO 8601 with timezone, derived from the note + capture time>",
     "dose_text": "<dose string if mentioned, else null>"
   }

2. pain - the patient mentions pain with an intensity number.
   {
     "id": "...",
     "kind": "pain",
     "chip_label": "<e.g. 'Pain 7/10 left side'>",
     "confidence": "...",
     "evidence_quote": "...",
     "intensity": 0-10,
     "body_region": "<free text or null>",
     "pain_quality": "<free text or null>",
     "noted_at_iso": "<ISO 8601 with timezone>"
   }

3. headache_attack - a headache or migraine event.
   {
     "id": "...",
     "kind": "headache_attack",
     "chip_label": "<e.g. 'Headache started 2pm'>",
     "confidence": "...",
     "evidence_quote": "...",
     "started_at_iso": "...",
     "intensity": 0-10 or null,
     "side": "left" | "right" | "bilateral" | "<other>" | null,
     "aura": "<text or null>",
     "trigger": "<text or null>"
   }

4. symptom - any non-pain symptom (nausea, tinnitus, brain fog, dizzy, etc.).
   {
     "id": "...",
     "kind": "symptom",
     "chip_label": "<e.g. 'Nausea logged'>",
     "confidence": "...",
     "evidence_quote": "...",
     "label": "<short label>",
     "intensity": 0-10 or null,
     "noted_at_iso": "..."
   }

Rules:
- Only suggest med_dose entries when the medication is in the user's
  catalog. If they took something not in the list, do NOT invent a
  med_dose stamp; surface a symptom or skip it.
- Be conservative. If the note is vague or you are unsure, skip.
  Empty array is fine.
- Maximum 8 items.
- Times: when the note says "took at 2", interpret in the user's
  local frame (the capture time provides the date and the local
  timezone hint). When unspecified, use the capture time itself.
- Keep evidence_quote short (under 100 chars) and a verbatim slice
  of the note. No paraphrasing.
- Output JSON ONLY. No code fences, no trailing commentary.`

// ── Helpers ────────────────────────────────────────────────────────

function sliceJsonArray(text: string): string | null {
  // Strip code fences if present.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenceMatch ? fenceMatch[1].trim() : text.trim()
  // Find the first '[' and the matching ']'.
  const start = candidate.indexOf('[')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i]
    if (c === '[') depth += 1
    else if (c === ']') {
      depth -= 1
      if (depth === 0) return candidate.slice(start, i + 1)
    }
  }
  return null
}
