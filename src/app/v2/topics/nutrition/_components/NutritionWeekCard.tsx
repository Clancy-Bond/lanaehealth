/*
 * NutritionWeekCard
 *
 * Compact "this week on your plate" strip. Shows three facts derived
 * from the nutrition-coach context builder:
 *   1. Meals logged in the last 7 days
 *   2. Current cycle phase (when known)
 *   3. Whether nutrient targets are active
 *
 * The live data is intentionally shallow : this is a reading page,
 * not the /calories dashboard. Signals sit here so Lanae can see at
 * a glance that the condition cards below speak to her current
 * context, not to an abstract patient.
 *
 * Voice follows Natural Cycles. No optimization language, no "you
 * should". The cycle-phase note is descriptive, not prescriptive.
 */
import { Card } from '@/v2/components/primitives'
import type { NutritionCoachContext } from '@/lib/intelligence/nutrition-coach-context'
import type { CyclePhase } from '@/lib/types'

export interface NutritionWeekCardProps {
  ctx: NutritionCoachContext
}

function phaseNote(phase: CyclePhase | null): {
  label: string
  subtext: string
} {
  switch (phase) {
    case 'menstrual':
      return {
        label: 'Menstrual phase',
        subtext:
          'Estrogen and progesterone are low. Appetite and energy often shift.',
      }
    case 'follicular':
      return {
        label: 'Follicular phase',
        subtext:
          'Estrogen climbs. Energy often rises with it.',
      }
    case 'ovulatory':
      return {
        label: 'Ovulatory phase',
        subtext:
          'A short window around ovulation. Appetite can vary.',
      }
    case 'luteal':
      return {
        label: 'Luteal phase',
        subtext:
          'Progesterone dominant. Cravings and appetite commonly shift.',
      }
    default:
      return {
        label: 'Phase unknown',
        subtext: 'No recent menstruation signal to anchor a phase.',
      }
  }
}

function nutrientNote(targetCount: number): {
  label: string
  subtext: string
} {
  if (targetCount <= 0) {
    return {
      label: 'No nutrient stats yet.',
      subtext: 'Log meals with nutrient detail to see trends here.',
    }
  }
  return {
    label: `${targetCount} target${targetCount === 1 ? '' : 's'} active`,
    subtext: 'Resolved from your presets and RDA defaults.',
  }
}

export default function NutritionWeekCard({ ctx }: NutritionWeekCardProps) {
  const mealCount = ctx.sections.recentMealCount
  const phase = ctx.sections.cyclePhase?.phase ?? null
  const phaseInfo = phaseNote(phase)
  const nutrientInfo = nutrientNote(ctx.sections.nutrientTargetCount)

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
          }}
        >
          This week
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 'var(--v2-space-3)',
          }}
        >
          <WeekRow
            label="Meals logged (7 days)"
            value={mealCount === 0 ? 'None yet' : String(mealCount)}
            subtext={
              mealCount === 0
                ? 'Patterns show up once you log a few days.'
                : mealCount === 1
                  ? '1 meal in the window.'
                  : `${mealCount} meals in the window.`
            }
          />
          <WeekRow
            label={phaseInfo.label}
            value=""
            subtext={phaseInfo.subtext}
          />
          <WeekRow
            label={nutrientInfo.label}
            value=""
            subtext={nutrientInfo.subtext}
          />
        </div>
      </div>
    </Card>
  )
}

function WeekRow({
  label,
  value,
  subtext,
}: {
  label: string
  value: string
  subtext: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--v2-space-2)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-medium)',
            color: 'var(--v2-text-primary)',
          }}
        >
          {label}
        </span>
        {value && (
          <span
            style={{
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        {subtext}
      </span>
    </div>
  )
}
