/**
 * Insurance Profile API (v2 navigator support)
 *
 * Stores the user's chosen insurance plan + member id in the existing
 * `health_profile` EAV table, mirroring the favorites helper at
 * src/lib/api/favorites.ts. We deliberately reuse the same single-row
 * pattern so the navigator avoids a fresh migration.
 *
 *   health_profile row: {
 *     section: 'insurance',
 *     content: { planSlug: string, memberId?: string, notes?: string }
 *   }
 *
 * `planSlug` is one of INSURANCE_PLAN_SLUGS so the renderer can route
 * to /v2/insurance/<slug> safely. Free-form strings get dropped on
 * read so a malformed row never bricks the hub page.
 */
import { createServiceClient } from '@/lib/supabase'
import { parseProfileContent } from '@/lib/profile/parse-content'

// --- plan catalog ----------------------------------------------------------

/**
 * The set of insurance plans the navigator has a content page for.
 * Adding a new plan = (1) add the slug here, (2) build
 * /v2/insurance/<slug>/page.tsx, (3) add it to INSURANCE_PLAN_DEFINITIONS.
 */
export type InsurancePlanSlug =
  | 'hmsa-quest'
  | 'self-pay'
  | 'other'

export interface InsurancePlanDefinition {
  slug: InsurancePlanSlug
  /** Display name on the picker and the hub. */
  label: string
  /** One-line description shown under the label on the picker. */
  description: string
  /** Whether a dedicated /v2/insurance/<slug> content page exists. */
  hasContentPage: boolean
}

export const INSURANCE_PLAN_DEFINITIONS: InsurancePlanDefinition[] = [
  {
    slug: 'hmsa-quest',
    label: 'HMSA QUEST Integration',
    description: "Hawaii Medicaid managed care plan (HMSA's Medicaid product).",
    hasContentPage: true,
  },
  {
    slug: 'self-pay',
    label: 'Self-pay (no insurance)',
    description: 'Paying out of pocket for visits and labs.',
    hasContentPage: false,
  },
  {
    slug: 'other',
    label: "Other / I'll add it later",
    description: 'A plan we have not built a content page for yet.',
    hasContentPage: false,
  },
]

const KNOWN_SLUGS = new Set<string>(
  INSURANCE_PLAN_DEFINITIONS.map((p) => p.slug),
)

// --- stored shape ----------------------------------------------------------

export interface InsuranceProfile {
  planSlug: InsurancePlanSlug
  /** Free-form member id the user fills in. Trimmed and capped. */
  memberId?: string
  /** Free-form notes the user adds (e.g. group number). */
  notes?: string
}

export const HEALTH_PROFILE_SECTION = 'insurance'

const MAX_MEMBER_ID_LEN = 64
const MAX_NOTES_LEN = 280

// --- parsing ---------------------------------------------------------------

/**
 * Coerce whatever came back from health_profile.content into a safe
 * InsuranceProfile or null. Mirrors coerceFavorites in favorites.ts so
 * a malformed row never bricks the navigator.
 */
export function coerceInsuranceProfile(raw: unknown): InsuranceProfile | null {
  const parsed = parseProfileContent(raw)
  if (!parsed || typeof parsed !== 'object') return null

  const slug = (parsed as { planSlug?: unknown }).planSlug
  if (typeof slug !== 'string' || !KNOWN_SLUGS.has(slug)) return null

  const profile: InsuranceProfile = { planSlug: slug as InsurancePlanSlug }

  const memberId = (parsed as { memberId?: unknown }).memberId
  if (typeof memberId === 'string' && memberId.trim().length > 0) {
    profile.memberId = memberId.trim().slice(0, MAX_MEMBER_ID_LEN)
  }

  const notes = (parsed as { notes?: unknown }).notes
  if (typeof notes === 'string' && notes.trim().length > 0) {
    profile.notes = notes.trim().slice(0, MAX_NOTES_LEN)
  }

  return profile
}

export function getPlanDefinition(
  slug: InsurancePlanSlug,
): InsurancePlanDefinition {
  const def = INSURANCE_PLAN_DEFINITIONS.find((p) => p.slug === slug)
  // Slug is constrained by the type, so this should never happen at
  // runtime. We fall back to "other" to keep the renderer pure.
  return def ?? INSURANCE_PLAN_DEFINITIONS[INSURANCE_PLAN_DEFINITIONS.length - 1]
}

// --- reads -----------------------------------------------------------------

/**
 * Read the insurance profile. Resilient to missing rows / DB hiccups.
 * Returns null if no profile is set; callers route to /v2/insurance/setup.
 */
export async function getInsuranceProfile(): Promise<InsuranceProfile | null> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('health_profile')
      .select('content')
      .eq('section', HEALTH_PROFILE_SECTION)
      .maybeSingle()

    if (error || !data) return null
    return coerceInsuranceProfile(data.content)
  } catch {
    return null
  }
}

// --- writes ----------------------------------------------------------------

/**
 * Save or replace the insurance profile. Validates server-side before
 * touching the DB so a malformed payload fails fast.
 */
export async function setInsuranceProfile(
  profile: InsuranceProfile,
): Promise<{ ok: true; profile: InsuranceProfile } | { ok: false; error: string }> {
  const normalized = coerceInsuranceProfile(profile)
  if (!normalized) {
    return { ok: false, error: 'Unrecognized insurance plan.' }
  }

  try {
    const sb = createServiceClient()
    const { error } = await sb.from('health_profile').upsert(
      {
        section: HEALTH_PROFILE_SECTION,
        content: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'section' },
    )
    if (error) return { ok: false, error: error.message }
    return { ok: true, profile: normalized }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
