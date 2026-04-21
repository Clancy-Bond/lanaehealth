import { useMemo } from 'react'
import type { LabResult } from '@/lib/types'

export interface LabTrendPoint {
  date: string
  dateLabel: string
  value: number
  flag: string | null
}

export interface LabTrendGroup {
  testName: string
  unit: string | null
  refLow: number | null
  refHigh: number | null
  points: LabTrendPoint[]
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

const PRIORITY_TESTS = ['ferritin', 'hs-crp', 'crp', 'hemoglobin', 'iron']

function groupLabsByTest(labs: LabResult[]): LabTrendGroup[] {
  const groups = new Map<string, LabResult[]>()
  for (const lab of labs) {
    const key = lab.test_name
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(lab)
  }
  const result: LabTrendGroup[] = []
  for (const [testName, entries] of groups) {
    if (entries.length < 2) continue
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const first = entries[0]
    result.push({
      testName,
      unit: first.unit,
      refLow: first.reference_range_low,
      refHigh: first.reference_range_high,
      points: entries
        .filter((e) => e.value !== null)
        .map((e) => ({
          date: e.date,
          dateLabel: formatDate(e.date),
          value: e.value!,
          flag: e.flag,
        })),
    })
  }
  return result
}

function prioritizeTests(groups: LabTrendGroup[]): LabTrendGroup[] {
  return groups.sort((a, b) => {
    const aP = PRIORITY_TESTS.findIndex((t) => a.testName.toLowerCase().includes(t))
    const bP = PRIORITY_TESTS.findIndex((t) => b.testName.toLowerCase().includes(t))
    if (aP !== -1 && bP !== -1) return aP - bP
    if (aP !== -1) return -1
    if (bP !== -1) return 1
    return b.points.length - a.points.length
  })
}

/*
 * useLabGrouping
 *
 * Groups repeat lab results by test name and picks the top
 * `max` tests to chart. A test needs ≥2 data points to qualify
 * (single values get their own single-point card which we skip
 * here). Priority tests (ferritin, hs-CRP, etc.) always win
 * regardless of data-point count.
 */
export function useLabGrouping(labs: LabResult[], max = 6): LabTrendGroup[] {
  return useMemo(() => prioritizeTests(groupLabsByTest(labs)).slice(0, max), [labs, max])
}
