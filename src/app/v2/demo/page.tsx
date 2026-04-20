'use client'

/*
 * v2 primitives demo.
 *
 * Single showcase page for Phase 0 foundation. Every primitive
 * visible in every state at 375pt width. Visual-parity iteration
 * lives here : compare each section to its source reference frame.
 */
import { useState } from 'react'
import {
  Button,
  Card,
  ListRow,
  MetricRing,
  MetricTile,
  Sheet,
  Stepper,
  EmptyState,
  Skeleton,
  Banner,
  Toggle,
  SegmentedControl,
} from '@/v2/components/primitives'
import { MobileShell, TopAppBar, BottomTabBar, FAB } from '@/v2/components/shell'

const TABS = [
  { label: 'Home', href: '/v2', icon: '●' },
  { label: 'Cycle', href: '/v2/cycle', icon: '○' },
  { label: 'Food', href: '/v2/calories', icon: '◐' },
  { label: 'More', href: '/v2/settings', icon: '⋯' },
]

export default function DemoPage() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [explanSheetOpen, setExplanSheetOpen] = useState(false)
  const [tab, setTab] = useState<'today' | 'yesterday'>('today')

  return (
    <MobileShell
      top={<TopAppBar title="v2 primitives" leading={<span style={{ fontSize: 18 }}>‹</span>} trailing={<span style={{ fontSize: 18 }}>⋯</span>} />}
      bottom={<BottomTabBar tabs={TABS} centerAction={<FAB variant="tab-center" label="Add" />} />}
    >
      <div style={{ padding: 'var(--v2-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-6)' }}>

        <Section title="MetricTile strip" note="frame_0001.png">
          <div style={{ display: 'flex', gap: 'var(--v2-space-3)', overflowX: 'auto', padding: '4px 0' }}>
            <MetricTile icon="☀" value="79" label="Readiness" color="var(--v2-ring-readiness)" />
            <MetricTile icon="☾" value="83" label="Sleep" color="var(--v2-ring-sleep)" />
            <MetricTile icon="△" value="62" label="Activity" color="var(--v2-ring-activity)" />
            <MetricTile icon="∞" value="551" label="Cycle day" />
          </div>
        </Section>

        <Section title="MetricRing" note="frame_0001.png (Readiness)">
          <div style={{ display: 'flex', gap: 'var(--v2-space-5)', alignItems: 'center', flexWrap: 'wrap' }}>
            <MetricRing value={79} label="Readiness" size="lg" color="var(--v2-ring-readiness)" />
            <MetricRing value={83} label="Sleep" size="md" color="var(--v2-ring-sleep)" />
            <MetricRing value={62} label="Activity" size="sm" color="var(--v2-ring-activity)" />
          </div>
        </Section>

        <Section title="Button">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--v2-space-3)' }}>
            <Button variant="primary">Get help</Button>
            <Button variant="secondary">Find my ring</Button>
            <Button variant="tertiary">Learn more</Button>
            <Button variant="destructive">Delete</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--v2-space-3)', marginTop: 'var(--v2-space-3)' }}>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Card">
          <Card padding="md">
            <p style={{ margin: 0, fontSize: 'var(--v2-text-base)' }}>Default dark-chrome card (Oura).</p>
          </Card>
          <Card padding="md" variant="elevated" style={{ marginTop: 'var(--v2-space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--v2-text-base)' }}>Elevated card (modal / highlighted).</p>
          </Card>
          <Card padding="md" variant="explanatory" style={{ marginTop: 'var(--v2-space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--v2-text-base)' }}>Explanatory card (NC cream surface for education).</p>
          </Card>
        </Section>

        <Section title="ListRow" note="frame_0150.png (Contributors)">
          <Card padding="none">
            <div style={{ padding: '0 var(--v2-space-4)' }}>
              <ListRow label="Resting heart rate" trailing="48 bpm" chevron />
              <ListRow label="HRV balance" trailing="Good" chevron />
              <ListRow label="Body temperature" trailing="Optimal" chevron />
              <ListRow label="Training frequency" trailing="Pay attention" intent="warning" chevron />
              <ListRow label="Recovery time" trailing="Optimal" chevron divider={false} />
            </div>
          </Card>
        </Section>

        <Section title="SegmentedControl">
          <SegmentedControl
            segments={[
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'today', label: 'Today' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </Section>

        <Section title="Toggle">
          <Toggle defaultChecked label="Notifications" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <Toggle label="Locked (disabled)" disabled />
          </div>
        </Section>

        <Section title="Stepper">
          <Stepper label="Servings" defaultValue={1} min={0} max={10} />
        </Section>

        <Section title="Banner">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
            <Banner intent="info" title="New study in Oura Labs" body="Participate to help detect signs of hypertension." />
            <Banner intent="warning" title="Pay attention" body="Training frequency below target this week." />
            <Banner intent="danger" title="Heart rate alert" body="Resting HR spiked above your baseline." />
            <Banner intent="success" title="Goal met" body="You hit your activity goal today." />
          </div>
        </Section>

        <Section title="EmptyState">
          <Card padding="md">
            <EmptyState
              illustration="○"
              headline="Nothing logged yet"
              subtext="Tap the plus to add your first entry. You can always edit or delete later."
              cta={<Button variant="primary">Add entry</Button>}
            />
          </Card>
        </Section>

        <Section title="Skeleton">
          <Card padding="md">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-3)' }}>
              <Skeleton shape="circle" width={48} height={48} />
              <div style={{ flex: 1 }}>
                <Skeleton shape="text" width="70%" height={14} />
                <div style={{ height: 6 }} />
                <Skeleton shape="text" width="45%" height={12} />
              </div>
            </div>
            <div style={{ height: 'var(--v2-space-3)' }} />
            <Skeleton shape="rect" height={64} />
          </Card>
        </Section>

        <Section title="Sheet">
          <div style={{ display: 'flex', gap: 'var(--v2-space-3)' }}>
            <Button onClick={() => setSheetOpen(true)}>Open dark sheet</Button>
            <Button variant="secondary" onClick={() => setExplanSheetOpen(true)}>Open explanatory sheet</Button>
          </div>
          <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Log today">
            <p style={{ color: 'var(--v2-text-secondary)', fontSize: 'var(--v2-text-sm)' }}>
              A dark bottom sheet with content. Tap outside to dismiss.
            </p>
            <Button onClick={() => setSheetOpen(false)} fullWidth>Close</Button>
          </Sheet>
          <Sheet open={explanSheetOpen} onClose={() => setExplanSheetOpen(false)} title="About readiness" explanatory>
            <p style={{ fontSize: 'var(--v2-text-sm)', lineHeight: 'var(--v2-leading-relaxed)' }}>
              Readiness reflects your body&apos;s capacity for the day based on sleep, heart rate variability,
              and body temperature. Think of it as a daily check-in with yourself.
            </p>
            <Button onClick={() => setExplanSheetOpen(false)} fullWidth>Got it</Button>
          </Sheet>
        </Section>

      </div>
    </MobileShell>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--v2-space-2)' }}>
        <h2 style={{ fontSize: 'var(--v2-text-xl)', fontWeight: 'var(--v2-weight-bold)', color: 'var(--v2-text-primary)', margin: 0, letterSpacing: 'var(--v2-tracking-tight)' }}>
          {title}
        </h2>
        {note && (
          <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--v2-tracking-wide)' }}>
            {note}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}
