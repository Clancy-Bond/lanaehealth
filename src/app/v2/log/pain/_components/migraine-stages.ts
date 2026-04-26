/**
 * Migraine stages - ICHD-3 four-phase model, with patient-facing
 * one-line examples adapted from Bearable's migraine tracker
 * (https://bearable.app/migraine-tracker-app).
 *
 * Used by MigraineStageChips. Kept in its own module so it can be
 * imported by pure unit tests without dragging in client-only code.
 */

export type MigraineStage = 'prodrome' | 'aura' | 'attack' | 'postdrome'

export interface MigraineStageMeta {
  key: MigraineStage
  label: string
  examples: string
}

export const MIGRAINE_STAGES: MigraineStageMeta[] = [
  {
    key: 'prodrome',
    label: 'Prodrome',
    examples:
      'Hours to a day before. Mood shifts, neck stiffness, food cravings, frequent yawning, fluid retention.',
  },
  {
    key: 'aura',
    label: 'Aura',
    examples:
      'Visual phenomena (bright spots, flashes), pins and needles, weakness or numbness, trouble with words.',
  },
  {
    key: 'attack',
    label: 'Attack',
    examples:
      'Throbbing or pulsing pain. Sensitivity to light, sound, smell, touch. Nausea, sometimes vomiting.',
  },
  {
    key: 'postdrome',
    label: 'Postdrome',
    examples: 'After the attack. Fatigue, foggy thinking, exhaustion, sometimes a strange elation.',
  },
]

export function migraineStageLabel(stage: MigraineStage): string {
  return MIGRAINE_STAGES.find((s) => s.key === stage)?.label ?? stage
}
