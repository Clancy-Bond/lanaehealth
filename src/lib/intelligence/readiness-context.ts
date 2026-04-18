/**
 * Readiness Contributor Context.
 *
 * Condition-aware plain-English copy for each of Oura's 8 readiness
 * contributors. This is the LanaeHealth reasoning overlay that sits
 * on top of Oura's numbers. We do NOT compute a competing score; we
 * render Oura's sub-score and add a sentence explaining what it
 * means for someone with POTS + chronic pain + migraine + cycle.
 *
 * The copy here draws on the research captured in
 * docs/intelligence/readiness-formula.md (POTS autonomic markers,
 * sleep-debt non-linearity, luteal BBT rise). That research was
 * originally gathered for a competing weighted formula we scrapped;
 * it is fit-for-purpose as educational context instead.
 *
 * Voice:
 *   - Second person, warm, non-diagnostic.
 *   - Never prescribe ("you should rest"). Inform ("HRV dips like
 *     this often track with autonomic load").
 *   - Cite the specific POTS/cycle mechanism when relevant so the
 *     copy earns Lanae's trust rather than sounding generic.
 */

import type { OuraContributorId } from './readiness-signal';

export type Direction = 'up' | 'down' | 'flat' | 'missing';

export interface ContributorContext {
  /** Why this contributor matters for Lanae specifically. */
  whyItMatters: string;
  /** What today's direction likely reflects. May be null for flat/missing. */
  whatDirectionMeans: string | null;
  /** Optional research citation anchor (short tag like "PMC6936126"). */
  citation?: string;
}

/**
 * Lookup table keyed by contributor id + direction. Missing keys fall
 * back to a generic "near your 7-day median" line.
 */
const CONTEXT_TABLE: Record<
  OuraContributorId,
  { whyItMatters: string; up: string; down: string; citation?: string }
> = {
  hrv_balance: {
    whyItMatters:
      'HRV is the single most reliable autonomic marker. For POTS, falling HRV often precedes a flare by a day or two.',
    up: 'HRV up vs your 7-day means parasympathetic tone recovered overnight. Autonomic load probably eased.',
    down: 'HRV dips like this often track with autonomic load building up. Pacing today can prevent a bigger drop tomorrow.',
    citation: 'PMC6936126',
  },
  resting_heart_rate: {
    whyItMatters:
      'Resting HR tends to climb first when orthostatic load builds. Your standing-supine delta (15 bpm on Apr 7) is your own orthostatic baseline.',
    up: 'Higher RHR score means your overnight resting HR was closer to your usual baseline. Good sign.',
    down: 'Lower RHR sub-score means overnight resting HR was elevated vs your baseline. POTS flares show up here.',
    citation: 'PMC6936126',
  },
  previous_night: {
    whyItMatters:
      'Last night\u2019s sleep is the single biggest next-day input. For chronic-pain patients, one bad night is far less important than a run of them.',
    up: 'Last night was stronger than your recent average. Good buffer for today.',
    down: 'Last night ran short. One night alone is fine; watch if this becomes the pattern.',
    citation: 'PMC2892834',
  },
  sleep_balance: {
    whyItMatters:
      'Sleep balance tracks multi-day debt. Chronic debt hits cognitive performance harder than acute loss (recovery takes 4 days per hour of debt).',
    up: 'Sleep balance climbing means you\u2019re paying down accumulated debt. Keep the pattern.',
    down: 'Balance slipping suggests debt is accumulating. Recovery is exponential: longer to pay back than to lose.',
    citation: 'PMC2892834',
  },
  recovery_index: {
    whyItMatters:
      'Recovery Index = how quickly your HR settled into overnight resting after sleep onset. Faster settle = better parasympathetic reactivation.',
    up: 'Faster settle tonight. Parasympathetic response was strong.',
    down: 'Slower settle than usual. Often follows a day of overexertion or emotional load.',
  },
  body_temperature: {
    whyItMatters:
      'Body temp deviation is confounded by cycle: luteal phase naturally raises BBT 0.3-0.7\u00B0C. Oura\u2019s contributor score accounts for direction but not phase.',
    up: 'Higher contributor score here means temperature was closer to your normal. Either cycle-normal or inflammation resolved.',
    down: 'Lower score means deviation was larger than usual. Could be luteal phase if the pattern fits, or early illness if not.',
    citation: 'PMC7575238',
  },
  activity_balance: {
    whyItMatters:
      'Activity balance compares recent movement vs long-term average. For chronic illness, overexertion is the #1 flare trigger.',
    up: 'Activity balance up means recent load was closer to sustainable. Good sign you\u2019re pacing well.',
    down: 'Down = recent load higher than your sustainable baseline. Watch for delayed-onset flare 24-48h out.',
  },
  previous_day_activity: {
    whyItMatters:
      'Yesterday\u2019s load specifically. Lag between activity and payback is usually 1-2 days for POTS.',
    up: 'Yesterday\u2019s load stayed inside your sustainable zone.',
    down: 'Yesterday ran heavy. If a flare hits today or tomorrow, check if this is the trigger.',
  },
};

/**
 * Build a full context block for one contributor.
 * Flat and missing return only the "why it matters" line.
 */
export function contextFor(
  id: OuraContributorId,
  direction: Direction,
): ContributorContext {
  const row = CONTEXT_TABLE[id];
  if (direction === 'up') {
    return {
      whyItMatters: row.whyItMatters,
      whatDirectionMeans: row.up,
      citation: row.citation,
    };
  }
  if (direction === 'down') {
    return {
      whyItMatters: row.whyItMatters,
      whatDirectionMeans: row.down,
      citation: row.citation,
    };
  }
  return {
    whyItMatters: row.whyItMatters,
    whatDirectionMeans: null,
    citation: row.citation,
  };
}

/**
 * Map a citation anchor to a URL. Kept in one place so we can swap
 * citation display (tooltip vs popover vs static link) without
 * touching the context table.
 */
export function citationUrl(tag: string | undefined): string | null {
  if (!tag) return null;
  const map: Record<string, string> = {
    PMC6936126: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6936126/',
    PMC2892834: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2892834/',
    PMC7575238: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7575238/',
  };
  return map[tag] ?? null;
}
