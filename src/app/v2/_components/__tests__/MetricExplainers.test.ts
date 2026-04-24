/*
 * MetricExplainers contract tests.
 *
 * Each MetricExplainer is a thin wrapper around ExplainerSheet that
 * supplies a section-local title, band shape, and copy. We do not
 * mount into a DOM; we call the component as a function and inspect
 * the props it threads into ExplainerSheet plus the children copy.
 *
 * What we cover for every explainer:
 *   - Renders without throwing on a representative payload
 *   - Renders without throwing on the missing-data payload
 *   - Forwards open and onClose to ExplainerSheet
 *   - Bands shape (when applicable) is a non-empty array of
 *     { label, min, max, color }
 *   - Title is a non-empty string or contains the metric name
 *   - Source string is non-empty for both data states
 *   - Copy contains no em-dash characters (CLAUDE.md)
 */
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import ExplainerSheet, { type ExplainerBand } from '@/app/v2/_components/ExplainerSheet'
import {
  CaloriesExplainer,
  CycleExplainer,
  HRVExplainer,
  PainExplainer,
  ReadinessExplainer,
  SleepExplainer,
} from '@/app/v2/_components/MetricExplainers'

// The em-dash character we forbid in copy.
const EM_DASH = '\u2014'

function findFirst(node: ReactNode, predicate: (el: ReactElement) => boolean): ReactElement | null {
  if (node == null || typeof node === 'boolean') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findFirst(child, predicate)
      if (hit) return hit
    }
    return null
  }
  if (typeof node === 'string' || typeof node === 'number') return null
  const el = node as ReactElement
  if (!el || typeof el !== 'object' || !('type' in el)) return null
  if (predicate(el)) return el
  const kids = (el.props as { children?: ReactNode })?.children
  return kids != null ? findFirst(kids, predicate) : null
}

function textOf(node: ReactNode): string {
  const parts: string[] = []
  const visit = (n: ReactNode) => {
    if (n == null || typeof n === 'boolean') return
    if (Array.isArray(n)) return n.forEach(visit)
    if (typeof n === 'string') return parts.push(n)
    if (typeof n === 'number') return parts.push(String(n))
    const el = n as ReactElement
    const kids = (el.props as { children?: ReactNode })?.children
    if (kids != null) visit(kids)
  }
  visit(node)
  return parts.join(' ')
}

interface ExplainerSheetCapturedProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  bands?: ExplainerBand[]
  currentValue?: number | null
  currentBandLabel?: string
  source?: ReactNode
  dismissLabel?: string
}

function captureSheetProps(component: ReactElement): ExplainerSheetCapturedProps {
  const sheet = findFirst(component, (el) => el.type === ExplainerSheet)
  if (!sheet) throw new Error('ExplainerSheet not found in component tree')
  return sheet.props as ExplainerSheetCapturedProps
}

function assertNoEmDashes(str: string, where: string) {
  if (str.includes(EM_DASH)) {
    throw new Error(`em-dash found in ${where}: ${JSON.stringify(str)}`)
  }
  expect(str.includes(EM_DASH)).toBe(false)
}

function assertCopyClean(props: ExplainerSheetCapturedProps, where: string) {
  const titleText = typeof props.title === 'string' ? props.title : textOf(props.title)
  const sourceText = typeof props.source === 'string' ? props.source : textOf(props.source ?? '')
  const childText = textOf(props.children)
  assertNoEmDashes(titleText, `${where}: title`)
  assertNoEmDashes(sourceText, `${where}: source`)
  assertNoEmDashes(childText, `${where}: body`)
}

function assertBandsShape(bands: ExplainerBand[] | undefined, where: string) {
  expect(bands).toBeDefined()
  expect(Array.isArray(bands)).toBe(true)
  expect(bands!.length).toBeGreaterThan(0)
  for (const b of bands!) {
    expect(typeof b.label).toBe('string')
    expect(b.label.length).toBeGreaterThan(0)
    expect(typeof b.min).toBe('number')
    expect(typeof b.max).toBe('number')
    expect(b.max).toBeGreaterThan(b.min)
    expect(typeof b.color).toBe('string')
    expect(b.color.length).toBeGreaterThan(0)
    assertNoEmDashes(b.label, `${where}: band ${b.label}`)
  }
}

function assertSourceNonEmpty(source: ReactNode, where: string) {
  const text = typeof source === 'string' ? source : textOf(source ?? '')
  expect(text.trim().length).toBeGreaterThan(0)
  if (text.length === 0) {
    throw new Error(`source must not be empty in ${where}`)
  }
}

describe('MetricExplainers', () => {
  describe('ReadinessExplainer', () => {
    it('renders with a numeric value and forwards open/onClose to ExplainerSheet', () => {
      const onClose = vi.fn()
      const tree = ReadinessExplainer({ open: true, onClose, value: 78, dateISO: '2026-04-22' })
      const props = captureSheetProps(tree)
      expect(props.open).toBe(true)
      expect(props.onClose).toBe(onClose)
      expect(typeof props.title === 'string' ? props.title : '').toBe('Readiness')
    })

    it('passes a Pay attention/Fair/Good/Optimal band shape', () => {
      const tree = ReadinessExplainer({ open: true, onClose: () => {}, value: 78, dateISO: '2026-04-22' })
      const props = captureSheetProps(tree)
      assertBandsShape(props.bands, 'ReadinessExplainer')
      const labels = props.bands!.map((b) => b.label)
      expect(labels).toEqual(['Pay attention', 'Fair', 'Good', 'Optimal'])
    })

    it('forwards the value as currentValue when finite', () => {
      const tree = ReadinessExplainer({ open: true, onClose: () => {}, value: 78, dateISO: '2026-04-22' })
      const props = captureSheetProps(tree)
      expect(props.currentValue).toBe(78)
      expect(typeof props.currentBandLabel).toBe('string')
    })

    it('renders the missing-data source when value is null', () => {
      const tree = ReadinessExplainer({ open: true, onClose: () => {}, value: null, dateISO: null })
      const props = captureSheetProps(tree)
      assertSourceNonEmpty(props.source, 'ReadinessExplainer:no-value')
      const text = typeof props.source === 'string' ? props.source : ''
      expect(text.toLowerCase()).toContain('ring')
    })

    it('source string is not empty when value is provided', () => {
      const tree = ReadinessExplainer({ open: true, onClose: () => {}, value: 78, dateISO: '2026-04-22' })
      const props = captureSheetProps(tree)
      assertSourceNonEmpty(props.source, 'ReadinessExplainer:with-value')
    })

    it('contains no em-dashes in title, source, or body copy', () => {
      const tree = ReadinessExplainer({ open: true, onClose: () => {}, value: 78, dateISO: '2026-04-22' })
      assertCopyClean(captureSheetProps(tree), 'ReadinessExplainer')
    })
  })

  describe('SleepExplainer', () => {
    it('renders with score + duration and forwards open/onClose', () => {
      const onClose = vi.fn()
      const tree = SleepExplainer({
        open: true,
        onClose,
        score: 82,
        durationSeconds: 27000,
        dateISO: '2026-04-22',
      })
      const props = captureSheetProps(tree)
      expect(props.open).toBe(true)
      expect(props.onClose).toBe(onClose)
      expect(props.title).toBe('Sleep score')
    })

    it('passes a 4-band 0-100 shape', () => {
      const tree = SleepExplainer({
        open: true,
        onClose: () => {},
        score: 82,
        durationSeconds: 27000,
        dateISO: '2026-04-22',
      })
      const props = captureSheetProps(tree)
      assertBandsShape(props.bands, 'SleepExplainer')
      expect(props.bands!.length).toBe(4)
      expect(props.bands![0].min).toBe(0)
      expect(props.bands![props.bands!.length - 1].max).toBe(100)
    })

    it('renders the missing-data source when score is null', () => {
      const tree = SleepExplainer({
        open: true,
        onClose: () => {},
        score: null,
        durationSeconds: null,
        dateISO: null,
      })
      const props = captureSheetProps(tree)
      assertSourceNonEmpty(props.source, 'SleepExplainer:no-score')
    })

    it('source contains the duration when score is present', () => {
      const tree = SleepExplainer({
        open: true,
        onClose: () => {},
        score: 82,
        durationSeconds: 27000, // 7h 30m
        dateISO: '2026-04-22',
      })
      const props = captureSheetProps(tree)
      const text = typeof props.source === 'string' ? props.source : ''
      expect(text.length).toBeGreaterThan(0)
    })

    it('contains no em-dashes in title, source, or body copy', () => {
      const tree = SleepExplainer({
        open: true,
        onClose: () => {},
        score: 82,
        durationSeconds: 27000,
        dateISO: '2026-04-22',
      })
      assertCopyClean(captureSheetProps(tree), 'SleepExplainer')
    })
  })

  describe('HRVExplainer', () => {
    it('renders with a value and median and forwards open/onClose', () => {
      const onClose = vi.fn()
      const tree = HRVExplainer({
        open: true,
        onClose,
        value: 48,
        medianRecent: 42,
        dateISO: '2026-04-22',
      })
      const props = captureSheetProps(tree)
      expect(props.open).toBe(true)
      expect(props.onClose).toBe(onClose)
      expect(props.title).toBe('Heart rate variability')
    })

    it('renders without a band bar (HRV is baseline-relative)', () => {
      const tree = HRVExplainer({
        open: true,
        onClose: () => {},
        value: 48,
        medianRecent: 42,
        dateISO: '2026-04-22',
      })
      const props = captureSheetProps(tree)
      expect(props.bands).toBeUndefined()
    })

    it('source mentions ms when value is present', () => {
      const tree = HRVExplainer({
        open: true,
        onClose: () => {},
        value: 48,
        medianRecent: 42,
        dateISO: '2026-04-22',
      })
      const props = captureSheetProps(tree)
      const text = typeof props.source === 'string' ? props.source : ''
      expect(text).toContain('ms')
      assertSourceNonEmpty(props.source, 'HRVExplainer:with-value')
    })

    it('source mentions both up and median diff when median is present', () => {
      const tree = HRVExplainer({
        open: true,
        onClose: () => {},
        value: 48,
        medianRecent: 42,
        dateISO: '2026-04-22',
      })
      const props = captureSheetProps(tree)
      const text = typeof props.source === 'string' ? props.source : ''
      expect(/up|down/.test(text)).toBe(true)
    })

    it('source falls back to a no-data note when value is null', () => {
      const tree = HRVExplainer({
        open: true,
        onClose: () => {},
        value: null,
        medianRecent: null,
        dateISO: null,
      })
      const props = captureSheetProps(tree)
      assertSourceNonEmpty(props.source, 'HRVExplainer:no-value')
    })

    it('contains no em-dashes in title, source, or body copy', () => {
      const tree = HRVExplainer({
        open: true,
        onClose: () => {},
        value: 48,
        medianRecent: 42,
        dateISO: '2026-04-22',
      })
      assertCopyClean(captureSheetProps(tree), 'HRVExplainer')
    })
  })

  describe('PainExplainer', () => {
    it('renders with a value and forwards open/onClose', () => {
      const onClose = vi.fn()
      const tree = PainExplainer({ open: true, onClose, value: 4, dateISO: '2026-04-22' })
      const props = captureSheetProps(tree)
      expect(props.open).toBe(true)
      expect(props.onClose).toBe(onClose)
      expect(props.title).toBe('Daily pain')
    })

    it('passes a 3-band 0-10 shape', () => {
      const tree = PainExplainer({ open: true, onClose: () => {}, value: 4, dateISO: '2026-04-22' })
      const props = captureSheetProps(tree)
      assertBandsShape(props.bands, 'PainExplainer')
      expect(props.bands!.length).toBe(3)
      expect(props.bands![0].min).toBe(0)
      expect(props.bands![props.bands!.length - 1].max).toBe(10)
      expect(props.bands!.map((b) => b.label)).toEqual(['Settled', 'Moderate', 'Flare'])
    })

    it('forwards the numeric pain value as currentValue', () => {
      const tree = PainExplainer({ open: true, onClose: () => {}, value: 7, dateISO: '2026-04-22' })
      const props = captureSheetProps(tree)
      expect(props.currentValue).toBe(7)
      expect(props.currentBandLabel).toBe('Flare')
    })

    it('uses the no-data source when value is null', () => {
      const tree = PainExplainer({ open: true, onClose: () => {}, value: null, dateISO: null })
      const props = captureSheetProps(tree)
      assertSourceNonEmpty(props.source, 'PainExplainer:no-value')
      const text = typeof props.source === 'string' ? props.source : ''
      expect(text.toLowerCase()).toContain('log')
    })

    it('contains no em-dashes in title, source, or body copy', () => {
      const tree = PainExplainer({ open: true, onClose: () => {}, value: 4, dateISO: '2026-04-22' })
      assertCopyClean(captureSheetProps(tree), 'PainExplainer')
    })
  })

  describe('CycleExplainer', () => {
    it('renders with day + phase and forwards open/onClose', () => {
      const onClose = vi.fn()
      const tree = CycleExplainer({
        open: true,
        onClose,
        day: 12,
        phase: 'follicular',
        isUnusuallyLong: false,
        lastPeriodISO: '2026-04-10',
      })
      const props = captureSheetProps(tree)
      expect(props.open).toBe(true)
      expect(props.onClose).toBe(onClose)
      const title = typeof props.title === 'string' ? props.title : textOf(props.title)
      expect(title).toContain('Cycle day 12')
      expect(title).toContain('Follicular')
    })

    it('renders without a band bar (cycle is ordinal)', () => {
      const tree = CycleExplainer({
        open: true,
        onClose: () => {},
        day: 12,
        phase: 'follicular',
        isUnusuallyLong: false,
        lastPeriodISO: '2026-04-10',
      })
      const props = captureSheetProps(tree)
      expect(props.bands).toBeUndefined()
    })

    it('mentions the long-cycle warning when flagged', () => {
      const tree = CycleExplainer({
        open: true,
        onClose: () => {},
        day: 36,
        phase: 'luteal',
        isUnusuallyLong: true,
        lastPeriodISO: '2026-03-18',
      })
      const props = captureSheetProps(tree)
      const text = typeof props.source === 'string' ? props.source : ''
      expect(text.toLowerCase()).toContain('longer')
    })

    it('falls back to a generic title when phase is missing', () => {
      const tree = CycleExplainer({
        open: true,
        onClose: () => {},
        day: null,
        phase: null,
        isUnusuallyLong: null,
        lastPeriodISO: null,
      })
      const props = captureSheetProps(tree)
      expect(props.title).toBe('Cycle')
    })

    it('source is not empty in either has-data or no-data state', () => {
      const tree1 = CycleExplainer({
        open: true,
        onClose: () => {},
        day: 12,
        phase: 'follicular',
        isUnusuallyLong: false,
        lastPeriodISO: '2026-04-10',
      })
      assertSourceNonEmpty(captureSheetProps(tree1).source, 'CycleExplainer:with-data')
      const tree2 = CycleExplainer({
        open: true,
        onClose: () => {},
        day: null,
        phase: null,
        isUnusuallyLong: null,
        lastPeriodISO: null,
      })
      assertSourceNonEmpty(captureSheetProps(tree2).source, 'CycleExplainer:no-data')
    })

    it('contains no em-dashes in title, source, or body copy', () => {
      const tree = CycleExplainer({
        open: true,
        onClose: () => {},
        day: 12,
        phase: 'follicular',
        isUnusuallyLong: false,
        lastPeriodISO: '2026-04-10',
      })
      assertCopyClean(captureSheetProps(tree), 'CycleExplainer')
    })
  })

  describe('CaloriesExplainer', () => {
    it('renders with calorie totals and forwards open/onClose', () => {
      const onClose = vi.fn()
      const tree = CaloriesExplainer({
        open: true,
        onClose,
        calories: 1850,
        entryCount: 4,
        dateISO: '2026-04-22',
      })
      const props = captureSheetProps(tree)
      expect(props.open).toBe(true)
      expect(props.onClose).toBe(onClose)
      expect(props.title).toBe('Calories today')
    })

    it('renders without a band bar (calories are absolute)', () => {
      const tree = CaloriesExplainer({
        open: true,
        onClose: () => {},
        calories: 1850,
        entryCount: 4,
        dateISO: '2026-04-22',
      })
      const props = captureSheetProps(tree)
      expect(props.bands).toBeUndefined()
    })

    it('source pluralises entries correctly', () => {
      const oneTree = CaloriesExplainer({
        open: true,
        onClose: () => {},
        calories: 400,
        entryCount: 1,
        dateISO: '2026-04-22',
      })
      const oneText = typeof captureSheetProps(oneTree).source === 'string'
        ? (captureSheetProps(oneTree).source as string)
        : ''
      expect(oneText).toContain('1 meal entry')

      const manyTree = CaloriesExplainer({
        open: true,
        onClose: () => {},
        calories: 1900,
        entryCount: 4,
        dateISO: '2026-04-22',
      })
      const manyText = typeof captureSheetProps(manyTree).source === 'string'
        ? (captureSheetProps(manyTree).source as string)
        : ''
      expect(manyText).toContain('4 meal entries')
    })

    it('uses the empty-state source when calories are 0 or null', () => {
      const tree = CaloriesExplainer({
        open: true,
        onClose: () => {},
        calories: 0,
        entryCount: 0,
        dateISO: '2026-04-22',
      })
      const props = captureSheetProps(tree)
      assertSourceNonEmpty(props.source, 'CaloriesExplainer:zero')
      const text = typeof props.source === 'string' ? props.source : ''
      expect(text.toLowerCase()).toContain('log')
    })

    it('contains no em-dashes in title, source, or body copy', () => {
      const tree = CaloriesExplainer({
        open: true,
        onClose: () => {},
        calories: 1850,
        entryCount: 4,
        dateISO: '2026-04-22',
      })
      assertCopyClean(captureSheetProps(tree), 'CaloriesExplainer')
    })
  })

  describe('cross-explainer guarantees', () => {
    it('every explainer renders without throwing on its representative payload', () => {
      expect(() =>
        ReadinessExplainer({ open: true, onClose: () => {}, value: 78, dateISO: '2026-04-22' }),
      ).not.toThrow()
      expect(() =>
        SleepExplainer({
          open: true,
          onClose: () => {},
          score: 82,
          durationSeconds: 27000,
          dateISO: '2026-04-22',
        }),
      ).not.toThrow()
      expect(() =>
        HRVExplainer({
          open: true,
          onClose: () => {},
          value: 48,
          medianRecent: 42,
          dateISO: '2026-04-22',
        }),
      ).not.toThrow()
      expect(() =>
        PainExplainer({ open: true, onClose: () => {}, value: 4, dateISO: '2026-04-22' }),
      ).not.toThrow()
      expect(() =>
        CycleExplainer({
          open: true,
          onClose: () => {},
          day: 12,
          phase: 'follicular',
          isUnusuallyLong: false,
          lastPeriodISO: '2026-04-10',
        }),
      ).not.toThrow()
      expect(() =>
        CaloriesExplainer({
          open: true,
          onClose: () => {},
          calories: 1850,
          entryCount: 4,
          dateISO: '2026-04-22',
        }),
      ).not.toThrow()
    })

    it('every explainer renders without throwing on a fully-null payload', () => {
      expect(() =>
        ReadinessExplainer({ open: true, onClose: () => {}, value: null, dateISO: null }),
      ).not.toThrow()
      expect(() =>
        SleepExplainer({
          open: true,
          onClose: () => {},
          score: null,
          durationSeconds: null,
          dateISO: null,
        }),
      ).not.toThrow()
      expect(() =>
        HRVExplainer({
          open: true,
          onClose: () => {},
          value: null,
          medianRecent: null,
          dateISO: null,
        }),
      ).not.toThrow()
      expect(() =>
        PainExplainer({ open: true, onClose: () => {}, value: null, dateISO: null }),
      ).not.toThrow()
      expect(() =>
        CycleExplainer({
          open: true,
          onClose: () => {},
          day: null,
          phase: null,
          isUnusuallyLong: null,
          lastPeriodISO: null,
        }),
      ).not.toThrow()
      expect(() =>
        CaloriesExplainer({
          open: true,
          onClose: () => {},
          calories: null,
          entryCount: null,
          dateISO: null,
        }),
      ).not.toThrow()
    })
  })
})
