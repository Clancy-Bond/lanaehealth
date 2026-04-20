/**
 * /v2/import: Import landing
 *
 * Thin nav page that lists the data sources we currently support
 * (plus placeholders for sources not yet wired). The working flow
 * for Adventist Health is owned by /import/myah, which this page
 * deep-links to: we are not rebuilding that plaintext parser in v2,
 * just giving it a premium front door.
 */
import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card, ListRow } from '@/v2/components/primitives'
import SectionHeader from '../_components/SectionHeader'

export const dynamic = 'force-static'

interface Source {
  href: string
  label: string
  subtext: string
  trailing: string
  intent?: 'default' | 'warning' | 'success'
  disabled?: boolean
}

const SOURCES: Source[] = [
  {
    href: '/import/myah',
    label: 'Adventist Health (myAH)',
    subtext: 'Paste notes, labs, imaging, meds. We parse and link.',
    trailing: 'Open',
    intent: 'success',
  },
  {
    href: '/settings',
    label: 'Oura Ring',
    subtext: 'Sleep, HRV, body temperature. Connected in Settings.',
    trailing: 'Settings',
  },
  {
    href: '#',
    label: 'Apple Health',
    subtext: 'Vitals and activity from your iPhone. Coming soon.',
    trailing: 'Later',
    disabled: true,
  },
  {
    href: '#',
    label: 'Natural Cycles',
    subtext: 'Import BBT and period history. Coming soon.',
    trailing: 'Later',
    disabled: true,
  },
  {
    href: '#',
    label: 'Plaintext (any source)',
    subtext: 'Paste anything readable; the AI will do its best.',
    trailing: 'Later',
    disabled: true,
  },
]

export default function V2ImportPage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Import"
          leading={
            <Link
              href="/v2"
              aria-label="Back to home"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-lg)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ←
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-5)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-10)',
        }}
      >
        <Card variant="explanatory" padding="md">
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              lineHeight: 'var(--v2-leading-relaxed)',
              color: 'var(--v2-surface-explanatory-text)',
            }}
          >
            Bring your medical data into LanaeHealth. We support a growing set
            of direct portal imports plus a plaintext paste path for anything
            else.
          </p>
        </Card>

        <section>
          <SectionHeader eyebrow="Sources" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <Card padding="none">
              <div style={{ padding: '0 var(--v2-space-4)' }}>
                {SOURCES.map((s, i) =>
                  s.disabled ? (
                    <ListRow
                      key={s.label}
                      label={s.label}
                      subtext={s.subtext}
                      trailing={s.trailing}
                      divider={i < SOURCES.length - 1}
                    />
                  ) : (
                    <Link
                      key={s.label}
                      href={s.href}
                      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                    >
                      <ListRow
                        label={s.label}
                        subtext={s.subtext}
                        trailing={s.trailing}
                        chevron
                        intent={s.intent}
                        divider={i < SOURCES.length - 1}
                      />
                    </Link>
                  ),
                )}
              </div>
            </Card>
          </div>
        </section>

        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textAlign: 'center',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          Data stays on your device and in your Supabase project. See Settings
          for connected sources.
        </p>
      </div>
    </MobileShell>
  )
}
