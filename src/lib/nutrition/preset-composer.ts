/**
 * Preset Composer
 *
 * Merges one or more DietPreset bundles into a single flat list of
 * effective nutrient targets. Handles the two conflict-resolution
 * policies described in `diet-presets.ts`:
 *
 *   - intake-style nutrients (sodium, fluids, iron, fiber, omega-3, etc.):
 *     when two presets both set the same nutrient, the composer keeps the
 *     MAX value. This preserves the safety floor so a patient on both
 *     endo and POTS still hits the higher POTS sodium target rather than
 *     a silently overwritten endo default.
 *
 *   - threshold-style nutrients (cholesterol cap, added-sugar cap,
 *     saturated-fat cap): when two presets both set the same threshold,
 *     the composer uses LAST-WINS. The most recently applied preset
 *     determines the cap, matching clinician intent in the typical
 *     "apply this preset on top of the current set" UI flow.
 *
 * User-entered overrides always win over any preset value. This composer
 * operates on DietPreset bundles only. The database-level user overrides
 * are handled by `target-resolver.ts` and remain the highest priority.
 *
 * The composer is a pure function over its inputs. It never reads from
 * the DB and never mutates the input presets.
 */

import type { DietPreset, NutrientTarget } from './diet-presets'

/**
 * A merged nutrient target annotated with the provenance of the winning
 * value. Consumers can surface "sodium target 5000 mg from POTS Protocol"
 * in the UI without re-deriving the source.
 */
export interface ComposedTarget extends NutrientTarget {
  /** Key of the preset that supplied the winning amount. */
  sourcePresetKey: string
  /** Display name of the preset that supplied the winning amount. */
  sourcePresetName: string
  /** All preset keys that set a value for this nutrient, in apply order. */
  contributingPresetKeys: string[]
}

/**
 * Compose a list of presets into a single effective target list.
 *
 * Presets are processed in the order they appear in `presets`. For
 * threshold-style nutrients, later entries overwrite earlier entries.
 * For intake-style nutrients, the MAX value across all presets wins.
 *
 * An empty input array returns an empty list. Duplicate preset keys are
 * deduplicated by keeping the first occurrence, because applying the
 * same preset twice would otherwise double-count it for threshold nutrients.
 */
export function composePresets(presets: DietPreset[]): ComposedTarget[] {
  const seenKeys = new Set<string>()
  const orderedPresets: DietPreset[] = []
  for (const preset of presets) {
    if (seenKeys.has(preset.key)) continue
    seenKeys.add(preset.key)
    orderedPresets.push(preset)
  }

  // Tracking buckets keyed by nutrient key.
  const winners = new Map<string, ComposedTarget>()

  for (const preset of orderedPresets) {
    for (const target of preset.targets) {
      const existing = winners.get(target.nutrient)
      const policy = target.policy ?? 'intake'

      if (!existing) {
        winners.set(target.nutrient, {
          ...target,
          sourcePresetKey: preset.key,
          sourcePresetName: preset.displayName,
          contributingPresetKeys: [preset.key],
        })
        continue
      }

      // Nutrient already has a winner; merge contributing keys so the UI
      // can show both "endo raised fiber to 35 g" and "POTS did not touch
      // fiber" at once if we ever surface provenance lists.
      const contributors = existing.contributingPresetKeys.includes(preset.key)
        ? existing.contributingPresetKeys
        : [...existing.contributingPresetKeys, preset.key]

      if (policy === 'threshold') {
        // last-wins: overwrite amount and provenance
        winners.set(target.nutrient, {
          ...target,
          sourcePresetKey: preset.key,
          sourcePresetName: preset.displayName,
          contributingPresetKeys: contributors,
        })
        continue
      }

      // intake policy: keep the max
      if (target.amount > existing.amount) {
        winners.set(target.nutrient, {
          ...target,
          sourcePresetKey: preset.key,
          sourcePresetName: preset.displayName,
          contributingPresetKeys: contributors,
        })
      } else {
        // existing is still the winner, but record the new contributor
        winners.set(target.nutrient, {
          ...existing,
          contributingPresetKeys: contributors,
        })
      }
    }
  }

  return Array.from(winners.values())
}

/**
 * Convenience helper: compose a set of presets and return the composed
 * target for a single nutrient key, or null if no preset set it.
 */
export function composeTargetFor(
  presets: DietPreset[],
  nutrientKey: string,
): ComposedTarget | null {
  const composed = composePresets(presets)
  return composed.find((t) => t.nutrient === nutrientKey) ?? null
}
