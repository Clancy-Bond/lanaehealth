/*
 * /v2/calories/health/composition (server component)
 *
 * Body composition focus surface. Pulls latest values from
 * body_metrics_log (Migration 037) and the personal profile
 * (height/age/sex), computes BMI, body fat (Navy if measurements
 * present, otherwise stored value), WHR, WHtR, LBM, fat mass, and
 * BP-derived MAP / pulse pressure where appropriate. Each derived
 * row is tappable for an explainer modal.
 *
 * Following the existing /v2/calories/health/weight pattern: server
 * action via form, no JS needed for the happy path. Voice rule:
 * factual, plain-English category strings.
 */
import Link from 'next/link'
import { Banner, EmptyState } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import {
  loadBodyMetricsLog,
  latestValue,
} from '@/lib/calories/body-metrics-log'
import {
  loadPersonalProfile,
  normalizeSex,
} from '@/lib/calories/personal-profile'
import {
  bodyFatCategory,
  calculateBMI,
  calculateBodyFatNavy,
  calculateFatMass,
  calculateLBM,
  calculateWHR,
  calculateWHtR,
} from '@/lib/calories/body-metrics'
import { kgToLb } from '@/lib/calories/weight'
import CompositionForm from './_components/CompositionForm'
import CompositionMetricsCard, {
  type ComputedMetric,
} from './_components/CompositionMetricsCard'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Body composition - LanaeHealth' }

export default async function V2CompositionPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const params = await searchParams
  const saved = params.saved === '1'
  const error = params.error ?? null

  const [log, profile] = await Promise.all([
    loadBodyMetricsLog(),
    loadPersonalProfile(),
  ])

  const sex = normalizeSex(profile.sex)
  const heightCm = profile.height_cm ?? null

  // Pull latest non-null values.
  const weightKg = latestValue(log, 'weight_kg') ?? profile.weight_kg ?? null
  const bodyFatStored = latestValue(log, 'body_fat_pct')
  const waistCm = latestValue(log, 'waist_cm')
  const hipCm = latestValue(log, 'hip_cm')
  const neckCm = latestValue(log, 'neck_cm')
  const muscleKg = latestValue(log, 'muscle_mass_kg')
  const visceralRating = latestValue(log, 'visceral_fat_rating')
  const bmdT = latestValue(log, 'bmd_t_score')

  const metrics: ComputedMetric[] = []

  // BMI
  if (weightKg && heightCm) {
    const r = calculateBMI(weightKg, heightCm)
    metrics.push({
      key: 'bmi',
      label: 'BMI',
      value: r.bmi.toFixed(1),
      category: r.category,
      explanation:
        'BMI compares weight to height squared. WHO uses 18.5 to 24.9 as the ' +
        'normal band. It cannot tell muscle apart from fat, so athletes can ' +
        'land in "overweight" with low body fat. Read it alongside body fat ' +
        'and waist measures, never alone.',
      source:
        'World Health Organization, Technical Report Series 894 (2000). ' +
        'See docs/research/comprehensive-body-metrics.md.',
      bands: [
        { label: 'Underweight', min: 14, max: 18.5, color: '#5DADE6' },
        { label: 'Normal', min: 18.5, max: 25, color: '#6ACF89' },
        { label: 'Overweight', min: 25, max: 30, color: '#E5C952' },
        { label: 'Obese', min: 30, max: 45, color: '#D9775C' },
      ],
      numericValue: r.bmi,
      currentBandLabel: r.category,
    })
  }

  // Body fat: prefer Navy if measurements complete, else stored value.
  let bodyFatValue: number | null = null
  let bodyFatMethodLabel = ''
  if (heightCm && neckCm && waistCm && (sex === 'male' || hipCm)) {
    bodyFatValue = calculateBodyFatNavy({
      sex,
      heightCm,
      neckCm,
      waistCm,
      hipCm: hipCm ?? undefined,
    })
    bodyFatMethodLabel = 'Navy circumference formula'
  } else if (bodyFatStored !== null && bodyFatStored !== undefined) {
    bodyFatValue = bodyFatStored
    bodyFatMethodLabel = 'Logged value (BIA / DEXA / manual)'
  }
  if (bodyFatValue !== null) {
    const cat = bodyFatCategory(bodyFatValue, sex)
    metrics.push({
      key: 'body_fat',
      label: 'Body fat',
      value: `${bodyFatValue.toFixed(1)}%`,
      category: cat,
      explanation:
        `Method: ${bodyFatMethodLabel}. Body fat percentage is what BMI ` +
        'cannot see. The American Council on Exercise bands above are for ' +
        'general adult fitness; DEXA remains the clinical gold standard ' +
        'when a precise read matters.',
      source:
        'Hodgdon and Beckett, US Navy Health Research Center Report 84-11 ' +
        '(1984); ACE bands at acefitness.org.',
      bands: sex === 'female'
        ? [
            { label: 'Athletes', min: 14, max: 21, color: '#5DADE6' },
            { label: 'Fitness', min: 21, max: 25, color: '#6ACF89' },
            { label: 'Acceptable', min: 25, max: 32, color: '#E5C952' },
            { label: 'Above', min: 32, max: 50, color: '#D9775C' },
          ]
        : [
            { label: 'Athletes', min: 6, max: 14, color: '#5DADE6' },
            { label: 'Fitness', min: 14, max: 18, color: '#6ACF89' },
            { label: 'Acceptable', min: 18, max: 25, color: '#E5C952' },
            { label: 'Above', min: 25, max: 45, color: '#D9775C' },
          ],
      numericValue: bodyFatValue,
      currentBandLabel: cat,
    })
  }

  // Lean body mass + fat mass
  if (weightKg && bodyFatValue !== null) {
    const lbmKg = calculateLBM(weightKg, bodyFatValue)
    const fatKg = calculateFatMass(weightKg, bodyFatValue)
    metrics.push({
      key: 'lbm',
      label: 'Lean body mass',
      value: `${kgToLb(lbmKg).toFixed(1)} lb`,
      explanation:
        'Lean body mass is everything other than fat: muscle, organs, ' +
        'bone, water, connective tissue. Tracking it over time tells you ' +
        'whether weight changes come from muscle or fat.',
      source:
        'Heymsfield et al., Human Body Composition (2nd ed., 2005). ' +
        'Definitional formula: weight * (1 - bodyFat/100).',
    })
    metrics.push({
      key: 'fat_mass',
      label: 'Fat mass',
      value: `${kgToLb(fatKg).toFixed(1)} lb`,
      explanation:
        'Total fat mass in pounds. Most fat-loss goals are about ' +
        'reducing this number while keeping lean mass steady.',
      source: 'Definitional: weight * (bodyFat / 100).',
    })
  }

  // WHR
  if (waistCm && hipCm) {
    const r = calculateWHR(waistCm, hipCm, sex)
    const riskLabel = r.risk === 'low'
      ? 'Low'
      : r.risk === 'moderate'
        ? 'Moderate'
        : 'High'
    metrics.push({
      key: 'whr',
      label: 'Waist-to-hip ratio',
      value: r.ratio.toFixed(2),
      category: `${riskLabel} cardiometabolic risk`,
      explanation:
        'WHR measures fat distribution, not total body fat. The INTERHEART ' +
        'study (52 countries, 27,000 people) found WHR a stronger heart-' +
        'attack predictor than BMI. WHO cutoff for substantially increased ' +
        `risk: ${sex === 'female' ? '0.85 in women' : '0.90 in men'}.`,
      source:
        'WHO Expert Consultation 2008; Yusuf et al., Lancet 366:1640-9 (2005).',
    })
  }

  // WHtR
  if (waistCm && heightCm) {
    const r = calculateWHtR(waistCm, heightCm)
    const labelMap: Record<typeof r.category, string> = {
      underweight: 'Below typical range',
      healthy: 'Healthy',
      increased_risk: 'Increased risk',
      substantially_increased_risk: 'Substantially increased risk',
    }
    metrics.push({
      key: 'whtr',
      label: 'Waist-to-height ratio',
      value: r.ratio.toFixed(2),
      category: labelMap[r.category],
      explanation:
        'A simple shorthand: keep your waist to less than half your ' +
        'height. WHtR outperforms BMI and waist alone for predicting ' +
        'cardiometabolic risk in the published meta-analyses.',
      source:
        'Ashwell and Hsieh, IJFSN 56(5):303-7 (2005); Browning et al., ' +
        'Nutr Res Rev 23:247-269 (2010).',
      bands: [
        { label: 'Healthy', min: 0.40, max: 0.50, color: '#6ACF89' },
        { label: 'Increased', min: 0.50, max: 0.60, color: '#E5C952' },
        { label: 'High', min: 0.60, max: 0.80, color: '#D9775C' },
      ],
      numericValue: r.ratio,
      currentBandLabel: labelMap[r.category],
    })
  }

  // Visceral fat (logged)
  if (visceralRating !== null && visceralRating !== undefined) {
    metrics.push({
      key: 'visceral',
      label: 'Visceral fat (BIA scale)',
      value: visceralRating.toFixed(0),
      explanation:
        'Most consumer BIA scales use a 1 to 30 visceral-fat rating. ' +
        '1 to 12 typically maps to a healthy range; higher numbers carry ' +
        'metabolic risk. The number is device-specific; trends matter ' +
        'more than absolute values across brands.',
      source:
        'Withings, Tanita, Renpho documentation; clinical gold standard ' +
        'is DEXA volumetric measurement.',
    })
  }

  // Muscle mass
  if (muscleKg) {
    metrics.push({
      key: 'muscle',
      label: 'Muscle mass',
      value: `${kgToLb(muscleKg).toFixed(1)} lb`,
      explanation:
        'Skeletal muscle mass as logged. Most consumer scales estimate ' +
        'this from BIA; DEXA segmental analysis is the clinical standard. ' +
        'Strength gains and muscle gains track together when training is ' +
        'consistent.',
      source: 'User-logged value; varies by measurement device.',
    })
  }

  // BMD T-score
  if (bmdT !== null && bmdT !== undefined) {
    const cat = bmdT <= -2.5
      ? 'Osteoporosis'
      : bmdT < -1.0
        ? 'Osteopenia'
        : 'Normal'
    metrics.push({
      key: 'bmd',
      label: 'BMD T-score (DEXA)',
      value: bmdT.toFixed(1),
      category: cat,
      explanation:
        'Bone mineral density T-score from DEXA. WHO classification: ' +
        'normal at T >= -1.0, osteopenia between -1.0 and -2.5, ' +
        'osteoporosis at T <= -2.5. Track this with your endocrinologist.',
      source: 'WHO Technical Report Series 843 (1994).',
      bands: [
        { label: 'Osteoporosis', min: -4, max: -2.5, color: '#D9775C' },
        { label: 'Osteopenia', min: -2.5, max: -1, color: '#E5C952' },
        { label: 'Normal', min: -1, max: 2.5, color: '#6ACF89' },
      ],
      numericValue: bmdT,
      currentBandLabel: cat,
    })
  }

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="standard"
          title="Body composition"
          leading={
            <Link
              href="/v2/calories"
              aria-label="Back to calories"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-base)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {'‹ Calories'}
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {saved && <Banner intent="success" title="Saved." />}
        {error && (
          <Banner intent="warning" title="Could not save" body={error} />
        )}

        {metrics.length > 0 ? (
          <CompositionMetricsCard metrics={metrics} />
        ) : (
          <EmptyState
            headline="Log your first measurement"
            subtext="Add weight, body fat, waist, hip, or neck. Each one unlocks a derived metric below."
          />
        )}

        <CompositionForm error={error} />
      </div>
    </MobileShell>
  )
}
