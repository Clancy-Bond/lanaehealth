/*
 * CarrierGuide
 *
 * Shared 9-section renderer for every carrier guide under
 * /v2/insurance/<slug>. Drives off the typed CarrierGuideData
 * record in _data/carriers.ts so adding a new carrier is a data
 * change rather than a new component.
 *
 * Section order:
 *   1. At a glance
 *   2. Network
 *   3. Referrals
 *   4. Specialist access
 *   5. Tests + procedures (with prior auth gotchas)
 *   6. Appeals
 *   7. Anti-gaslighting strategies
 *   8. For chronic illness specifically
 *   9. Contact + member services
 *   + Sources block
 *
 * Voice: NC short, kind, explanatory. The renderer never adds copy
 * of its own beyond labels; all narrative comes from the data.
 *
 * No em-dashes anywhere in this file (CLAUDE.md voice rule).
 *
 * Server component, no client JS.
 */
import Link from 'next/link'
import { ExternalLink, Phone } from 'lucide-react'
import { Card } from '@/v2/components/primitives'
import SectionHeading from './SectionHeading'
import type { CarrierGuideData, CarrierContact, CarrierSource } from '../_data/carriers'

// ── tiny visual helpers ─────────────────────────────────────────

function ExternalAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'var(--v2-accent-primary)',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  )
}

function PhoneAnchor({ contact }: { contact: CarrierContact }) {
  return (
    <a
      href={`tel:${contact.digits}`}
      style={{
        color: 'var(--v2-accent-primary)',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Phone size={12} aria-hidden="true" />
      {contact.display}
      {contact.context ? (
        <span style={{ color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-xs)' }}>
          {' '}({contact.context})
        </span>
      ) : null}
    </a>
  )
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 'var(--v2-text-sm)',
        color: 'var(--v2-text-secondary)',
        lineHeight: 'var(--v2-leading-relaxed)',
      }}
    >
      {children}
    </p>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul
      style={{
        margin: 'var(--v2-space-2) 0 0',
        padding: '0 0 0 var(--v2-space-4)',
        fontSize: 'var(--v2-text-sm)',
        color: 'var(--v2-text-primary)',
        lineHeight: 'var(--v2-leading-relaxed)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-1)',
      }}
    >
      {items.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </ul>
  )
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--v2-space-3)',
        padding: 'var(--v2-space-2) 0',
        borderBottom: '1px solid var(--v2-border-subtle)',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-primary)',
          fontWeight: 'var(--v2-weight-medium)',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function SourcesBlock({ sources }: { sources: CarrierSource[] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-2)',
      }}
    >
      {sources.map((s, idx) => (
        <ExternalAnchor key={idx} href={s.href}>
          {s.label}
        </ExternalAnchor>
      ))}
      <p
        style={{
          margin: 'var(--v2-space-2) 0 0',
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        Sources captured April 2026. Insurance rules change. Verify against
        the carrier’s current member documents before acting on anything
        load-bearing.
      </p>
    </div>
  )
}

// ── main renderer ───────────────────────────────────────────────

export interface CarrierGuideProps {
  carrier: CarrierGuideData
}

export default function CarrierGuide({ carrier }: CarrierGuideProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
        padding: 'var(--v2-space-4)',
        paddingBottom: 'var(--v2-space-8)',
      }}
    >
      {/* 1. At a glance */}
      <Card>
        <SectionHeading level="h2">At a glance</SectionHeading>
        <div style={{ marginTop: 'var(--v2-space-2)' }}>
          <ValueRow label="Plan types" value={carrier.ataglance.planTypes} />
          <ValueRow label="Regions served" value={carrier.ataglance.regionsServed} />
          <ValueRow label="Member count" value={carrier.ataglance.memberCount} />
        </div>
        {carrier.ataglance.notes && (
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {carrier.ataglance.notes}
          </p>
        )}
      </Card>

      {/* 2. Network */}
      <Card>
        <SectionHeading level="h2">Network</SectionHeading>
        <SectionHeading level="h3">Find an in-network provider</SectionHeading>
        <ExternalAnchor href={carrier.network.findInNetworkUrl}>
          {carrier.network.findInNetworkLabel}
        </ExternalAnchor>

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">Out of network</SectionHeading>
          <Paragraph>{carrier.network.outOfNetworkRule}</Paragraph>
        </div>

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">Prior authorization</SectionHeading>
          <Paragraph>{carrier.network.priorAuthRule}</Paragraph>
        </div>
      </Card>

      {/* 3. Referrals */}
      <Card>
        <SectionHeading level="h2">Referrals</SectionHeading>
        <SectionHeading level="h3">When you need one</SectionHeading>
        <Paragraph>{carrier.referrals.requiredFor}</Paragraph>

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">When you do not</SectionHeading>
          <Paragraph>{carrier.referrals.notRequiredFor}</Paragraph>
        </div>

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">How to request a referral</SectionHeading>
          <Paragraph>{carrier.referrals.howToRequest}</Paragraph>
        </div>

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">If your PCP refuses</SectionHeading>
          <Paragraph>{carrier.referrals.escalationIfDenied}</Paragraph>
        </div>

        <p
          style={{
            margin: 'var(--v2-space-3) 0 0',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
          }}
        >
          See the{' '}
          <Link
            href="/v2/insurance/pcp-explainer"
            style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
          >
            PCP explainer
          </Link>{' '}
          for the full referral script that works across carriers.
        </p>
      </Card>

      {/* 4. Specialist access */}
      <Card>
        <SectionHeading level="h2">Specialist access</SectionHeading>
        <SectionHeading level="h3">Typical wait</SectionHeading>
        <Paragraph>{carrier.specialistAccess.typicalWait}</Paragraph>

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">How to expedite for medical urgency</SectionHeading>
          <Paragraph>{carrier.specialistAccess.expediteForUrgency}</Paragraph>
        </div>
      </Card>

      {/* 5. Tests + procedures */}
      <Card>
        <SectionHeading level="h2">Tests and procedures</SectionHeading>
        <SectionHeading level="h3">Common prior authorization triggers</SectionHeading>
        <BulletList items={carrier.testsAndProcedures.priorAuthThresholds} />

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">Common gotchas</SectionHeading>
          <BulletList items={carrier.testsAndProcedures.commonGotchas} />
        </div>

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">How to push back on a denial</SectionHeading>
          <Paragraph>{carrier.testsAndProcedures.pushBackTactics}</Paragraph>
        </div>
      </Card>

      {/* 6. Appeals */}
      <Card>
        <SectionHeading level="h2">Appeals</SectionHeading>
        <SectionHeading level="h3">Standard appeal window</SectionHeading>
        <Paragraph>{carrier.appeals.standardWindow}</Paragraph>

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">Expedited appeal</SectionHeading>
          <Paragraph>{carrier.appeals.expeditedWindow}</Paragraph>
        </div>

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">External review</SectionHeading>
          <Paragraph>{carrier.appeals.externalReview}</Paragraph>
        </div>

        {carrier.appeals.stateCommissionerNote && (
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {carrier.appeals.stateCommissionerNote}
          </p>
        )}
      </Card>

      {/* 7. Anti-gaslighting strategies */}
      <Card>
        <SectionHeading level="h2">Anti-gaslighting strategies</SectionHeading>
        <SectionHeading level="h3">Known denial patterns</SectionHeading>
        <BulletList items={carrier.antiGaslighting.knownDenialPatterns} />

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">What works to push back</SectionHeading>
          <Paragraph>{carrier.antiGaslighting.whatWorks}</Paragraph>
        </div>
      </Card>

      {/* 8. For chronic illness specifically */}
      <Card>
        <SectionHeading level="h2">For chronic illness specifically</SectionHeading>

        {carrier.chronicIllness.potsNotes && (
          <div style={{ marginBottom: 'var(--v2-space-3)' }}>
            <SectionHeading level="h3">POTS and dysautonomia</SectionHeading>
            <Paragraph>{carrier.chronicIllness.potsNotes}</Paragraph>
          </div>
        )}

        {carrier.chronicIllness.migraineNotes && (
          <div style={{ marginBottom: 'var(--v2-space-3)' }}>
            <SectionHeading level="h3">Migraine</SectionHeading>
            <Paragraph>{carrier.chronicIllness.migraineNotes}</Paragraph>
          </div>
        )}

        {carrier.chronicIllness.edsMcasNotes && (
          <div style={{ marginBottom: 'var(--v2-space-3)' }}>
            <SectionHeading level="h3">EDS and MCAS</SectionHeading>
            <Paragraph>{carrier.chronicIllness.edsMcasNotes}</Paragraph>
          </div>
        )}

        <div>
          <SectionHeading level="h3">General chronic illness tips</SectionHeading>
          <Paragraph>{carrier.chronicIllness.generalNotes}</Paragraph>
        </div>
      </Card>

      {/* 9. Contact + member services */}
      <Card>
        <SectionHeading level="h2">Contact and member services</SectionHeading>
        <SectionHeading level="h3">Member portal</SectionHeading>
        <ExternalAnchor href={carrier.memberServices.portalUrl}>
          {carrier.memberServices.portalLabel}
        </ExternalAnchor>

        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <SectionHeading level="h3">Phone</SectionHeading>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
            }}
          >
            {carrier.memberServices.phones.map((phone, idx) => (
              <PhoneAnchor key={idx} contact={phone} />
            ))}
          </div>
        </div>
      </Card>

      {/* Sources */}
      <Card>
        <SectionHeading level="h2">Sources</SectionHeading>
        <SourcesBlock sources={carrier.sources} />
      </Card>
    </div>
  )
}
