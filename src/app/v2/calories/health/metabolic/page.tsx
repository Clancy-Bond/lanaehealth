/*
 * /v2/calories/health/metabolic (server component)
 *
 * Read-only metabolic surface: pulls structured bloodwork from
 * lab_results (no double-logging) and surfaces fasting glucose,
 * HbA1c, lipid panel, and HOMA-IR (when both insulin and glucose
 * present on the same date). Each metric is tappable for the
 * explainer modal.
 *
 * BMR / TDEE are computed from the personal profile (sex, height,
 * weight, age) per Mifflin-St Jeor and surface here as the daily
 * energy floor.
 */
import Link from 'next/link'
import type { LabResult } from '@/lib/types'
import { getLabResults } from '@/lib/api/labs'
import { Banner, Card, EmptyState } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { loadPersonalProfile, normalizeSex } from '@/lib/calories/personal-profile'
import { loadBodyMetricsLog, latestValue } from '@/lib/calories/body-metrics-log'
import {
  calculateBMR,
  calculateHOMAIR,
  calculateTDEE,
  fastingGlucoseCategory,
  hba1cCategory,
} from '@/lib/calories/body-metrics'
import CompositionMetricsCard, {
  type ComputedMetric,
} from '../composition/_components/CompositionMetricsCard'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Metabolic - LanaeHealth' }

const TEST_NAME_PATTERNS: Record<string, RegExp> = {
  glucose: /^(glucose|fasting glucose|glucose, fasting)/i,
  hba1c: /^(hba1c|a1c|hemoglobin a1c)/i,
  insulin: /^(insulin|fasting insulin)/i,
  hdl: /^hdl/i,
  ldl: /^ldl/i,
  triglycerides: /^triglycerides/i,
  total_chol: /^(total cholesterol|cholesterol total|cholesterol, total)/i,
}

function findLatest(labs: LabResult[], key: keyof typeof TEST_NAME_PATTERNS): LabResult | null {
  const re = TEST_NAME_PATTERNS[key]
  for (const lab of labs) {
    if (re.test(lab.test_name)) return lab
  }
  return null
}

function findOnSameDate(labs: LabResult[], date: string, key: keyof typeof TEST_NAME_PATTERNS): LabResult | null {
  const re = TEST_NAME_PATTERNS[key]
  for (const lab of labs) {
    if (lab.date === date && re.test(lab.test_name)) return lab
  }
  return null
}

function lipidCategory(name: string, value: number): string {
  if (name === 'ldl') {
    if (value < 100) return 'Optimal'
    if (value < 130) return 'Near optimal'
    if (value < 160) return 'Borderline'
    if (value < 190) return 'High'
    return 'Very high'
  }
  if (name === 'hdl') {
    if (value < 40) return 'Low'
    if (value >= 60) return 'Protective'
    return 'Acceptable'
  }
  if (name === 'triglycerides') {
    if (value < 150) return 'Normal'
    if (value < 200) return 'Borderline'
    if (value < 500) return 'High'
    return 'Very high'
  }
  if (name === 'total_chol') {
    if (value < 200) return 'Desirable'
    if (value < 240) return 'Borderline'
    return 'High'
  }
  return ''
}

export default async function V2MetabolicPage() {
  const [labs, profile, log] = await Promise.all([
    getLabResults().catch(() => [] as LabResult[]),
    loadPersonalProfile(),
    loadBodyMetricsLog(),
  ])

  // Sort newest first.
  const sortedLabs = [...labs].sort((a, b) => b.date.localeCompare(a.date))

  const sex = normalizeSex(profile.sex)
  const ageYears = profile.age ?? null
  const heightCm = profile.height_cm ?? null
  const weightKg = latestValue(log, 'weight_kg') ?? profile.weight_kg ?? null

  const metrics: ComputedMetric[] = []

  // BMR + TDEE.
  if (sex && weightKg && heightCm && ageYears !== null) {
    const bmr = calculateBMR({ sex, weightKg, heightCm, ageYears })
    metrics.push({
      key: 'bmr',
      label: 'BMR (Mifflin-St Jeor)',
      value: `${bmr} kcal/day`,
      explanation:
        'Basal metabolic rate: the calories your body burns at full rest ' +
        'maintaining basic functions like breathing and circulation. ' +
        'Mifflin-St Jeor is the most accurate predictive equation for ' +
        'healthy adults per the 2005 systematic review.',
      source:
        'Mifflin et al., AJCN 51:241-7 (1990); Frankenfield et al., JADA ' +
        '105:775-89 (2005).',
    })
    const tdeeSedentary = calculateTDEE(bmr, 'sedentary')
    const tdeeActive = calculateTDEE(bmr, 'moderately_active')
    metrics.push({
      key: 'tdee',
      label: 'TDEE (sedentary to moderately active)',
      value: `${tdeeSedentary} to ${tdeeActive} kcal/day`,
      explanation:
        'Total daily energy expenditure scales BMR by an activity factor: ' +
        '1.2 for sedentary days, 1.55 for moderately active days. The ' +
        'range here brackets a typical day for someone managing chronic ' +
        'fatigue.',
      source:
        'Harris-Benedict (1919) factors applied to Mifflin-St Jeor BMR; ' +
        'McArdle, Katch, Katch, Exercise Physiology 8th ed (2014).',
    })
  }

  // Fasting glucose.
  const glucose = findLatest(sortedLabs, 'glucose')
  if (glucose && glucose.value !== null) {
    const cat = fastingGlucoseCategory(glucose.value)
    const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1)
    metrics.push({
      key: 'glucose',
      label: 'Fasting glucose',
      value: `${glucose.value} ${glucose.unit ?? 'mg/dL'} (${glucose.date})`,
      category: catLabel,
      explanation:
        'ADA 2024 reference: < 100 normal, 100 to 125 prediabetes, ' +
        '>= 126 diabetes (confirmed on two tests). Affected by stress, ' +
        'recent food, sleep deprivation.',
      source:
        'American Diabetes Association, Standards of Medical Care 2024, ' +
        'Diabetes Care 47(S1):S20-S42.',
      bands: [
        { label: 'Normal', min: 60, max: 100, color: '#6ACF89' },
        { label: 'Pre', min: 100, max: 126, color: '#E5C952' },
        { label: 'Diabetes', min: 126, max: 250, color: '#D9775C' },
      ],
      numericValue: glucose.value,
      currentBandLabel: catLabel,
    })
  }

  // HbA1c.
  const hba1c = findLatest(sortedLabs, 'hba1c')
  if (hba1c && hba1c.value !== null) {
    const cat = hba1cCategory(hba1c.value)
    const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1)
    metrics.push({
      key: 'hba1c',
      label: 'HbA1c',
      value: `${hba1c.value}% (${hba1c.date})`,
      category: catLabel,
      explanation:
        'Average blood sugar over roughly 3 months. ADA reference: ' +
        '< 5.7 normal, 5.7 to 6.4 prediabetes, >= 6.5 diabetes. ' +
        'Less reactive than spot glucose; better for trend.',
      source: 'ADA Standards of Medical Care 2024.',
      bands: [
        { label: 'Normal', min: 4, max: 5.7, color: '#6ACF89' },
        { label: 'Pre', min: 5.7, max: 6.5, color: '#E5C952' },
        { label: 'Diabetes', min: 6.5, max: 12, color: '#D9775C' },
      ],
      numericValue: hba1c.value,
      currentBandLabel: catLabel,
    })
  }

  // HOMA-IR (requires insulin + glucose on the same date).
  if (glucose && glucose.value !== null) {
    const insulin = findOnSameDate(sortedLabs, glucose.date, 'insulin')
    if (insulin && insulin.value !== null) {
      const r = calculateHOMAIR(insulin.value, glucose.value)
      const catMap: Record<typeof r.category, string> = {
        sensitive: 'Insulin sensitive',
        early_resistance: 'Early resistance',
        significant_resistance: 'Significant resistance',
        severe_resistance: 'Severe resistance',
      }
      metrics.push({
        key: 'homa_ir',
        label: 'HOMA-IR',
        value: r.value.toFixed(2),
        category: catMap[r.category],
        explanation:
          'Insulin resistance index from fasting insulin and glucose. ' +
          '< 1 sensitive, 1 to 1.9 early resistance, 2 to 2.9 significant, ' +
          '>= 3 severe. Computed from labs on ' + glucose.date + '.',
        source: 'Matthews et al., Diabetologia 28:412-9 (1985).',
        bands: [
          { label: 'Sensitive', min: 0, max: 1, color: '#6ACF89' },
          { label: 'Early', min: 1, max: 2, color: '#E5C952' },
          { label: 'Sig.', min: 2, max: 3, color: '#F0955A' },
          { label: 'Severe', min: 3, max: 8, color: '#D9775C' },
        ],
        numericValue: r.value,
        currentBandLabel: catMap[r.category],
      })
    }
  }

  // Lipid panel.
  for (const key of ['total_chol', 'ldl', 'hdl', 'triglycerides'] as const) {
    const lab = findLatest(sortedLabs, key)
    if (!lab || lab.value === null) continue
    const cat = lipidCategory(key, lab.value)
    const labelMap: Record<typeof key, string> = {
      total_chol: 'Total cholesterol',
      ldl: 'LDL',
      hdl: 'HDL',
      triglycerides: 'Triglycerides',
    }
    metrics.push({
      key,
      label: labelMap[key],
      value: `${lab.value} ${lab.unit ?? 'mg/dL'} (${lab.date})`,
      category: cat,
      explanation:
        '2018 AHA/ACC cholesterol guideline reference ranges. Lipid ' +
        'targets are individualized; talk with your doctor about your ' +
        'personal risk-stratified targets.',
      source:
        'Grundy et al., JACC 73(24):e285-e350 (2019). 2018 AHA/ACC/AACVPR ' +
        '/AAPA/ABC/ACPM/ADA/AGS/APhA/ASPC/NLA/PCNA cholesterol guideline.',
    })
  }

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="standard"
          title="Metabolic"
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
        <Banner
          intent="info"
          title="Lab-derived"
          body="Numbers below come from your bloodwork. Talk with your doctor about what they mean for you."
        />

        {metrics.length > 0 ? (
          <CompositionMetricsCard metrics={metrics} />
        ) : (
          <Card padding="md">
            <EmptyState
              headline="No labs yet"
              subtext="Upload bloodwork via the labs page to see metabolic metrics here."
            />
          </Card>
        )}
      </div>
    </MobileShell>
  )
}
