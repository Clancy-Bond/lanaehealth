/**
 * Multi-signal cycle intelligence engine.
 *
 * Reimplements the Natural Cycles published algorithm (cover line +
 * biphasic shift + six-day fertile window + individualized uncertainty
 * per Scherwitzl 2015/2017 and FDA DEN170052) extended with Oura HRV/RHR
 * corroborating signals.
 *
 * This file is pure data in / data out. It does NOT fetch from Supabase.
 * Callers upstream load nc_imported, oura_daily, and cycle_entries rows
 * and pass them in. That keeps the engine testable and easy to reason
 * about.
 *
 * Why not modify cycle-calculator.ts or anovulatory-detection.ts?
 *   - cycle-calculator.ts has a `@deprecated` banner directing callers to
 *     `getCurrentCycleDay`. Leaving it alone preserves the legacy
 *     historical-phase lookup path already used by
 *     doctor/cycle-phase-correlation.ts.
 *   - anovulatory-detection.ts shipped in Wave 1D and other modules
 *     depend on it. We IMPORT and REUSE its primitives
 *     (detectBiphasicShift, detectLhSurge, buildCyclesFromNc) so the
 *     engine stays consistent with the rest of the app.
 *
 * References cited inline below:
 *   Scherwitzl E et al. 2015. PubMed 25592280.
 *     DOI 10.3109/13625187.2014.988210
 *   Scherwitzl E et al. 2017. PMC5669828.
 *     DOI 10.1016/j.contraception.2017.08.014
 *   FDA De Novo DEN170052, August 2018.
 *   Goodale BM et al. 2019. DOI 10.2196/13404.
 *   Shilaih M et al. 2017. DOI 10.1038/s41598-017-01433-9.
 */

import type { NcImported, OuraDaily } from '@/lib/types'
import {
  buildCyclesFromNc,
  detectLhSurge,
  evaluateCycleAnovulatory,
  type AnovulatoryEvaluation,
  type CycleWindow,
} from '@/lib/intelligence/anovulatory-detection'
import {
  computeCoverLine,
  detectBiphasicShift,
  type CoverLineResult,
  type BiphasicShiftResult,
  type TempReading,
} from './cover-line'
import {
  computeFertileWindow,
  computeLutealLength,
  predictPeriodStart,
  SHORT_LUTEAL_THRESHOLD_DAYS,
  DEFAULT_LUTEAL_LENGTH_DAYS,
  type CycleHistoryStats,
  type FertileWindow,
  type PeriodPrediction,
} from './fertile-window'
import {
  fuseSignals,
  type SignalContribution,
  type SignalFusionResult,
  type SignalKey,
} from './signal-fusion'

export interface ExcludedReading {
  date: string // YYYY-MM-DD
  reason: string
}

export interface EnginePrediction {
  cycleStart: string
  cycleEnd: string | null
  cycleNumber: number | null
  coverLine: CoverLineResult | null
  shift: BiphasicShiftResult
  predictedOvulationDate: string | null
  confirmedOvulationDate: string | null
  lhSurgeDate: string | null
  fertileWindow: FertileWindow | null
  periodPrediction: PeriodPrediction | null
  lutealLengthDays: number | null
  shortLutealFlag: boolean
  anovulatory: AnovulatoryEvaluation
  multiSignal: SignalFusionResult
  signalsUsed: SignalKey[]
  signalBreakdown: SignalContribution[]
  excludedData: ExcludedReading[]
  confidence: number
  computedAt: string
  engineVersion: string
}

export interface EngineSummary {
  patientId: string
  totalCycles: number
  confirmedOvulatoryCycles: number
  likelyAnovulatoryCycles: number
  insufficientDataCycles: number
  averageCycleLength: number
  sdCycleLength: number
  averageLutealLength: number
  sdLutealLength: number
  shortLutealCycles: number
  predictions: EnginePrediction[]
  computedAt: string
}

export interface EngineInput {
  patientId?: string
  ncRows: NcImported[]
  ouraRows: OuraDaily[]
  /** Optional daily logs keyed by date for auto-exclusion. */
  excludedDates?: Map<string, string>
  /** Active hormonal birth control flag, per-cycle. */
  hormonalBirthControl?: boolean
  engineVersion?: string
  now?: Date
}

export const ENGINE_VERSION = 'cycle-engine-v1'

/**
 * Run the full pipeline: build cycles from NC data, compute per-cycle
 * cover line + shift + fertile window + period prediction, fuse multi
 * signals, and return summary statistics suitable for caching into
 * cycle_engine_state.
 */
export function runCycleEngine(input: EngineInput): EngineSummary {
  const patientId = input.patientId ?? 'lanae'
  const engineVersion = input.engineVersion ?? ENGINE_VERSION
  const now = input.now ?? new Date()

  // Build cycle boundaries using the Wave 1D primitive. Reusing this keeps
  // the engine's notion of a cycle consistent with the anovulatory detector.
  const cycles = buildCyclesFromNc(input.ncRows)

  const ouraByDate = indexOuraByDate(input.ouraRows)

  // First pass: compute per-cycle primitives so we can derive stats.
  const firstPass: EnginePrediction[] = cycles.map((cycle) =>
    predictSingleCycle({
      cycle,
      ncRows: input.ncRows,
      ouraByDate,
      excludedDates: input.excludedDates ?? new Map(),
      hormonalBirthControl: !!input.hormonalBirthControl,
      history: bootstrapHistoryStats(),
      engineVersion,
      now,
    })
  )

  // Derive history stats from the first-pass results.
  const history = computeHistoryStats(firstPass)

  // Second pass: redo period predictions with the refined history so
  // per-cycle uncertainty reflects THIS user's variance, not the bootstrap.
  const predictions: EnginePrediction[] = cycles.map((cycle, i) =>
    refinePrediction(firstPass[i], cycle, history)
  )

  return {
    patientId,
    totalCycles: predictions.length,
    confirmedOvulatoryCycles: predictions.filter((p) => p.confirmedOvulationDate !== null)
      .length,
    likelyAnovulatoryCycles: predictions.filter((p) => p.anovulatory.status === 'likely_anovulatory')
      .length,
    insufficientDataCycles: predictions.filter((p) => p.anovulatory.status === 'insufficient_data')
      .length,
    averageCycleLength: history.meanCycleLength,
    sdCycleLength: history.sdCycleLength,
    averageLutealLength: history.meanLutealLength,
    sdLutealLength: history.sdLutealLength,
    shortLutealCycles: predictions.filter((p) => p.shortLutealFlag).length,
    predictions,
    computedAt: now.toISOString(),
  }
}

// ── single-cycle pipeline ────────────────────────────────────────────

interface SingleCycleContext {
  cycle: CycleWindow
  ncRows: NcImported[]
  ouraByDate: Map<string, OuraDaily>
  excludedDates: Map<string, string>
  hormonalBirthControl: boolean
  history: CycleHistoryStats
  engineVersion: string
  now: Date
}

function predictSingleCycle(ctx: SingleCycleContext): EnginePrediction {
  const cycle = ctx.cycle

  // Compose the temp series for the cover-line calculator. Manual BBT
  // from cycle_entries isn't wired here yet (Wave 1 only has nc_imported
  // + oura_daily as temperature sources); we use nc_imported.temperature
  // as the primary and fall back to Oura body_temp_deviation when the
  // NC row is missing a reading. The +36.5 C anchor converts Oura's
  // relative deviation into an absolute-ish value for the cover line.
  // This transform is empirical and documented in cover-line.ts comments.
  const excluded: ExcludedReading[] = []
  const readings: TempReading[] = cycle.days.map((d) => {
    const oura = ctx.ouraByDate.get(d.date)
    let temperature: number | null = d.temperature
    if (temperature === null && oura && oura.body_temp_deviation !== null) {
      temperature = 36.5 + oura.body_temp_deviation
    }
    const exclusionReason = ctx.excludedDates.get(d.date)
    if (exclusionReason) {
      excluded.push({ date: d.date, reason: exclusionReason })
    }
    return {
      date: d.date,
      temperature,
      excluded: !!exclusionReason,
      excludedReason: exclusionReason,
    }
  })

  const coverLine = computeCoverLine(readings)
  const shift: BiphasicShiftResult = coverLine
    ? detectBiphasicShift(readings, coverLine)
    : {
        confirmed: false,
        firstElevatedDate: null,
        estimatedOvulationDate: null,
        elevatedRun: 0,
        triggeringReads: [],
      }

  const lhSurgeDate = findLhSurgeDate(cycle)

  // Multi-signal fusion: compute HRV + RHR cycle halves.
  const windows = splitCycleHalves(cycle, ctx.ouraByDate)
  const fusion = fuseSignals({
    bbtShiftConfirmed: shift.confirmed,
    lhSurgeDetected: lhSurgeDate !== null,
    lutealHrvMean: windows.lutealHrvMean,
    follicularHrvMean: windows.follicularHrvMean,
    lutealRhrMean: windows.lutealRhrMean,
    follicularRhrMean: windows.follicularRhrMean,
  })

  // Reuse the Wave 1D anovulatory detector for consistency with the rest
  // of the app. We do not rewrite it here.
  const anovulatory: AnovulatoryEvaluation = evaluateCycleAnovulatory({
    ...cycle,
    hormonalBirthControl: ctx.hormonalBirthControl,
  })

  const predictedOvulationDate = shift.estimatedOvulationDate ?? lhSurgeDate
  const confirmedOvulationDate = shift.confirmed ? shift.estimatedOvulationDate : null
  const fertileWindow =
    predictedOvulationDate !== null ? computeFertileWindow(predictedOvulationDate) : null

  const periodPrediction = predictPeriodStart(
    cycle.cycleStart,
    predictedOvulationDate,
    ctx.history
  )

  const lutealLengthDays = computeLutealLength(confirmedOvulationDate, cycle.cycleEnd)
  const shortLutealFlag =
    lutealLengthDays !== null && lutealLengthDays < SHORT_LUTEAL_THRESHOLD_DAYS

  return {
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    cycleNumber: findCycleNumber(ctx.ncRows, cycle.cycleStart),
    coverLine,
    shift,
    predictedOvulationDate,
    confirmedOvulationDate,
    lhSurgeDate,
    fertileWindow,
    periodPrediction,
    lutealLengthDays,
    shortLutealFlag,
    anovulatory,
    multiSignal: fusion,
    signalsUsed: fusion.signalsUsed,
    signalBreakdown: fusion.breakdown,
    excludedData: excluded,
    confidence: fusion.confidence,
    computedAt: ctx.now.toISOString(),
    engineVersion: ctx.engineVersion,
  }
}

function refinePrediction(
  first: EnginePrediction,
  cycle: CycleWindow,
  history: CycleHistoryStats
): EnginePrediction {
  const refined = predictPeriodStart(
    cycle.cycleStart,
    first.predictedOvulationDate,
    history
  )
  return { ...first, periodPrediction: refined }
}

// ── aggregation ──────────────────────────────────────────────────────

function bootstrapHistoryStats(): CycleHistoryStats {
  // Bootstrap uses classic clinical defaults so the FIRST pass can still
  // emit a prediction while we compute this user's actual stats.
  return {
    meanCycleLength: 28,
    sdCycleLength: 4,
    meanLutealLength: DEFAULT_LUTEAL_LENGTH_DAYS,
    sdLutealLength: 2,
    confirmedOvulatoryCycles: 0,
  }
}

function computeHistoryStats(predictions: EnginePrediction[]): CycleHistoryStats {
  const closed = predictions.filter((p) => p.cycleEnd !== null)
  const cycleLengths = closed
    .map((p) => daysBetween(p.cycleStart, p.cycleEnd as string) + 1)
    .filter((n) => n > 0 && n < 90)

  const lutealLengths = predictions
    .map((p) => p.lutealLengthDays)
    .filter((n): n is number => n !== null && n > 0 && n < 30)

  return {
    meanCycleLength: mean(cycleLengths, 28),
    sdCycleLength: stddev(cycleLengths, 4),
    meanLutealLength: mean(lutealLengths, DEFAULT_LUTEAL_LENGTH_DAYS),
    sdLutealLength: stddev(lutealLengths, 2),
    confirmedOvulatoryCycles: predictions.filter((p) => p.confirmedOvulationDate !== null)
      .length,
  }
}

function mean(values: number[], fallback: number): number {
  if (values.length === 0) return fallback
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round((sum / values.length) * 100) / 100
}

function stddev(values: number[], fallback: number): number {
  if (values.length < 2) return fallback
  const m = mean(values, 0)
  const variance =
    values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / values.length
  return Math.round(Math.sqrt(variance) * 100) / 100
}

// ── helpers ──────────────────────────────────────────────────────────

function indexOuraByDate(rows: readonly OuraDaily[]): Map<string, OuraDaily> {
  const map = new Map<string, OuraDaily>()
  for (const row of rows) map.set(row.date, row)
  return map
}

function findLhSurgeDate(cycle: CycleWindow): string | null {
  for (const d of cycle.days) {
    if (detectLhSurge([d.lh_test])) return d.date
  }
  return null
}

function findCycleNumber(rows: NcImported[], cycleStart: string): number | null {
  const row = rows.find((r) => r.date === cycleStart)
  return row?.cycle_number ?? null
}

interface CycleHalves {
  follicularHrvMean: number | null
  follicularRhrMean: number | null
  lutealHrvMean: number | null
  lutealRhrMean: number | null
}

/**
 * Split the cycle into follicular (days 1 through 13) and luteal
 * (days 14 through end) halves and compute mean HRV + RHR for each
 * half from Oura rows. 13 is the classic cycle midpoint per Marshall.
 */
function splitCycleHalves(
  cycle: CycleWindow,
  ouraByDate: Map<string, OuraDaily>
): CycleHalves {
  const follicularHrv: number[] = []
  const follicularRhr: number[] = []
  const lutealHrv: number[] = []
  const lutealRhr: number[] = []

  for (let i = 0; i < cycle.days.length; i++) {
    const day = cycle.days[i]
    const oura = ouraByDate.get(day.date)
    if (!oura) continue
    const hrv = oura.hrv_avg
    const rhr = oura.resting_hr
    if (i < 13) {
      if (hrv !== null) follicularHrv.push(hrv)
      if (rhr !== null) follicularRhr.push(rhr)
    } else {
      if (hrv !== null) lutealHrv.push(hrv)
      if (rhr !== null) lutealRhr.push(rhr)
    }
  }

  return {
    follicularHrvMean: follicularHrv.length ? average(follicularHrv) : null,
    follicularRhrMean: follicularRhr.length ? average(follicularRhr) : null,
    lutealHrvMean: lutealHrv.length ? average(lutealHrv) : null,
    lutealRhrMean: lutealRhr.length ? average(lutealRhr) : null,
  }
}

function average(values: number[]): number {
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round((sum / values.length) * 100) / 100
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00Z`).getTime()
  const b = new Date(`${bIso}T00:00:00Z`).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}
