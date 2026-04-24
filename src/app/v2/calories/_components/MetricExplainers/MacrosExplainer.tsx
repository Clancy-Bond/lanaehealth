'use client'

/**
 * MacrosExplainer
 *
 * Shared tap-to-explain modal for the three macro tiles (Protein,
 * Carbs, Fat). The page passes a `kind` so one component covers all
 * three with macro-specific copy. Protein gets a banded scale because
 * the g/kg bodyweight recommendation is the only macro target with
 * widely-cited threshold guidance; carbs and fat stay paragraph-only
 * because their "right" amount is more contextual.
 */
import ExplainerSheet, { type ExplainerBand } from '../../../_components/ExplainerSheet'

export type MacroKind = 'protein' | 'carbs' | 'fat'

export interface MacrosExplainerProps {
  open: boolean
  onClose: () => void
  kind: MacroKind
  /** Grams logged today for this macro. */
  current: number
  /** Daily target in grams (from nutrition_goals). */
  target: number
  /** User bodyweight in kg, used only for protein g/kg banding. */
  bodyweightKg?: number | null
}

const PROTEIN_BANDS: ExplainerBand[] = [
  { label: 'Light', min: 0, max: 0.8, color: 'var(--v2-accent-warning)' },
  { label: 'Steady', min: 0.8, max: 1.2, color: 'var(--v2-accent-highlight)' },
  { label: 'Strong', min: 1.2, max: 1.8, color: 'var(--v2-accent-success)' },
  { label: 'High', min: 1.8, max: 2.4, color: 'var(--v2-accent-primary)' },
]

function proteinBandLabel(gPerKg: number): string {
  if (gPerKg < 0.8) return 'Light'
  if (gPerKg < 1.2) return 'Steady'
  if (gPerKg < 1.8) return 'Strong'
  return 'High'
}

export default function MacrosExplainer({
  open,
  onClose,
  kind,
  current,
  target,
  bodyweightKg,
}: MacrosExplainerProps) {
  if (kind === 'protein') {
    const hasWeight = typeof bodyweightKg === 'number' && bodyweightKg > 0
    const gPerKg = hasWeight ? current / (bodyweightKg as number) : null

    return (
      <ExplainerSheet
        open={open}
        onClose={onClose}
        title="Protein today"
        bands={hasWeight ? PROTEIN_BANDS : undefined}
        currentValue={gPerKg !== null ? Number(gPerKg.toFixed(2)) : null}
        currentBandLabel={gPerKg !== null ? proteinBandLabel(gPerKg) : undefined}
        source={
          hasWeight
            ? `${Math.round(current)} g logged so far against a ${Math.round(target)} g target. That works out to about ${(gPerKg as number).toFixed(1)} g per kg of bodyweight.`
            : `${Math.round(current)} g logged so far against a ${Math.round(target)} g target. Add a recent weigh-in to see grams per kg.`
        }
      >
        <p style={{ margin: 0 }}>
          Protein supports muscle, recovery, and steady fullness between meals. It
          tends to feel more satiating gram for gram than the other two macros.
        </p>
        <p style={{ margin: 0 }}>
          General guidance lives in grams per kilogram of bodyweight. The shaded
          bands above are common reference ranges, not personal prescriptions.
        </p>
        <p style={{ margin: 0 }}>
          <strong>How we compute it:</strong> we sum protein grams from each logged
          food. The target on your tile comes from Plan; the g/kg conversion uses
          your most recent weigh-in.
        </p>
      </ExplainerSheet>
    )
  }

  if (kind === 'carbs') {
    return (
      <ExplainerSheet
        open={open}
        onClose={onClose}
        title="Carbs today"
        source={`${Math.round(current)} g logged so far against a ${Math.round(target)} g target.`}
      >
        <p style={{ margin: 0 }}>
          Carbohydrates are your most accessible source of energy, especially for
          anything brisk or cognitively demanding. They also feed the gut microbiome
          when they come from whole foods.
        </p>
        <p style={{ margin: 0 }}>
          How much you need depends on activity, sleep, and how the rest of your day
          is shaped. We do not apply hard thresholds here because context decides.
        </p>
        <p style={{ margin: 0 }}>
          <strong>How we compute it:</strong> we sum carbohydrate grams from each
          logged food. The target comes from your Plan; tap there to adjust.
        </p>
      </ExplainerSheet>
    )
  }

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Fat today"
      source={`${Math.round(current)} g logged so far against a ${Math.round(target)} g target.`}
    >
      <p style={{ margin: 0 }}>
        Fat carries flavor, supports hormone production, and helps you absorb the
        fat-soluble vitamins (A, D, E, K). It also slows digestion, which can keep
        meals satisfying for longer.
      </p>
      <p style={{ margin: 0 }}>
        Type matters more than total most of the time. Olive oil, nuts, fish, and
        eggs contribute very different signals than fried or heavily processed
        sources, even at the same gram count.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we sum fat grams from each logged food.
        Saturated, mono, and poly breakouts are not shown on the dashboard; they
        live in the per-food detail view.
      </p>
    </ExplainerSheet>
  )
}
