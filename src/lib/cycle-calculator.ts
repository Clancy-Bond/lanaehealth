import type { CyclePhase, CycleEntry } from './types'
import { differenceInDays, parseISO } from 'date-fns'

const DEFAULT_CYCLE_LENGTH = 28
const MENSTRUAL_DAYS = 5
const OVULATION_DAY_OFFSET = 14 // days before next period

/**
 * Calculate the current cycle phase based on date and cycle history.
 * Uses historical period start dates to determine cycle length,
 * falls back to 28-day assumption if not enough data.
 */
export function calculateCyclePhase(
  date: string,
  cycleHistory: CycleEntry[]
): CyclePhase | null {
  // Find period start dates (first day of menstruation in each cycle)
  const periodStarts = findPeriodStartDates(cycleHistory)

  if (periodStarts.length === 0) return null

  // Sort descending (most recent first)
  periodStarts.sort((a, b) => b.getTime() - a.getTime())

  const targetDate = parseISO(date)

  // Find the most recent period start before or on the target date
  const lastPeriodStart = periodStarts.find((d) => d <= targetDate)

  if (!lastPeriodStart) return null

  // Calculate average cycle length from history
  const cycleLength = calculateAverageCycleLength(periodStarts)

  // Days since last period started
  const daysSinceStart = differenceInDays(targetDate, lastPeriodStart)

  return getPhaseFromDay(daysSinceStart, cycleLength)
}

/**
 * Find the first day of each menstrual period from cycle entries
 */
function findPeriodStartDates(entries: CycleEntry[]): Date[] {
  // Sort by date ascending
  const sorted = [...entries]
    .filter((e) => e.menstruation)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (sorted.length === 0) return []

  const starts: Date[] = []
  let prevDate: Date | null = null

  for (const entry of sorted) {
    const entryDate = parseISO(entry.date)
    // A new period starts if there is no previous date or there is a gap of 3+ days
    if (!prevDate || differenceInDays(entryDate, prevDate) > 2) {
      starts.push(entryDate)
    }
    prevDate = entryDate
  }

  return starts
}

/**
 * Calculate average cycle length from period start dates
 */
function calculateAverageCycleLength(periodStarts: Date[]): number {
  if (periodStarts.length < 2) return DEFAULT_CYCLE_LENGTH

  // Sort ascending for calculation
  const sorted = [...periodStarts].sort((a, b) => a.getTime() - b.getTime())

  const cycleLengths: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const days = differenceInDays(sorted[i], sorted[i - 1])
    // Only count reasonable cycle lengths (21-45 days)
    if (days >= 21 && days <= 45) {
      cycleLengths.push(days)
    }
  }

  if (cycleLengths.length === 0) return DEFAULT_CYCLE_LENGTH

  const sum = cycleLengths.reduce((a, b) => a + b, 0)
  return Math.round(sum / cycleLengths.length)
}

/**
 * Determine cycle phase from day number within cycle
 */
function getPhaseFromDay(dayInCycle: number, cycleLength: number): CyclePhase {
  // Menstrual phase: days 0-4 (first ~5 days)
  if (dayInCycle < MENSTRUAL_DAYS) {
    return 'menstrual'
  }

  // Ovulation day estimated at cycleLength - 14
  const ovulationDay = Math.max(cycleLength - OVULATION_DAY_OFFSET, MENSTRUAL_DAYS + 1)

  // Follicular phase: from end of menstruation to 2 days before ovulation
  if (dayInCycle < ovulationDay - 2) {
    return 'follicular'
  }

  // Ovulatory phase: ovulation day +/- 2 days
  if (dayInCycle <= ovulationDay + 2) {
    return 'ovulatory'
  }

  // Luteal phase: after ovulation until next period
  return 'luteal'
}

/**
 * Get a human-readable label for a cycle phase
 */
export function getCyclePhaseLabel(phase: CyclePhase | null): string {
  switch (phase) {
    case 'menstrual':
      return 'Menstrual'
    case 'follicular':
      return 'Follicular'
    case 'ovulatory':
      return 'Ovulatory'
    case 'luteal':
      return 'Luteal'
    default:
      return 'Unknown'
  }
}

/**
 * Get a color for a cycle phase (for UI display)
 */
export function getCyclePhaseColor(phase: CyclePhase | null): string {
  switch (phase) {
    case 'menstrual':
      return '#e11d48' // rose-600
    case 'follicular':
      return '#2563eb' // blue-600
    case 'ovulatory':
      return '#16a34a' // green-600
    case 'luteal':
      return '#d97706' // amber-600
    default:
      return '#6b7280' // gray-500
  }
}
