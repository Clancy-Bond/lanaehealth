/**
 * Phase-matched insight content for the Home/Log InsightBanner.
 *
 * Static editorial content tagged by cycle phase. We avoid Layer 2 summary
 * tagging (core infra) and instead keep the dictionary self-contained. The
 * banner filters to entries whose phase matches the current phase computed
 * from nc_imported via cycle-calculator, falling back to 'all' tier.
 *
 * Editorial rules (see docs/competitive/design-decisions.md Section 5):
 *   - no diet claims, no fertility pressure, no cycle-syncing workout prescriptions
 *   - warm second person, plain language, no em dashes
 *   - every entry carries an evidence_tag so the UI can surface provenance
 *   - content focuses on symptom expectations and validated self care
 *     (heat, hydration, pacing) rather than productivity or optimization
 */
import type { CyclePhase } from '@/lib/types'

export type EvidenceTag = 'clinical' | 'educational' | 'self-care'

export interface PhaseInsight {
  id: string
  phase: CyclePhase | 'all'
  title: string
  body: string
  evidence_tag: EvidenceTag
}

/**
 * Curated pool. Each entry is safe for a POTS / endo / chronic-illness patient.
 * Avoid stacking diet or exercise prescriptions here. Self-care > optimization.
 */
export const PHASE_INSIGHTS: PhaseInsight[] = [
  // ── Menstrual ──────────────────────────────────────────────────
  {
    id: 'menstrual-heat',
    phase: 'menstrual',
    title: 'Heat is your friend this week',
    body: 'A warm compress on your lower abdomen can ease cramping. You do not have to push through pain to prove anything.',
    evidence_tag: 'self-care',
  },
  {
    id: 'menstrual-iron',
    phase: 'menstrual',
    title: 'Blood loss can affect energy',
    body: 'Heavier flow days often show up as deeper fatigue. If your ferritin has ever run low, mention flow pattern to your provider.',
    evidence_tag: 'clinical',
  },
  {
    id: 'menstrual-pacing',
    phase: 'menstrual',
    title: 'Pacing counts as effort',
    body: 'Resting today is not time lost. Your logs help you spot which menstrual days are hardest and plan around them.',
    evidence_tag: 'self-care',
  },

  // ── Follicular ─────────────────────────────────────────────────
  {
    id: 'follicular-baseline',
    phase: 'follicular',
    title: 'A steadier stretch of your cycle',
    body: 'Many people feel clearer headed after their period ends. Notice what feels workable today and log it, without setting new expectations.',
    evidence_tag: 'educational',
  },
  {
    id: 'follicular-hydration',
    phase: 'follicular',
    title: 'Hydration stays central',
    body: 'Even outside POTS-heavy days, steady water and electrolytes keep your standing pulse more predictable.',
    evidence_tag: 'self-care',
  },

  // ── Ovulatory ──────────────────────────────────────────────────
  {
    id: 'ovulatory-symptom-check',
    phase: 'ovulatory',
    title: 'Mid-cycle can shift symptoms',
    body: 'Some people notice brief pelvic twinges, mood changes, or one-sided pain around ovulation. Logging helps separate signal from noise.',
    evidence_tag: 'educational',
  },
  {
    id: 'ovulatory-bbt',
    phase: 'ovulatory',
    title: 'Temperature data is telling a story',
    body: 'Your BBT and Oura overnight temp shifts are part of how we detect ovulation. Consistent wake time keeps that signal cleaner.',
    evidence_tag: 'clinical',
  },

  // ── Luteal ─────────────────────────────────────────────────────
  {
    id: 'luteal-heart-rate',
    phase: 'luteal',
    title: 'Resting pulse can tick up',
    body: 'A small rise in resting heart rate in the second half of your cycle is expected. If your standing pulse feels worse than usual, log it.',
    evidence_tag: 'clinical',
  },
  {
    id: 'luteal-mood',
    phase: 'luteal',
    title: 'Mood dips are common here',
    body: 'The days before your period can bring more irritability or low mood. It is hormonal, not a character flaw.',
    evidence_tag: 'educational',
  },
  {
    id: 'luteal-bloat',
    phase: 'luteal',
    title: 'Bloating tends to peak now',
    body: 'Heat, gentle movement if you have the energy, and comfortable clothes help. No need to restrict food to feel better.',
    evidence_tag: 'self-care',
  },

  // ── All phases (fallback / universal) ──────────────────────────
  {
    id: 'all-log-consistency',
    phase: 'all',
    title: 'Daily notes become patterns',
    body: 'Even one sentence about today adds up. Your logs make doctor visits sharper and help you spot what actually moves your symptoms.',
    evidence_tag: 'educational',
  },
  {
    id: 'all-body-first',
    phase: 'all',
    title: 'Check in with your body',
    body: 'Before logging, take one slow breath and notice how you actually feel. The number scales work best when they reflect right now.',
    evidence_tag: 'self-care',
  },
]

/**
 * Pick a deterministic insight for a given phase and date.
 * Same date + same phase yields the same insight, so the UI is stable
 * across a day but rotates daily.
 *
 * @param phase - current cycle phase, or null if unknown
 * @param dateISO - YYYY-MM-DD used for deterministic rotation
 * @returns a PhaseInsight, or null if the pool is somehow empty
 */
export function pickPhaseInsight(
  phase: CyclePhase | null,
  dateISO: string
): PhaseInsight | null {
  const matched = phase
    ? PHASE_INSIGHTS.filter((i) => i.phase === phase)
    : []
  const pool = matched.length > 0
    ? matched
    : PHASE_INSIGHTS.filter((i) => i.phase === 'all')

  if (pool.length === 0) return null

  const seed = hashDate(dateISO)
  const idx = seed % pool.length
  return pool[idx]
}

/**
 * List every insight available for a given phase (matched + all).
 * Useful for tests and the phase-rotation logic in the UI.
 */
export function insightsForPhase(phase: CyclePhase | null): PhaseInsight[] {
  if (!phase) return PHASE_INSIGHTS.filter((i) => i.phase === 'all')
  const matched = PHASE_INSIGHTS.filter((i) => i.phase === phase)
  const universal = PHASE_INSIGHTS.filter((i) => i.phase === 'all')
  return [...matched, ...universal]
}

/**
 * Cheap deterministic hash for a YYYY-MM-DD string.
 * Not cryptographic. Just gives us a stable integer for array indexing.
 */
function hashDate(dateISO: string): number {
  let h = 0
  for (let i = 0; i < dateISO.length; i++) {
    h = (h * 31 + dateISO.charCodeAt(i)) >>> 0
  }
  return h
}
