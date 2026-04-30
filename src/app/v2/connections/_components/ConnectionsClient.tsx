'use client'

/*
 * ConnectionsClient
 *
 * The mobile shell + section layout for /v2/connections. Splits the
 * status rows into two groups (connected, available) and renders a
 * card per row. Below the live integrations, a static tile points
 * users at the universal file-import flow as the always-on fallback,
 * and another tile sketches the email-forwarding lane that lands in
 * Phase 3 of the medical-data-aggregation design.
 */

import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import ConnectionCard, { type StatusRow } from './ConnectionCard'

interface Props {
  integrations: StatusRow[]
}

export default function ConnectionsClient({ integrations }: Props) {
  const connected = integrations.filter((i) => i.connected)
  const expired = integrations.filter((i) => i.expired)
  const available = integrations.filter((i) => !i.connected && !i.expired)

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Connections"
          leading={
            <Link
              href="/v2/settings"
              aria-label="Back to settings"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-base)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                minWidth: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ‹
            </Link>
          }
        />
      }
    >
      <div
        style={{
          maxWidth: 860,
          width: '100%',
          margin: '0 auto',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
        }}
      >
        <Card padding="md" variant="explanatory">
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
            }}
          >
            Connect your health
          </h1>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: 'var(--v2-text-sm)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            One place for everything that feeds your record. Connect a
            source once and it keeps itself up to date in the background.
          </p>
        </Card>

        {expired.length > 0 && (
          <Section heading="Reconnect">
            {expired.map((row) => (
              <ConnectionCard key={row.id} row={row} />
            ))}
          </Section>
        )}

        {connected.length > 0 && (
          <Section heading="Connected">
            {connected.map((row) => (
              <ConnectionCard key={row.id} row={row} />
            ))}
          </Section>
        )}

        {available.length > 0 && (
          <Section heading={connected.length > 0 ? 'Add another' : 'Connect a source'}>
            {available.map((row) => (
              <ConnectionCard key={row.id} row={row} />
            ))}
          </Section>
        )}

        <Card padding="md">
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            Have a file from a portal?
          </h2>
          <p
            style={{
              margin: '4px 0 12px 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            PDF, FHIR Bundle, C-CDA, CSV, or screenshot. Drop it in and we
            parse it.
          </p>
          <Link
            href="/v2/import"
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-primary)',
              textDecoration: 'underline',
            }}
          >
            Open file import
          </Link>
        </Card>

        <Card padding="md">
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            Forward your lab and visit emails
          </h2>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Many labs and small practices email PDF results directly. A
            forwarding filter from your inbox to a personal ingest address
            will pipe those into your record automatically. Coming next.
          </p>
          <span
            style={{
              display: 'inline-block',
              marginTop: 'var(--v2-space-2)',
              fontSize: 'var(--v2-text-xs)',
              padding: '2px 8px',
              borderRadius: 'var(--v2-radius-full)',
              background: 'var(--v2-bg-elevated)',
              color: 'var(--v2-text-muted)',
              fontWeight: 'var(--v2-weight-semibold)',
            }}
          >
            Coming soon
          </span>
        </Card>
      </div>
    </MobileShell>
  )
}

function Section({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2
        style={{
          margin: '0 0 var(--v2-space-2) 0',
          fontSize: 'var(--v2-text-xs)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          color: 'var(--v2-text-muted)',
          fontWeight: 'var(--v2-weight-semibold)',
        }}
      >
        {heading}
      </h2>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        {children}
      </div>
    </section>
  )
}
