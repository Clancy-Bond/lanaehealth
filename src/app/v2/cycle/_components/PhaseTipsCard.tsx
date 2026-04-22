/*
 * PhaseTipsCard
 *
 * Natural Cycles dedicates a sizable slice of its Today feed to
 * "make the most of this phase" guidance. This card is LanaeHealth's
 * equivalent: a short phase-contextualizing paragraph plus three
 * compact tips (focus / movement / food) for the current phase.
 *
 * Content is inlined here rather than pulled from phase-insights.ts
 * because that file is scoped to rotating one-off educational notes,
 * not the tripartite "focus/movement/food" template NC uses.
 *
 * Voice rules (repeated here for copy editors who land on this file):
 *   - short, kind, explanatory
 *   - no "you should" / "you must" / "you need to"
 *   - no em-dashes anywhere
 */
import { Card, ListRow } from '@/v2/components/primitives'
import type { CyclePhase } from '@/lib/types'

interface Tip {
  glyph: string
  label: string
  sub: string
}

interface TipBundle {
  phase: CyclePhase
  para: string
  tips: Tip[]
}

const TIP_BUNDLES: TipBundle[] = [
  {
    phase: 'menstrual',
    para:
      'Hormones are at their lowest this week. Energy often follows. Rest counts as part of the cycle, not a pause from it.',
    tips: [
      { glyph: 'Rest', label: 'Rest first', sub: 'Softer days are normal. Short walks beat long workouts.' },
      { glyph: 'Heat', label: 'Heat helps', sub: 'A warm compress or bath eases cramping without medication.' },
      { glyph: 'Iron', label: 'Iron-forward food', sub: 'Leafy greens, lentils, and red meat replenish what flow takes.' },
    ],
  },
  {
    phase: 'follicular',
    para:
      'Estrogen climbs through this phase. Mood and stamina often climb with it. A good stretch for fresh starts.',
    tips: [
      { glyph: 'Focus', label: 'Focus work', sub: 'Good days for deep tasks and new plans.' },
      { glyph: 'Move', label: 'Movement feels easier', sub: 'Strength training and longer walks often land well.' },
      { glyph: 'Food', label: 'Lean protein + greens', sub: 'Eggs, fish, beans, and dark greens fuel the climb.' },
    ],
  },
  {
    phase: 'ovulatory',
    para:
      'Estrogen peaks and energy usually peaks with it. Some notice mid-cycle twinges; most feel their most social.',
    tips: [
      { glyph: 'Talk', label: 'Social energy', sub: 'Meetings, calls, and difficult conversations often go better now.' },
      { glyph: 'Sweat', label: 'High-output movement', sub: 'Sprints, heavy lifts, group classes suit this window.' },
      { glyph: 'Hydrate', label: 'Water + electrolytes', sub: 'Extra sweat and heat mean more fluids than usual.' },
    ],
  },
  {
    phase: 'luteal',
    para:
      'Progesterone rises, body temperature edges up, and mood can drift lower as the phase ends. Steady beats intense here.',
    tips: [
      { glyph: 'Plan', label: 'Steady pacing', sub: 'Break projects into smaller pieces. Afternoons often feel softer.' },
      { glyph: 'Walk', label: 'Gentle movement', sub: 'Walking, yoga, or stretching tend to feel better than intense cardio.' },
      { glyph: 'Warm', label: 'Warm, grounding meals', sub: 'Roasted vegetables, whole grains, and magnesium-rich food help.' },
    ],
  },
]

export interface PhaseTipsCardProps {
  phase: CyclePhase | null
}

export default function PhaseTipsCard({ phase }: PhaseTipsCardProps) {
  if (!phase) return null
  const bundle = TIP_BUNDLES.find((b) => b.phase === phase)
  if (!bundle) return null

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            This phase &middot; {phase}
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {bundle.para}
          </p>
        </div>
        <div>
          {bundle.tips.map((t, i) => (
            <ListRow
              key={t.label}
              leading={
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--v2-radius-full)',
                    background: 'var(--v2-bg-elevated)',
                    fontSize: 'var(--v2-text-xs)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-text-secondary)',
                    letterSpacing: 'var(--v2-tracking-wide)',
                  }}
                >
                  {t.glyph}
                </span>
              }
              label={t.label}
              subtext={t.sub}
              divider={i < bundle.tips.length - 1}
            />
          ))}
        </div>
      </div>
    </Card>
  )
}
