// ---------------------------------------------------------------------------
// Micro-care action registry
//
// The curated set of 30-second self-care actions surfaced in the bottom-sheet
// MicroCareDrawer. Tuned for Lanae's conditions (POTS, endo, chronic
// fatigue, tension headache, anxiety) per the brief.
//
// Voice rules:
//   - Label copy is short and neutral. No "must do" framing.
//   - Subtitle is a single fact about WHY this helps, not a command.
//   - The drawer and card copy uses "Quick action. 30 seconds." as the
//     mental model. Never "Complete this task." Never "Goal met."
//
// Interaction model:
//   - Each action has an optional "flow" (breathing, grounding, timer).
//   - Actions without a flow are single-tap "I did this" logs.
//   - Completion writes one row to micro_care_completions. No streaks.
//
// See docs/plans/2026-04-16-non-shaming-voice-rule.md and
//     docs/competitive/finch/implementation-notes.md Feature 3.
// ---------------------------------------------------------------------------

export type MicroCareCategory =
  | 'pots'
  | 'endo'
  | 'nervous-system'
  | 'headache'
  | 'general'

export type MicroCareFlow =
  | 'timer'       // Simple countdown (e.g. "elevate legs 5 min")
  | 'breathing'   // Box or 4-7-8 breathing
  | 'grounding'   // 5-4-3-2-1 sensory grounding
  | 'none'        // Single-tap confirmation ("I did this")

export interface MicroCareAction {
  slug: string
  label: string
  subtitle: string
  icon: string         // emoji or short symbol rendered in the card
  category: MicroCareCategory
  durationSeconds: number
  flow: MicroCareFlow
}

// ---------------------------------------------------------------------------
// The starter library (10 actions per the brief).
// Order here is the order they appear in the drawer.
// Curated for POTS + endo + nervous-system relevance.
// ---------------------------------------------------------------------------
export const MICRO_CARE_ACTIONS: readonly MicroCareAction[] = [
  {
    slug: 'salt-tablet',
    label: 'Salt tablet',
    subtitle: 'Take 500 mg sodium',
    icon: '\u{1F9C2}',           // salt shaker
    category: 'pots',
    durationSeconds: 30,
    flow: 'none',
  },
  {
    slug: 'hydrate-500',
    label: 'Drink 500 ml water',
    subtitle: 'POTS volume support',
    icon: '\u{1F4A7}',           // droplet
    category: 'pots',
    durationSeconds: 60,
    flow: 'none',
  },
  {
    slug: 'elevate-legs',
    label: 'Elevate legs 5 min',
    subtitle: 'Helps pooled blood return',
    icon: '\u{1F6CC}',           // person in bed
    category: 'pots',
    durationSeconds: 300,
    flow: 'timer',
  },
  {
    slug: 'heat-pad-pelvis',
    label: 'Heat pad on pelvis',
    subtitle: 'Eases endo cramps',
    icon: '\u{1F525}',           // fire
    category: 'endo',
    durationSeconds: 600,
    flow: 'timer',
  },
  {
    slug: 'box-breathing',
    label: 'Box breathing',
    subtitle: '4-4-4-4 parasympathetic reset',
    icon: '\u{1F343}',           // leaf
    category: 'nervous-system',
    durationSeconds: 120,
    flow: 'breathing',
  },
  {
    slug: 'grounding-54321',
    label: '5-4-3-2-1 grounding',
    subtitle: 'Anxiety + pain distraction',
    icon: '\u{1F9E0}',           // brain
    category: 'nervous-system',
    durationSeconds: 90,
    flow: 'grounding',
  },
  {
    slug: 'neck-stretch',
    label: 'Gentle neck stretch',
    subtitle: 'Releases tension headache',
    icon: '\u{1F9D8}',           // person in lotus
    category: 'headache',
    durationSeconds: 60,
    flow: 'timer',
  },
  {
    slug: 'cold-wrist',
    label: 'Cold on inner wrist',
    subtitle: 'Hot flash + anxiety calm',
    icon: '\u2744\uFE0F',         // snowflake
    category: 'nervous-system',
    durationSeconds: 60,
    flow: 'timer',
  },
  {
    slug: 'compression-check',
    label: 'Compression sock check',
    subtitle: 'POTS upright support',
    icon: '\u{1F9E6}',           // socks
    category: 'pots',
    durationSeconds: 30,
    flow: 'none',
  },
  {
    slug: 'legs-up-wall',
    label: 'Legs-up-the-wall pose',
    subtitle: 'POTS + full-body reset',
    icon: '\u{1F9D8}',           // person in lotus
    category: 'pots',
    durationSeconds: 300,
    flow: 'timer',
  },
] as const

/**
 * Look up a single action by its registry slug. Returns `null` for
 * unknown slugs (never throws) so stray rows in the DB do not crash UI.
 */
export function getMicroCareAction(slug: string): MicroCareAction | null {
  return MICRO_CARE_ACTIONS.find((a) => a.slug === slug) ?? null
}

/**
 * Return true when a slug is in the active registry. Used by the API
 * helper to reject typos before hitting the DB.
 */
export function isValidMicroCareSlug(slug: string): boolean {
  return MICRO_CARE_ACTIONS.some((a) => a.slug === slug)
}
