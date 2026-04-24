/*
 * ExplainerSheet contract tests.
 *
 * We do not mount into a DOM because the repo's vitest config is node
 * environment and neither jsdom nor a React testing library is
 * installed. Instead we call the function component directly and walk
 * the returned React element tree. That is enough to assert the
 * render contract: what props the underlying Sheet receives, whether
 * the band bar is present, whether the dismiss button is wired to
 * onClose, and whether the source note renders.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import React from 'react'
import ExplainerSheet, {
  type ExplainerBand,
  type ExplainerSheetProps,
} from '@/app/v2/_components/ExplainerSheet'
import { Button, Sheet } from '@/v2/components/primitives'

/**
 * Recursively walk a React element tree and return every node whose
 * type matches the predicate. Handles arrays, fragments, and nested
 * children. Non-element values (strings, numbers, null) are skipped.
 */
function findAll(
  node: ReactNode,
  predicate: (el: ReactElement) => boolean,
): ReactElement[] {
  const hits: ReactElement[] = []
  const visit = (n: ReactNode) => {
    if (n == null || typeof n === 'boolean') return
    if (Array.isArray(n)) {
      n.forEach(visit)
      return
    }
    if (typeof n === 'string' || typeof n === 'number') return
    const el = n as ReactElement
    if (!el || typeof el !== 'object' || !('type' in el)) return
    if (predicate(el)) hits.push(el)
    const kids = (el.props as { children?: ReactNode })?.children
    if (kids != null) visit(kids)
  }
  visit(node)
  return hits
}

function findFirst(node: ReactNode, predicate: (el: ReactElement) => boolean) {
  return findAll(node, predicate)[0] ?? null
}

/** Flatten all string text inside a React tree. */
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

function renderShallow(props: ExplainerSheetProps): ReactElement {
  // Invoke the component as a function; this is standard shallow
  // rendering for React function components and does not touch the
  // DOM. The returned tree is the element output as if React were
  // about to reconcile it.
  return ExplainerSheet(props) as ReactElement
}

describe('ExplainerSheet', () => {
  const BANDS: ExplainerBand[] = [
    { label: 'Low', min: 0, max: 40, color: 'red' },
    { label: 'Mid', min: 40, max: 70, color: 'yellow' },
    { label: 'High', min: 70, max: 100, color: 'green' },
  ]

  describe('title and children', () => {
    it('renders the title through the Sheet and preserves the children tree', () => {
      const onClose = vi.fn()
      const tree = renderShallow({
        open: true,
        onClose,
        title: 'Readiness',
        children: React.createElement('p', { 'data-testid': 'body' }, 'Hello body'),
      })

      const sheet = findFirst(tree, (el) => el.type === Sheet)
      expect(sheet).not.toBeNull()
      expect((sheet!.props as { title: ReactNode }).title).toBe('Readiness')
      expect((sheet!.props as { open: boolean }).open).toBe(true)
      expect((sheet!.props as { onClose: () => void }).onClose).toBe(onClose)
      expect((sheet!.props as { explanatory: boolean }).explanatory).toBe(true)

      const body = findFirst(tree, (el) => (el.props as { 'data-testid'?: string })?.['data-testid'] === 'body')
      expect(body).not.toBeNull()
      expect(textOf(body)).toContain('Hello body')
    })

    it('accepts a ReactNode title (not just a string)', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: React.createElement('span', null, 'Cycle day 12'),
        children: 'body',
      })
      const sheet = findFirst(tree, (el) => el.type === Sheet)
      const title = (sheet!.props as { title: ReactElement }).title
      expect(textOf(title)).toContain('Cycle day 12')
    })
  })

  describe('without bands prop', () => {
    it('does not render the segmented band bar', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'HRV',
        children: 'How this works',
      })
      // BandBar writes the word "No data" when value is missing; the
      // simpler check is that no element tree includes the band labels.
      expect(textOf(tree)).not.toContain('Low')
      expect(textOf(tree)).not.toContain('Mid')
      expect(textOf(tree)).not.toContain('High')
    })

    it('omits the dismiss button when no bands and no source are provided', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Title',
        children: 'body only',
      })
      const buttons = findAll(tree, (el) => el.type === Button)
      expect(buttons).toHaveLength(0)
    })
  })

  /*
   * The band bar is rendered through an internal BandBar function
   * component that we do not execute (shallow inspection). We assert
   * on the props forwarded to that internal component instead: if
   * BandBar gets the right bands, value, and label, the visible
   * output follows from its already-type-checked render body.
   */
  function findBandBar(tree: ReactElement) {
    return findFirst(
      tree,
      (el) =>
        typeof el.type === 'function' &&
        (el.type as { name?: string }).name === 'BandBar',
    )
  }

  describe('with bands prop', () => {
    it('renders a BandBar with every supplied band label', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Readiness',
        children: 'body',
        bands: BANDS,
        currentValue: 50,
      })
      const bandBar = findBandBar(tree)
      expect(bandBar).not.toBeNull()
      const props = bandBar!.props as { bands: ExplainerBand[] }
      expect(props.bands.map((b) => b.label)).toEqual(['Low', 'Mid', 'High'])
    })

    it('forwards a finite currentValue to BandBar', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Readiness',
        children: 'body',
        bands: BANDS,
        currentValue: 72,
      })
      const bandBar = findBandBar(tree)
      expect(bandBar).not.toBeNull()
      expect((bandBar!.props as { currentValue: number | null | undefined }).currentValue).toBe(72)
    })

    it('forwards a null currentValue so BandBar renders the No data label', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Readiness',
        children: 'body',
        bands: BANDS,
        currentValue: null,
      })
      const bandBar = findBandBar(tree)
      expect(bandBar).not.toBeNull()
      expect((bandBar!.props as { currentValue: number | null | undefined }).currentValue).toBeNull()
    })

    it('forwards a NaN currentValue unchanged; BandBar decides on No data', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Readiness',
        children: 'body',
        bands: BANDS,
        currentValue: Number.NaN,
      })
      const bandBar = findBandBar(tree)
      expect(bandBar).not.toBeNull()
      const cv = (bandBar!.props as { currentValue: number | null | undefined }).currentValue
      expect(Number.isNaN(cv)).toBe(true)
    })

    it('forwards a currentBandLabel to BandBar', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Readiness',
        children: 'body',
        bands: BANDS,
        currentValue: 72,
        currentBandLabel: 'Good',
      })
      const bandBar = findBandBar(tree)
      expect(bandBar).not.toBeNull()
      expect((bandBar!.props as { currentBandLabel?: string }).currentBandLabel).toBe('Good')
    })

    it('does not render a BandBar when bands is an empty array', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Readiness',
        children: 'body',
        bands: [],
      })
      expect(findBandBar(tree)).toBeNull()
    })

    it('renders the dismiss button when bands are provided', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Readiness',
        children: 'body',
        bands: BANDS,
        currentValue: 50,
      })
      const buttons = findAll(tree, (el) => el.type === Button)
      expect(buttons.length).toBe(1)
    })
  })

  describe('dismiss button', () => {
    it('calls onClose when the dismiss button is invoked (with bands)', () => {
      const onClose = vi.fn()
      const tree = renderShallow({
        open: true,
        onClose,
        title: 'Title',
        children: 'body',
        bands: BANDS,
        currentValue: 70,
      })
      const btn = findFirst(tree, (el) => el.type === Button)
      expect(btn).not.toBeNull()
      const handler = (btn!.props as { onClick: () => void }).onClick
      handler()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when the dismiss button is invoked (source only, no bands)', () => {
      const onClose = vi.fn()
      const tree = renderShallow({
        open: true,
        onClose,
        title: 'Title',
        children: 'body',
        source: 'Based on last night.',
      })
      const btn = findFirst(tree, (el) => el.type === Button)
      expect(btn).not.toBeNull()
      const handler = (btn!.props as { onClick: () => void }).onClick
      handler()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('defaults the dismiss label to "Got it"', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Title',
        children: 'body',
        bands: BANDS,
        currentValue: 50,
      })
      const btn = findFirst(tree, (el) => el.type === Button)
      expect(textOf(btn)).toContain('Got it')
    })

    it('respects a custom dismissLabel', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Title',
        children: 'body',
        bands: BANDS,
        currentValue: 50,
        dismissLabel: 'Close',
      })
      const btn = findFirst(tree, (el) => el.type === Button)
      expect(textOf(btn)).toContain('Close')
      expect(textOf(btn)).not.toContain('Got it')
    })
  })

  describe('source prop', () => {
    it('renders the source string when provided', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Readiness',
        children: 'body',
        source: "Based on last night's sleep and HRV.",
      })
      expect(textOf(tree)).toContain("Based on last night's sleep and HRV.")
    })

    it('omits the source block when source is undefined', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Readiness',
        children: 'body-only',
        bands: BANDS,
        currentValue: 50,
      })
      expect(textOf(tree)).not.toContain('Based on last night')
    })

    it('source-only mode still renders the dismiss button', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Readiness',
        children: 'body',
        source: 'Some source',
      })
      const buttons = findAll(tree, (el) => el.type === Button)
      expect(buttons.length).toBe(1)
    })

    it('accepts a ReactNode source (not just a string)', () => {
      const tree = renderShallow({
        open: true,
        onClose: () => {},
        title: 'Readiness',
        children: 'body',
        source: React.createElement('em', null, 'Last night (2026-04-22).'),
      })
      expect(textOf(tree)).toContain('Last night (2026-04-22).')
    })
  })

  describe('closed state', () => {
    it('still produces the same tree shape when open=false (Sheet guards mount itself)', () => {
      const tree = renderShallow({
        open: false,
        onClose: () => {},
        title: 'Readiness',
        children: 'body',
      })
      const sheet = findFirst(tree, (el) => el.type === Sheet)
      expect(sheet).not.toBeNull()
      expect((sheet!.props as { open: boolean }).open).toBe(false)
    })
  })
})
