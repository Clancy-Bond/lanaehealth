/**
 * Lite Log activity registry (Wave 2e F2).
 *
 * This is the curated, POTS- and endometriosis-specific list of activity,
 * symptom, and factor toggles that power the Daylio-inspired 30-second lite
 * log on /log. The registry is the single source of truth for:
 *
 *   1. The seed rows in migration 022_lite_log_activities.sql (names + icons).
 *   2. The ActivityIconGrid UI inside LiteLogCard.tsx (labels + categories).
 *   3. Best-vs-worst-days aggregation in Wave 2e F3.
 *
 * Design rules (see docs/plans/2026-04-17-wave-2e-briefs.md):
 *  - 25-30 entries, curated for Lanae's conditions (POTS + stage-IV endo +
 *    chronic migraine + heavy menstrual flow). NOT a generic Daylio list.
 *  - Lucide-react icon names only. Sage/blush palette colors applied at
 *    render time, not stored here.
 *  - Category drives the column grouping in the grid:
 *      "activity" - positive coping actions (compression socks, salt, etc.)
 *      "symptom"  - body-felt symptoms (cramps, dizzy, flare)
 *      "factor"   - environmental / behavioral triggers
 *      "supplement" - vitamins / medications self-administered
 *  - No shame framing. "Lite log on a bad day" is a positive choice, not
 *    a fallback. Labels are neutral or affirming.
 *
 * Order is intentional: items users tap most on low-energy days (compression
 * socks, salt, lying flat, heat pad) are early. display_order is spaced by
 * 10 so future inserts do not renumber everything.
 */

import type { TrackableCategory } from '@/lib/types'

export type LucideIconName =
  | 'socks'
  | 'droplets'
  | 'salad'
  | 'bed'
  | 'armchair'
  | 'flame'
  | 'shower-head'
  | 'utensils-crossed'
  | 'coffee'
  | 'footprints'
  | 'dumbbell'
  | 'pill'
  | 'pill-bottle'
  | 'droplet'
  | 'flower-2'
  | 'zap-off'
  | 'brain'
  | 'thermometer-sun'
  | 'moon'
  | 'sun'
  | 'wind'
  | 'users'
  | 'heart-pulse'
  | 'cloud-sun-rain'
  | 'eye-closed'
  | 'waves'
  | 'briefcase'
  | 'car'

export interface LiteLogActivity {
  /** Canonical unique name. Matches `custom_trackables.name` UNIQUE constraint. */
  name: string
  /** Short user-facing label (<= 20 chars) for icon tile. */
  label: string
  /** Category bucket used for grid grouping. */
  category: TrackableCategory
  /** Lucide icon identifier. Render via icon registry in LiteLogCard. */
  icon: LucideIconName
  /** Display order in the grid. Lower = shown first. */
  displayOrder: number
  /** Palette accent for the icon tile. Matches sage / blush tokens. */
  palette: 'sage' | 'blush'
  /** Short accessible description used for aria-label + tooltip. */
  description: string
}

/**
 * Curated registry of 28 POTS / endo / chronic-illness activity toggles.
 *
 * Rough mix:
 *   - 14 activities (positive coping behaviors)
 *   -  6 symptoms  (body-felt states)
 *   -  6 factors   (triggers / environment)
 *   -  2 supplements (common PRN meds Lanae uses)
 */
export const LITE_LOG_ACTIVITIES: LiteLogActivity[] = [
  // ── Positive coping: tap these on a bad day ─────────────────────────
  {
    name: 'Compression socks',
    label: 'Compression',
    category: 'activity',
    icon: 'socks',
    displayOrder: 10,
    palette: 'sage',
    description: 'Wore compression socks or thigh-highs to help blood pool',
  },
  {
    name: 'Salt + electrolytes',
    label: 'Electrolytes',
    category: 'activity',
    icon: 'droplets',
    displayOrder: 20,
    palette: 'sage',
    description: 'Took salt tablet, LMNT, or electrolyte drink',
  },
  {
    name: 'Lying flat',
    label: 'Lying flat',
    category: 'activity',
    icon: 'bed',
    displayOrder: 30,
    palette: 'sage',
    description: 'Lay flat or legs-up to ease orthostatic symptoms',
  },
  {
    name: 'Heat pad',
    label: 'Heat pad',
    category: 'activity',
    icon: 'flame',
    displayOrder: 40,
    palette: 'blush',
    description: 'Used heating pad for cramps or pain',
  },
  {
    name: 'Hydration goal met',
    label: 'Hydrated',
    category: 'activity',
    icon: 'droplet',
    displayOrder: 50,
    palette: 'sage',
    description: 'Drank enough water to meet daily goal',
  },
  {
    name: 'Protein-forward meal',
    label: 'Protein meal',
    category: 'activity',
    icon: 'salad',
    displayOrder: 60,
    palette: 'sage',
    description: 'Ate a meal with adequate protein (>= 20g)',
  },
  {
    name: 'Gentle movement',
    label: 'Gentle move',
    category: 'activity',
    icon: 'footprints',
    displayOrder: 70,
    palette: 'sage',
    description: 'Short walk or stretching, within energy budget',
  },
  {
    name: 'Recumbent exercise',
    label: 'Recumbent',
    category: 'activity',
    icon: 'dumbbell',
    displayOrder: 80,
    palette: 'sage',
    description: 'Rowing, recumbent bike, or floor-based strength',
  },
  {
    name: 'Cool shower',
    label: 'Cool shower',
    category: 'activity',
    icon: 'shower-head',
    displayOrder: 90,
    palette: 'sage',
    description: 'Lukewarm or cool shower (avoided hot water)',
  },
  {
    name: 'Paced rest',
    label: 'Rest break',
    category: 'activity',
    icon: 'armchair',
    displayOrder: 100,
    palette: 'sage',
    description: 'Scheduled pacing break before exhaustion',
  },
  {
    name: 'Grounding practice',
    label: 'Grounding',
    category: 'activity',
    icon: 'flower-2',
    displayOrder: 110,
    palette: 'sage',
    description: 'Breathing, meditation, or nervous system reset',
  },
  {
    name: 'Social connection',
    label: 'Social',
    category: 'activity',
    icon: 'users',
    displayOrder: 120,
    palette: 'sage',
    description: 'Meaningful conversation or time with loved ones',
  },
  {
    name: 'Outdoor time',
    label: 'Outside',
    category: 'activity',
    icon: 'sun',
    displayOrder: 130,
    palette: 'sage',
    description: 'Spent time outdoors, even briefly',
  },
  {
    name: 'Early wind-down',
    label: 'Wind down',
    category: 'activity',
    icon: 'moon',
    displayOrder: 140,
    palette: 'sage',
    description: 'Started bedtime routine with buffer time',
  },

  // ── Symptoms: tap what your body did today ──────────────────────────
  {
    name: 'Dizzy on standing',
    label: 'Dizzy',
    category: 'symptom',
    icon: 'waves',
    displayOrder: 200,
    palette: 'blush',
    description: 'Lightheaded, presyncope, or dizzy when standing',
  },
  {
    name: 'Cramps',
    label: 'Cramps',
    category: 'symptom',
    icon: 'zap-off',
    displayOrder: 210,
    palette: 'blush',
    description: 'Pelvic or menstrual cramping',
  },
  {
    name: 'Brain fog',
    label: 'Brain fog',
    category: 'symptom',
    icon: 'brain',
    displayOrder: 220,
    palette: 'blush',
    description: 'Difficulty with focus, memory, or word-finding',
  },
  {
    name: 'Heavy flow',
    label: 'Heavy flow',
    category: 'symptom',
    icon: 'droplet',
    displayOrder: 230,
    palette: 'blush',
    description: 'Heavier than typical menstrual flow',
  },
  {
    name: 'Migraine / headache',
    label: 'Head pain',
    category: 'symptom',
    icon: 'eye-closed',
    displayOrder: 240,
    palette: 'blush',
    description: 'Migraine, aura, or non-migraine headache',
  },
  {
    name: 'Racing heart',
    label: 'Racing HR',
    category: 'symptom',
    icon: 'heart-pulse',
    displayOrder: 250,
    palette: 'blush',
    description: 'Palpitations or tachycardia episode',
  },

  // ── Factors: things you noticed in your environment ────────────────
  {
    name: 'Standing > 1 hour',
    label: 'Long stand',
    category: 'factor',
    icon: 'footprints',
    displayOrder: 300,
    palette: 'blush',
    description: 'Upright for more than an hour without a break',
  },
  {
    name: 'Skipped meal',
    label: 'Skipped meal',
    category: 'factor',
    icon: 'utensils-crossed',
    displayOrder: 310,
    palette: 'blush',
    description: 'Skipped or delayed a meal',
  },
  {
    name: 'Hot weather / hot bath',
    label: 'Heat exposure',
    category: 'factor',
    icon: 'thermometer-sun',
    displayOrder: 320,
    palette: 'blush',
    description: 'Hot environment, bath, or shower',
  },
  {
    name: 'Poor sleep night',
    label: 'Bad sleep',
    category: 'factor',
    icon: 'cloud-sun-rain',
    displayOrder: 330,
    palette: 'blush',
    description: 'Poor sleep quality or less than usual',
  },
  {
    name: 'Caffeine',
    label: 'Caffeine',
    category: 'factor',
    icon: 'coffee',
    displayOrder: 340,
    palette: 'blush',
    description: 'Coffee, tea, or caffeinated drink',
  },
  {
    name: 'Travel / car ride',
    label: 'Travel',
    category: 'factor',
    icon: 'car',
    displayOrder: 350,
    palette: 'blush',
    description: 'Commute, long car ride, or travel day',
  },

  // ── Supplements / PRN meds ─────────────────────────────────────────
  {
    name: 'Beta blocker taken',
    label: 'Beta blocker',
    category: 'supplement',
    icon: 'pill',
    displayOrder: 400,
    palette: 'sage',
    description: 'Logged scheduled beta blocker dose',
  },
  {
    name: 'PRN pain med',
    label: 'PRN pain',
    category: 'supplement',
    icon: 'pill-bottle',
    displayOrder: 410,
    palette: 'sage',
    description: 'As-needed pain medication (ibuprofen, tramadol, etc.)',
  },
]

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Group activities by category, preserving order within each group.
 * Used by ActivityIconGrid to render sectioned columns.
 */
export function groupActivitiesByCategory(
  activities: LiteLogActivity[] = LITE_LOG_ACTIVITIES
): { category: TrackableCategory; items: LiteLogActivity[] }[] {
  const order: TrackableCategory[] = ['activity', 'symptom', 'factor', 'supplement', 'other']
  const buckets = new Map<TrackableCategory, LiteLogActivity[]>()
  for (const item of activities) {
    const bucket = buckets.get(item.category) ?? []
    bucket.push(item)
    buckets.set(item.category, bucket)
  }
  const groups: { category: TrackableCategory; items: LiteLogActivity[] }[] = []
  for (const cat of order) {
    const items = buckets.get(cat)
    if (items && items.length > 0) {
      groups.push({
        category: cat,
        items: [...items].sort((a, b) => a.displayOrder - b.displayOrder),
      })
    }
  }
  return groups
}

/**
 * Look up the registry entry for a given trackable name. Returns null when
 * the trackable was created manually by the user and not part of the seed
 * (e.g., the user added their own trackable via the Custom Factors editor).
 */
export function findActivityByName(name: string): LiteLogActivity | null {
  return LITE_LOG_ACTIVITIES.find((a) => a.name === name) ?? null
}

/**
 * Friendly label for a category tab. Never uses shaming or deficit language.
 */
export function categoryLabel(category: TrackableCategory): string {
  switch (category) {
    case 'activity':
      return 'What helped'
    case 'symptom':
      return 'What I felt'
    case 'factor':
      return 'What I noticed'
    case 'supplement':
      return 'Meds & supplements'
    default:
      return 'Other'
  }
}
