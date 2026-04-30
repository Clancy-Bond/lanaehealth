'use client'

import { useState } from 'react'
import { Card } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import { HypothesesExplainer } from './MetricExplainers'
import { useHypotheses } from './useHypotheses'
import type { DoctorPageData } from '@/app/doctor/page'
import type { SpecialistView } from '@/lib/doctor/specialist-config'
import type { KBHypothesis, KBConfidenceCategory, HypothesisDirection } from '@/lib/doctor/kb-hypotheses'
import type { Hypothesis } from '@/lib/doctor/hypotheses'
import { humanizeHypothesisName } from './humanizeHypothesisName'

interface HypothesesCardProps {
  data: DoctorPageData
  view: SpecialistView
}

function kbConfidenceColor(c: KBConfidenceCategory): string {
  if (c === 'ESTABLISHED' || c === 'PROBABLE') return 'var(--v2-accent-success)'
  if (c === 'POSSIBLE') return 'var(--v2-accent-highlight)'
  if (c === 'SPECULATIVE' || c === 'INSUFFICIENT') return 'var(--v2-text-muted)'
  return 'var(--v2-text-muted)'
}

function heuristicConfidenceColor(c: 'high' | 'moderate' | 'low'): string {
  if (c === 'high') return 'var(--v2-accent-success)'
  if (c === 'moderate') return 'var(--v2-accent-highlight)'
  return 'var(--v2-text-muted)'
}

function directionGlyph(d: HypothesisDirection): { symbol: string; color: string } {
  if (d === 'rising') return { symbol: '↑', color: 'var(--v2-accent-danger)' }
  if (d === 'falling') return { symbol: '↓', color: 'var(--v2-accent-success)' }
  return { symbol: '–', color: 'var(--v2-text-muted)' }
}

function BulletList({ items, label, labelColor }: { items: string[]; label: string; labelColor: string }) {
  if (items.length === 0) return null
  return (
    <div style={{ marginTop: 'var(--v2-space-2)' }}>
      <div
        style={{
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          color: labelColor,
        }}
      >
        {label}
      </div>
      <ul
        style={{
          listStyle: 'disc',
          paddingLeft: 18,
          margin: '2px 0 0',
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  )
}

function KBHypothesisBlock({ h }: { h: KBHypothesis }) {
  const dir = directionGlyph(h.direction)
  const color = kbConfidenceColor(h.confidence)
  return (
    <div
      style={{
        padding: 'var(--v2-space-3)',
        borderRadius: 'var(--v2-radius-sm)',
        background: 'var(--v2-bg-elevated)',
        border: '1px solid var(--v2-border-subtle)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--v2-space-2)', alignItems: 'flex-start' }}>
        <h4
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
            // KB hypothesis names from the tracker are snake_case
            // identifiers (e.g. chiari_malformation_type1_or_cranio-
            // cervical_instability) — single unbreakable tokens that
            // overflow the flex row without a hard break rule. minWidth: 0
            // overrides the implicit flex min-content floor; flex: 1
            // claims remaining row space; overflow-wrap: anywhere lets
            // the browser break inside the token when no soft break
            // exists. See tests/e2e/v2-doctor.spec.ts.
            flex: 1,
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {humanizeHypothesisName(h.name)}
        </h4>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-semibold)',
            color,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <span style={{ color: dir.color }}>{dir.symbol}</span>
          {h.confidence}
          {h.score !== null && ` ${h.score}`}
        </span>
      </div>
      <BulletList items={h.supporting} label="Supporting" labelColor="var(--v2-accent-success)" />
      <BulletList items={h.contradicting} label="Contradicting" labelColor="var(--v2-accent-danger)" />
      <BulletList items={h.whatWouldChange} label="What would change my mind" labelColor="var(--v2-accent-primary)" />
      <BulletList items={h.alternatives} label="Alternatives" labelColor="var(--v2-text-muted)" />
    </div>
  )
}

function HeuristicHypothesisBlock({ h }: { h: Hypothesis }) {
  const color = heuristicConfidenceColor(h.confidence)
  return (
    <div
      style={{
        padding: 'var(--v2-space-3)',
        borderRadius: 'var(--v2-radius-sm)',
        background: 'var(--v2-bg-elevated)',
        border: '1px solid var(--v2-border-subtle)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--v2-space-2)', alignItems: 'flex-start' }}>
        <h4
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
            // Heuristic names are human-readable today (e.g. "Postural
            // Orthostatic Tachycardia Syndrome (POTS)"), but apply the
            // same defensive shrink rules as KBHypothesisBlock so a
            // future long token cannot blow out the row.
            flex: 1,
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {h.name}
        </h4>
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-semibold)',
            color,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {h.confidence}
        </span>
      </div>
      <BulletList items={h.supporting} label="Supporting" labelColor="var(--v2-accent-success)" />
      <div
        style={{
          marginTop: 'var(--v2-space-3)',
          padding: 'var(--v2-space-2) var(--v2-space-3)',
          borderRadius: 'var(--v2-radius-sm)',
          background: 'var(--v2-bg-card)',
          borderLeft: '3px solid var(--v2-accent-primary)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-semibold)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
            color: 'var(--v2-accent-primary)',
          }}
        >
          Single most uncertainty-reducing test
        </div>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--v2-text-sm)', fontWeight: 'var(--v2-weight-semibold)', color: 'var(--v2-text-primary)' }}>
          {h.nextTest}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', fontStyle: 'italic', lineHeight: 'var(--v2-leading-normal)' }}>
          {h.nextTestRationale}
        </p>
      </div>
    </div>
  )
}

/*
 * HypothesesCard
 *
 * The leading differential. Prefers the KB tracker's CIE output
 * (score + direction + supporting + contradicting + alternatives)
 * and falls back to the heuristic generator when the KB document
 * hasn't been rebuilt yet. The KB/heuristic decision lives in
 * useHypotheses so the card stays focused on presentation.
 */
export default function HypothesesCard({ data, view }: HypothesesCardProps) {
  const [explainerOpen, setExplainerOpen] = useState(false)
  const vm = useHypotheses(data, data.kbHypotheses, view)
  const count =
    vm.source === 'kb' ? vm.kbHypotheses?.length ?? 0 : vm.heuristicHypotheses?.length ?? 0
  if (count === 0) return null

  const summary =
    vm.source === 'kb'
      ? `${count} CIE-tracked hypothes${count === 1 ? 'is' : 'es'}${vm.stale ? ' · stale' : ''}`
      : `${count} heuristic hypothes${count === 1 ? 'is' : 'es'} (KB unavailable)`

  return (
    <Card padding="md">
      <DoctorPanelHeader
        title="Working hypotheses"
        summary={summary}
        onExplain={() => setExplainerOpen(true)}
        explainLabel="Learn what confidence levels and arrows mean"
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        {vm.source === 'kb'
          ? vm.kbHypotheses!.map((h) => <KBHypothesisBlock key={h.name} h={h} />)
          : vm.heuristicHypotheses!.map((h) => <HeuristicHypothesisBlock key={h.name} h={h} />)}
      </div>
      <HypothesesExplainer open={explainerOpen} onClose={() => setExplainerOpen(false)} />
    </Card>
  )
}
