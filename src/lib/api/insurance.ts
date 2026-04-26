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
 * Adding a new plan = (1) add the slug here, (2) either add the
 * carrier data to src/app/v2/insurance/_data/carriers.ts (auto
 * served via the [slug] route) OR build a dedicated
 * /v2/insurance/<slug>/page.tsx, (3) add it to
 * INSURANCE_PLAN_DEFINITIONS.
 */
export type InsurancePlanSlug =
  | 'hmsa-quest'
  | 'unitedhealthcare'
  | 'anthem-bcbs'
  | 'aetna'
  | 'cigna'
  | 'humana'
  | 'kaiser-permanente'
  | 'molina'
  | 'centene-ambetter'
  | 'highmark-bcbs'
  | 'independence-blue-cross'
  | 'medicare'
  | 'medicaid'
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
  /** Optional grouping for the searchable hub: 'private' | 'government' | 'other'. */
  category?: 'private' | 'government' | 'other'
}

export const INSURANCE_PLAN_DEFINITIONS: InsurancePlanDefinition[] = [
  {
    slug: 'hmsa-quest',
    label: 'HMSA QUEST Integration',
    description: "Hawaii Medicaid managed care plan (HMSA's Medicaid product).",
    hasContentPage: true,
    category: 'government',
  },
  {
    slug: 'unitedhealthcare',
    label: 'UnitedHealthcare (UHC)',
    description: 'Largest US private insurer; HMO, PPO, EPO, POS, Medicare Advantage.',
    hasContentPage: true,
    category: 'private',
  },
  {
    slug: 'anthem-bcbs',
    label: 'Anthem Blue Cross Blue Shield',
    description: 'BCBS licensee in 14 states (CA, CO, CT, GA, IN, KY, ME, MO, NV, NH, NY, OH, VA, WI).',
    hasContentPage: true,
    category: 'private',
  },
  {
    slug: 'aetna',
    label: 'Aetna (CVS Health)',
    description: 'CVS-owned national insurer; HMO, PPO, EPO, Medicare Advantage.',
    hasContentPage: true,
    category: 'private',
  },
  {
    slug: 'cigna',
    label: 'Cigna Healthcare',
    description: 'National insurer with HMO, PPO, EPO, and ACA marketplace plans (Cigna + Oscar).',
    hasContentPage: true,
    category: 'private',
  },
  {
    slug: 'humana',
    label: 'Humana',
    description: 'Medicare Advantage focused; also Medicaid in select states.',
    hasContentPage: true,
    category: 'private',
  },
  {
    slug: 'kaiser-permanente',
    label: 'Kaiser Permanente',
    description: 'Integrated provider + insurer in 8 states + DC.',
    hasContentPage: true,
    category: 'private',
  },
  {
    slug: 'molina',
    label: 'Molina Healthcare',
    description: 'Medicaid managed care + ACA marketplace specialist.',
    hasContentPage: true,
    category: 'private',
  },
  {
    slug: 'centene-ambetter',
    label: 'Centene / Ambetter',
    description: 'Largest ACA marketplace insurer (Ambetter); also Medicaid + WellCare Medicare.',
    hasContentPage: true,
    category: 'private',
  },
  {
    slug: 'highmark-bcbs',
    label: 'Highmark Blue Cross Blue Shield',
    description: 'BCBS licensee in PA, WV, DE, and western NY.',
    hasContentPage: true,
    category: 'private',
  },
  {
    slug: 'independence-blue-cross',
    label: 'Independence Blue Cross',
    description: 'BCBS licensee in southeastern Pennsylvania (Philadelphia metro).',
    hasContentPage: true,
    category: 'private',
  },
  {
    slug: 'medicare',
    label: 'Medicare (Original, Advantage, Supplement)',
    description: 'Federal health insurance for 65+ and some disability cases.',
    hasContentPage: true,
    category: 'government',
  },
  {
    slug: 'medicaid',
    label: 'Medicaid (state overview)',
    description: 'Joint federal and state coverage; rules vary by state.',
    hasContentPage: true,
    category: 'government',
  },
  {
    slug: 'self-pay',
    label: 'Self-pay (no insurance)',
    description: 'Paying out of pocket for visits and labs.',
    hasContentPage: false,
    category: 'other',
  },
  {
    slug: 'other',
    label: "Other / I'll add it later",
    description: 'A plan we have not built a content page for yet.',
    hasContentPage: false,
    category: 'other',
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
