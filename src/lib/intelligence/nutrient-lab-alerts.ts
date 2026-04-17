/**
 * Nutrient x Lab Cross-Reference Alerts
 *
 * Joins three streams:
 *   1. Most recent lab_results per test (value and flag)
 *   2. Resolved nutrient targets (RDA, preset, or user override)
 *   3. Intake rollup from food_entries over the trailing window
 *
 * Produces a list of actionable suggestions. No diagnostic language.
 *
 * Voice rule (per docs/plans/2026-04-17-wave-2b-briefs.md):
 *   "Your iron intake averages 12 mg/day (target 27 mg). Consider lean
 *    red meat, lentils, or talk to your doctor about supplementation."
 *   NOT "YOU HAVE LOW IRON".
 *
 * Inputs are plain objects, not DB rows. This keeps the module pure
 * and trivially testable. Composition with the live database lives
 * in `/api/nutrient-lab-alerts/route.ts` (out of scope here but a
 * future mount point).
 */

import type { LabFlag } from '@/lib/types'
import type {
  NutrientLabMapping,
  LabDirection,
} from '@/lib/nutrition/nutrient-lab-map'
import {
  NUTRIENT_LAB_MAPPINGS,
  findMappingsForTestName,
} from '@/lib/nutrition/nutrient-lab-map'
import type { ResolvedTarget } from '@/lib/nutrition/target-resolver'

/**
 * A minimal lab shape. Matches `LabResult` structurally so the real
 * type can be passed directly without a translation layer, but also
 * accepts lightly stubbed data in tests.
 */
export interface AlertLabInput {
  test_name: string
  value: number | null
  unit: string | null
  reference_range_low: number | null
  reference_range_high: number | null
  flag: LabFlag | null
  /** ISO date of the lab draw. Used only for display, not comparison. */
  date: string
}

/**
 * Average daily intake of a nutrient over the trailing window, in the
 * same unit as the matching target (usually mg, mcg, g, IU).
 */
export interface NutrientIntakeAverage {
  nutrient: string
  averagePerDay: number
  unit: string
  daysCovered: number
}

export interface NutrientLabAlert {
  /** Mapping id copied through so UIs can key alerts deterministically. */
  id: string
  /** Severity rank for sorting. 'critical' surfaces first. */
  severity: 'info' | 'watch' | 'action'
  /** Human summary shown as the alert title. */
  title: string
  /** Plain language paragraph with numeric context and suggestion. */
  body: string
  /** Suggested foods (Cronometer-style). Short display phrases. */
  suggestedFoods: string[]
  /** Direction the lab moved. */
  direction: LabDirection
  /** Lab display name surfaced in the title. */
  labDisplayName: string
  /** Trailing-window average intake for the lead nutrient, if known. */
  intake: NutrientIntakeAverage | null
  /** Resolved target for the lead nutrient, if known. */
  target: ResolvedTarget | null
  /** Citation string from the mapping, shown as fine print. */
  citation: string
  /** Machine fields for test assertions. */
  labValue: number | null
  labUnit: string | null
  labDate: string
}

/**
 * Primary entry point. Given the three streams, return a de-duplicated
 * list of alerts sorted by severity.
 */
export function generateAlerts(
  labs: AlertLabInput[],
  targets: ResolvedTarget[],
  intake: NutrientIntakeAverage[],
): NutrientLabAlert[] {
  const targetsByKey = new Map(targets.map((t) => [t.nutrient, t]))
  const intakeByKey = new Map(intake.map((i) => [i.nutrient, i]))

  // For each lab test the patient has, pick the most recent row and
  // walk the mapping table looking for matches.
  const latestByTestName = pickLatestPerTest(labs)

  const out: NutrientLabAlert[] = []
  for (const lab of latestByTestName.values()) {
    const mappings = findMappingsForTestName(lab.test_name)
    for (const mapping of mappings) {
      if (!labMatchesDirection(lab, mapping)) continue
      const alert = buildAlert(lab, mapping, targetsByKey, intakeByKey)
      if (alert) out.push(alert)
    }
  }

  out.sort(sortBySeverity)
  return out
}

// ── Direction matching ────────────────────────────────────────────────

/**
 * Determine whether a lab row matches a mapping's direction, respecting
 * optional borderline thresholds. The canonical `flag` column already
 * encodes `low`/`high` for most labs; we use it first, then fall back
 * to numeric comparison against the reference range, then to borderline
 * thresholds for the subclinical cases like TSH 5.1.
 */
export function labMatchesDirection(
  lab: AlertLabInput,
  mapping: NutrientLabMapping,
): boolean {
  if (mapping.direction === 'below_range') {
    if (lab.flag === 'low') return true
    if (
      lab.value !== null &&
      lab.reference_range_low !== null &&
      lab.value < lab.reference_range_low
    )
      return true
    return false
  }

  if (mapping.direction === 'above_range') {
    if (lab.flag === 'high' || lab.flag === 'critical') return true
    if (
      lab.value !== null &&
      lab.reference_range_high !== null &&
      lab.value > lab.reference_range_high
    )
      return true
    return false
  }

  if (mapping.direction === 'borderline_high') {
    if (lab.value === null) return false
    const thr = mapping.borderlineThreshold
    if (thr && thr.comparator === 'gt') return lab.value > thr.value
    if (
      lab.reference_range_high !== null &&
      lab.value > lab.reference_range_high * 0.85
    )
      return true
    return false
  }

  if (mapping.direction === 'borderline_low') {
    if (lab.value === null) return false
    const thr = mapping.borderlineThreshold
    if (thr && thr.comparator === 'lt') return lab.value < thr.value
    if (
      lab.reference_range_low !== null &&
      lab.value < lab.reference_range_low * 1.15
    )
      return true
    return false
  }

  return false
}

// ── Alert construction ───────────────────────────────────────────────

function buildAlert(
  lab: AlertLabInput,
  mapping: NutrientLabMapping,
  targetsByKey: Map<string, ResolvedTarget>,
  intakeByKey: Map<string, NutrientIntakeAverage>,
): NutrientLabAlert | null {
  const leadNutrient = mapping.nutrients[0]
  if (!leadNutrient) return null
  const target = targetsByKey.get(leadNutrient) ?? null
  const intake = intakeByKey.get(leadNutrient) ?? null

  const title = buildTitle(lab, mapping)
  const body = buildBody(lab, mapping, target, intake)
  const suggestedFoods = getSuggestedFoods(leadNutrient)
  const severity = computeSeverity(lab, mapping, target, intake)

  return {
    id: mapping.id,
    severity,
    title,
    body,
    suggestedFoods,
    direction: mapping.direction,
    labDisplayName: mapping.labDisplayName,
    intake,
    target,
    citation: mapping.citation,
    labValue: lab.value,
    labUnit: lab.unit,
    labDate: lab.date,
  }
}

/**
 * Short, non-diagnostic title. Readers should see the lab name plus a
 * neutral qualifier, never a diagnosis.
 */
function buildTitle(lab: AlertLabInput, mapping: NutrientLabMapping): string {
  const directionPhrase =
    mapping.direction === 'below_range'
      ? 'below reference'
      : mapping.direction === 'above_range'
      ? 'above reference'
      : mapping.direction === 'borderline_high'
      ? 'at the upper end'
      : 'at the lower end'
  return `${mapping.labDisplayName} ${directionPhrase}`
}

/**
 * Body copy. Pulls in real numbers so the reader can calibrate.
 *
 * Script:
 *   1. Lab value and date (for context)
 *   2. Intake average vs target
 *   3. Non-diagnostic suggestion + clinician line
 */
function buildBody(
  lab: AlertLabInput,
  mapping: NutrientLabMapping,
  target: ResolvedTarget | null,
  intake: NutrientIntakeAverage | null,
): string {
  const labLine = formatLabLine(lab)
  const intakeLine = formatIntakeLine(mapping, target, intake)
  const actionLine = formatActionLine(mapping, intake, target)
  return [labLine, intakeLine, actionLine, mapping.advisory]
    .filter(Boolean)
    .join(' ')
}

function formatLabLine(lab: AlertLabInput): string {
  if (lab.value === null) return ''
  const unitStr = lab.unit ? ` ${lab.unit}` : ''
  return `Latest result from ${lab.date}: ${lab.value}${unitStr}.`
}

function formatIntakeLine(
  mapping: NutrientLabMapping,
  target: ResolvedTarget | null,
  intake: NutrientIntakeAverage | null,
): string {
  if (!intake || !target) return ''
  const formattedIntake = `${round(intake.averagePerDay, 1)} ${intake.unit}/day`
  const formattedTarget = `${round(target.amount, 1)} ${target.unit}`
  return `Your ${mapping.nutrients[0].replace(/_/g, ' ')} intake averages ${formattedIntake} (target ${formattedTarget}).`
}

function formatActionLine(
  mapping: NutrientLabMapping,
  intake: NutrientIntakeAverage | null,
  target: ResolvedTarget | null,
): string {
  const foods = getSuggestedFoods(mapping.nutrients[0])
  const foodsClause = foods.length ? `Consider ${foods.slice(0, 3).join(', ')}, ` : ''
  const supplementClause =
    intake && target && intake.averagePerDay < target.amount * 0.75
      ? 'or talk to your doctor about supplementation. '
      : 'or talk to your doctor at your next visit. '
  return `${foodsClause}${supplementClause}`
}

// ── Severity ──────────────────────────────────────────────────────────

function computeSeverity(
  lab: AlertLabInput,
  mapping: NutrientLabMapping,
  target: ResolvedTarget | null,
  intake: NutrientIntakeAverage | null,
): NutrientLabAlert['severity'] {
  // `critical` flag is rare but meaningful when present.
  if (lab.flag === 'critical') return 'action'

  const isFormallyOut =
    mapping.direction === 'below_range' || mapping.direction === 'above_range'

  if (isFormallyOut) {
    // Formally-out labs upgrade to action when intake is clearly
    // below target. Otherwise they stay at watch.
    if (intake && target && intake.averagePerDay < target.amount * 0.75) {
      return 'action'
    }
    return 'watch'
  }

  // borderline_* cases: informational unless intake gap is severe.
  if (intake && target && intake.averagePerDay < target.amount * 0.5) {
    return 'watch'
  }
  return 'info'
}

const SEVERITY_RANK: Record<NutrientLabAlert['severity'], number> = {
  action: 0,
  watch: 1,
  info: 2,
}

function sortBySeverity(a: NutrientLabAlert, b: NutrientLabAlert): number {
  const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  if (rankDiff !== 0) return rankDiff
  return a.id.localeCompare(b.id)
}

// ── Suggested foods ──────────────────────────────────────────────────

/**
 * Short allowlist of Lanae-friendly food suggestions per nutrient. These
 * are explicitly generic (no brand names, no exhaustive lists). The
 * goal is to jog memory for familiar foods, not to prescribe a diet.
 */
const SUGGESTED_FOODS_BY_NUTRIENT: Record<string, string[]> = {
  iron: ['lean red meat', 'lentils', 'spinach', 'pumpkin seeds'],
  vitamin_c: ['bell peppers', 'strawberries', 'citrus'],
  vitamin_d: ['fatty fish (salmon, sardines)', 'fortified dairy alternatives'],
  vitamin_b12: ['eggs', 'sardines', 'fortified cereals'],
  folate: ['leafy greens', 'lentils', 'avocado'],
  fiber: ['oats', 'beans', 'berries', 'flaxseed'],
  omega_3: ['salmon', 'sardines', 'chia seeds', 'walnuts'],
  selenium: ['Brazil nuts (1 to 2 per day)', 'sardines', 'eggs'],
  iodine: ['seaweed (sparingly)', 'iodized salt', 'dairy or fortified dairy alternative'],
  magnesium: ['pumpkin seeds', 'dark leafy greens', 'black beans'],
}

function getSuggestedFoods(nutrient: string): string[] {
  return SUGGESTED_FOODS_BY_NUTRIENT[nutrient] ?? []
}

// ── Helpers ──────────────────────────────────────────────────────────

function pickLatestPerTest(labs: AlertLabInput[]): Map<string, AlertLabInput> {
  const out = new Map<string, AlertLabInput>()
  for (const lab of labs) {
    const key = normalize(lab.test_name)
    const prior = out.get(key)
    if (!prior || lab.date > prior.date) out.set(key, lab)
  }
  return out
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function round(n: number, digits: number): number {
  const pow = Math.pow(10, digits)
  return Math.round(n * pow) / pow
}

/**
 * Public helper so UI can render a full list of recognized labs for
 * diagnostic debugging ("we know about X mappings, Y matched your
 * labs"). Not used by generateAlerts directly.
 */
export function getMappingCatalogSize(): number {
  return NUTRIENT_LAB_MAPPINGS.length
}
