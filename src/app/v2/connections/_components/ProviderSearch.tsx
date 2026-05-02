'use client'

/*
 * ProviderSearch
 *
 * Search box + matching cards for the seeded provider directory.
 * The user types a hospital, lab, or practice name and we surface
 * the right ingestion path with concrete next-step copy. The data
 * lives in src/lib/integrations/provider-directory.ts; this is the
 * presentation surface.
 *
 * Today the directory covers Oahu and the major national labs Oahu
 * patients touch. Adding new regions is purely a data change.
 */

import { useMemo, useState } from 'react'
import { Card, Button } from '@/v2/components/primitives'
import {
  PROVIDERS,
  PATH_DESCRIPTIONS,
  type Provider,
  type IngestionPath,
} from '@/lib/integrations/provider-directory'

const PATH_LABEL: Record<IngestionPath, string> = {
  'apple-health-records': 'Apple Health Records',
  'fhir-direct': 'Connect via FHIR',
  aggregator: 'Connected health network',
  'email-ingest': 'Forward emails',
  'manual-upload': 'Upload a file',
  'browser-extension': 'Browser extension',
}

const CATEGORY_LABEL: Record<Provider['category'], string> = {
  hospital: 'Hospital',
  clinic: 'Clinic',
  lab: 'Lab',
  imaging: 'Imaging',
  specialty: 'Specialty',
  'urgent-care': 'Urgent care',
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics so "Wahiawā" matches "Wahiawa"
}

export default function ProviderSearch() {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const matches = useMemo(() => {
    const q = normalize(query.trim())
    if (q.length === 0) return PROVIDERS
    return PROVIDERS.filter((p) => {
      const haystack = normalize(
        [p.name, p.id, p.ehr ?? '', p.region, CATEGORY_LABEL[p.category]].join(' '),
      )
      return haystack.includes(q)
    })
  }, [query])

  return (
    <Card padding="md">
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-base)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-primary)',
        }}
      >
        Find your provider
      </h2>
      <p
        style={{
          margin: '4px 0 12px 0',
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        Search a hospital, clinic, lab, or practice and we'll tell you the
        fastest way to pull your records in. Oahu and the major national
        labs are seeded today; more regions coming.
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Queen's, Adventist, DLS, Quest, ..."
        aria-label="Search providers"
        style={{
          width: '100%',
          minHeight: 44,
          padding: '0 var(--v2-space-3)',
          borderRadius: 'var(--v2-radius-md)',
          border: '1px solid var(--v2-border-subtle)',
          background: 'var(--v2-bg-elevated)',
          color: 'var(--v2-text-primary)',
          fontSize: 'var(--v2-text-base)',
          fontFamily: 'inherit',
          marginBottom: 'var(--v2-space-3)',
          boxSizing: 'border-box',
        }}
      />

      {matches.length === 0 ? (
        <p
          style={{
            margin: '8px 0',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-muted)',
          }}
        >
          No match yet. If your provider isn't listed, file upload always
          works — open the file-import card below.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          {matches.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              expanded={openId === p.id}
              onToggle={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function ProviderRow({
  provider,
  expanded,
  onToggle,
}: {
  provider: Provider
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <li
      style={{
        padding: 'var(--v2-space-3)',
        borderRadius: 'var(--v2-radius-sm)',
        background: 'var(--v2-bg-elevated)',
        border: '1px solid var(--v2-border-subtle)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          width: '100%',
          background: 'transparent',
          border: 0,
          padding: 0,
          textAlign: 'left',
          color: 'inherit',
          font: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              gap: 'var(--v2-space-2)',
              alignItems: 'baseline',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 'var(--v2-text-sm)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
                overflowWrap: 'anywhere',
              }}
            >
              {provider.name}
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
              }}
            >
              {CATEGORY_LABEL[provider.category]}
              {provider.ehr && provider.ehr !== 'Unknown' && provider.ehr !== 'Other'
                ? ` · ${provider.ehr}`
                : ''}
            </span>
          </div>
          <span
            style={{
              display: 'inline-block',
              marginTop: 4,
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-accent-primary)',
            }}
          >
            {PATH_LABEL[provider.primaryPath]}
          </span>
        </div>
        <span
          aria-hidden
          style={{
            color: 'var(--v2-text-muted)',
            fontSize: 'var(--v2-text-base)',
          }}
        >
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <div
          style={{
            marginTop: 'var(--v2-space-3)',
            paddingTop: 'var(--v2-space-3)',
            borderTop: '1px solid var(--v2-border-subtle)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            <strong style={{ color: 'var(--v2-text-primary)' }}>
              How to connect:
            </strong>{' '}
            {PATH_DESCRIPTIONS[provider.primaryPath]}
          </p>

          {provider.appleHealthRecordsName &&
            provider.primaryPath === 'apple-health-records' && (
              <p
                style={{
                  margin: '8px 0 0 0',
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                }}
              >
                Apple search term: <code>{provider.appleHealthRecordsName}</code>
              </p>
            )}

          {provider.note && (
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              {provider.note}
            </p>
          )}

          {provider.fallbackPaths.length > 0 && (
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
              }}
            >
              Fallbacks:{' '}
              {provider.fallbackPaths
                .map((f) => PATH_LABEL[f])
                .join(' · ')}
            </p>
          )}

          {provider.portalUrl && (
            <div style={{ marginTop: 'var(--v2-space-3)' }}>
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => window.open(provider.portalUrl, '_blank', 'noopener,noreferrer')}
              >
                Open provider portal
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
