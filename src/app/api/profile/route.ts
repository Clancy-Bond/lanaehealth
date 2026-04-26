/**
 * Profile API Route
 *
 * PUT /api/profile - Upsert a health_profile section
 * Body: { section: string, content: unknown (jsonb) }
 *
 * Uses service client to bypass RLS restrictions on health_profile table.
 */

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth/require-user'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'

// Allow-list of section keys that can be written through this route.
// Open-ended `string` would let a typo create a junk row that no reader
// looks at; explicit set keeps the table tidy and forces this list to be
// updated when a new section is introduced.
const ALLOWED_SECTIONS = [
  'demographics',
  'medications',
  'allergies',
  'conditions',
  'lifestyle',
  'family_history',
  'preferences',
  'blood_pressure_log',
  'heart_rate_log',
  'workouts',
  'favorites',
  'recipes',
  'custom_foods',
  'goals',
  'reminders',
  'profile_meta',
  'tutorial_progress',
  'bbt_log',
  'hormone_log',
  'weight_log',
  'water_log',
  'activity_log',
  'symptom_log',
  'note',
  'notes',
] as const

// 256KB is well above any realistic single-section payload (the largest
// observed in production is ~40KB for blood_pressure_log with hundreds
// of entries) and well below Supabase's request limits. Anything bigger
// is either a runaway loop or an attempted denial-of-service.
const MAX_CONTENT_BYTES = 256 * 1024

export const ProfilePutBodySchema = z.object({
  section: z
    .string()
    .min(1)
    .max(64)
    // Allow either an exact known key or any snake_case `_log` suffix
    // so legitimate per-feature logs can land without a code change.
    .refine(
      (s) =>
        (ALLOWED_SECTIONS as readonly string[]).includes(s) ||
        /^[a-z][a-z0-9_]{0,62}_log$/.test(s),
      'unknown section',
    ),
  // jsonb. We intentionally accept unknown here and length-check the
  // serialized form below; type-narrowing the content shape per-section
  // would belong in the per-section sanitizers, not at this generic write.
  content: z.unknown().refine((v) => v !== undefined, 'content is required'),
})

export const dynamic = 'force-dynamic'
export async function PUT(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  let userId: string
  try {
    userId = (await resolveUserId()).userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return Response.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return Response.json({ error: 'auth check failed' }, { status: 500 })
  }

  try {
    const raw: unknown = await request.json()
    const parsed = ProfilePutBodySchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return Response.json(
        { error: first?.message ?? 'Invalid body.' },
        { status: 400 },
      )
    }
    const body = parsed.data

    // Reject oversized payloads (post-shape-check so the user gets the
    // shape error first when both are wrong).
    const payloadSize = JSON.stringify(body.content ?? null).length
    if (payloadSize > MAX_CONTENT_BYTES) {
      return Response.json(
        { error: `content exceeds ${MAX_CONTENT_BYTES} bytes` },
        { status: 413 },
      )
    }

    const supabase = createServiceClient()
    // health_profile.content is jsonb. Pass the raw object so Supabase
    // serializes it natively. Session 2 W2.6: the previous JSON.stringify
    // call stored a double-encoded string that direct-access readers could
    // not use. Existing legacy-shape rows are left untouched (zero data
    // loss); readers route through parseProfileContent to handle both.
    // Upsert keyed on (user_id, section) so two users keep independent
    // profiles. Falls back to legacy section-only conflict if the
    // composite unique index hasn't been added yet (older databases).
    const { error } = await supabase.from('health_profile').upsert(
      {
        section: body.section,
        user_id: userId,
        content: body.content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,section' },
    )

    let finalErr = error
    if (error && /there is no unique or exclusion constraint matching the ON CONFLICT/i.test(error.message)) {
      const retry = await supabase.from('health_profile').upsert(
        {
          section: body.section,
          user_id: userId,
          content: body.content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'section' },
      )
      finalErr = retry.error
    }

    if (finalErr) {
      return Response.json({ error: finalErr.message }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
