/*
 * PhaseExplainerCard
 *
 * The educational piece of /v2/topics/cycle. Four plain-English mini
 * sections walking through menstrual, follicular, ovulatory, and
 * luteal phases with what tends to happen physiologically. Sits on
 * the Natural-Cycles cream surface (Card variant="explanatory")
 * wrapped in .v2-surface-explanatory so the warm palette reads
 * correctly against the dark chrome around it.
 *
 * Voice follows Natural Cycles: short, kind, informational. No "you
 * should" phrasing, no optimization language, no diet or exercise
 * prescriptions. Describes patterns, does not prescribe behavior.
 */
import { Card } from '@/v2/components/primitives'

type Phase = {
  eyebrow: string
  title: string
  body: string
}

const PHASES: Phase[] = [
  {
    eyebrow: 'Menstrual',
    title: 'Days 1 to 5',
    body: 'Day 1 is the first day of bleeding. Estrogen and progesterone are at their lowest. Pain, fatigue, and migraines often peak here.',
  },
  {
    eyebrow: 'Follicular',
    title: 'Days 1 to 13',
    body: 'Estrogen climbs. Energy and mood tend to rise with it.',
  },
  {
    eyebrow: 'Ovulatory',
    title: 'Days 12 to 16',
    body: 'A short window around ovulation. Libido may rise. Fertile days fall inside it.',
  },
  {
    eyebrow: 'Luteal',
    title: 'Days 15 to 28',
    body: 'Progesterone dominant. PMS symptoms often cluster in the days 2 to 5 before the next period. Menstrual migraines often start here or in early menstrual.',
  },
]

export default function PhaseExplainerCard() {
  return (
    <div className="v2-surface-explanatory">
      <Card variant="explanatory" padding="md">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-4)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-surface-explanatory-text)',
            }}
          >
            What the phases mean
          </h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-4)',
            }}
          >
            {PHASES.map((p) => (
              <div
                key={p.eyebrow}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--v2-space-1)',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-surface-explanatory-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--v2-tracking-wide)',
                  }}
                >
                  {p.eyebrow} &middot; {p.title}
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--v2-text-sm)',
                    color: 'var(--v2-surface-explanatory-text)',
                    lineHeight: 'var(--v2-leading-relaxed)',
                  }}
                >
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
