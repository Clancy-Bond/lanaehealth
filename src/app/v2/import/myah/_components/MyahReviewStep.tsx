'use client'

/*
 * MyahReviewStep
 *
 * Step 3 of the MyAH paste importer. Renders one ListRow per parsed
 * record with a trash glyph in the trailing slot for pre-import
 * deletion. Primary "Import N items" button posts to
 * /api/import/myah?action=import, and on success the wizard routes
 * Lanae to the entity's v2 destination (labs, records, settings).
 *
 * Row rendering switches on entityType:
 *   labs          -> "Test: value unit" + date + reference range + flag badge
 *   appointments  -> doctor/specialty + date/reason
 *   medications   -> name + dose/frequency
 *   notes         -> title + date + provider
 *
 * Warnings from the parser are surfaced above the list but do not
 * block import (Claude returns them for ambiguity, not invalidity).
 */
import {
  Banner,
  Button,
  EmptyState,
  ListRow,
} from '@/v2/components/primitives'
import type { MyahEntityType, MyahParsedRecord } from './MyahWizard'

interface FlagStyle {
  accent: string
  soft: string
  label: string
}

const FLAG_STYLES: Record<string, FlagStyle> = {
  normal: {
    accent: 'var(--v2-accent-success)',
    soft: 'rgba(106, 207, 137, 0.15)',
    label: 'Normal',
  },
  low: {
    accent: 'var(--v2-accent-warning)',
    soft: 'rgba(217, 119, 92, 0.15)',
    label: 'Low',
  },
  high: {
    accent: 'var(--v2-accent-warning)',
    soft: 'rgba(217, 119, 92, 0.15)',
    label: 'High',
  },
  critical: {
    accent: 'var(--v2-accent-danger)',
    soft: 'rgba(239, 93, 93, 0.15)',
    label: 'Critical',
  },
}

function asString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function FlagBadge({ flag }: { flag: string }) {
  const style = FLAG_STYLES[flag]
  if (!style) return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px var(--v2-space-2)',
        borderRadius: 'var(--v2-radius-full)',
        background: style.soft,
        color: style.accent,
        fontSize: 'var(--v2-text-xs)',
        fontWeight: 'var(--v2-weight-semibold)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--v2-tracking-wide)',
      }}
    >
      {style.label}
    </span>
  )
}

function TrashButton({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 44,
        height: 44,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 0,
        color: 'var(--v2-text-muted)',
        cursor: 'pointer',
        borderRadius: 'var(--v2-radius-full)',
        fontFamily: 'inherit',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path
          d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function renderRow(
  entityType: MyahEntityType,
  record: MyahParsedRecord,
  index: number,
  onRemoveAt: (index: number) => void,
  divider: boolean
) {
  const parsed = record.parsed
  const trailingTrash = (
    <TrashButton
      onClick={() => onRemoveAt(index)}
      ariaLabel={`Remove row ${index + 1} before import`}
    />
  )

  if (entityType === 'labs') {
    const testName = asString(parsed.test_name) ?? 'Unknown test'
    const value = asNumber(parsed.value)
    const unit = asString(parsed.unit)
    const valueStr = value !== null ? `${value}${unit ? ` ${unit}` : ''}` : 'no value'
    const date = asString(parsed.date) ?? 'no date'
    const low = asNumber(parsed.reference_range_low)
    const high = asNumber(parsed.reference_range_high)
    const lowStr = low !== null ? String(low) : '-'
    const highStr = high !== null ? String(high) : '-'
    const flag = asString(parsed.flag)
    return renderListRow({
      key: `${index}-${testName}`,
      label: `${testName}: ${valueStr}`,
      subtext: `${date} - ref ${lowStr} to ${highStr}`,
      trailing: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--v2-space-2)',
          }}
        >
          {flag && <FlagBadge flag={flag} />}
          {trailingTrash}
        </div>
      ),
      divider,
    })
  }

  if (entityType === 'appointments') {
    const doctor = asString(parsed.doctor_name)
    const specialty = asString(parsed.specialty)
    const label = doctor ?? specialty ?? 'Appointment'
    const date = asString(parsed.date) ?? 'no date'
    const reason = asString(parsed.reason)
    const subtext = reason ? `${date} - ${reason}` : date
    return renderListRow({
      key: `${index}-${label}`,
      label,
      subtext,
      trailing: trailingTrash,
      divider,
    })
  }

  if (entityType === 'medications') {
    const name = asString(parsed.name) ?? 'Unknown medication'
    const dose = asString(parsed.dose)
    const frequency = asString(parsed.frequency)
    const subtextParts = [dose, frequency].filter(Boolean) as string[]
    const subtext = subtextParts.length > 0 ? subtextParts.join(' - ') : undefined
    return renderListRow({
      key: `${index}-${name}`,
      label: name,
      subtext,
      trailing: trailingTrash,
      divider,
    })
  }

  // notes
  const title = asString(parsed.title) ?? 'Untitled note'
  const date = asString(parsed.date)
  const provider = asString(parsed.provider)
  const subtextParts = [date, provider].filter(Boolean) as string[]
  const subtext = subtextParts.length > 0 ? subtextParts.join(' - ') : undefined
  return renderListRow({
    key: `${index}-${title}`,
    label: title,
    subtext,
    trailing: trailingTrash,
    divider,
  })
}

function renderListRow({
  key,
  label,
  subtext,
  trailing,
  divider,
}: {
  key: string
  label: string
  subtext?: string
  trailing: React.ReactNode
  divider: boolean
}) {
  return (
    <ListRow
      key={key}
      label={label}
      subtext={subtext}
      trailing={trailing}
      divider={divider}
    />
  )
}

function destinationLabel(entityType: MyahEntityType): string {
  switch (entityType) {
    case 'labs':
      return 'labs'
    case 'appointments':
      return 'your timeline'
    case 'medications':
      return 'settings'
    case 'notes':
      return 'your timeline'
  }
}

function entityNoun(entityType: MyahEntityType, count: number): string {
  const isOne = count === 1
  switch (entityType) {
    case 'labs':
      return isOne ? 'result' : 'results'
    case 'appointments':
      return isOne ? 'appointment' : 'appointments'
    case 'medications':
      return isOne ? 'medication' : 'medications'
    case 'notes':
      return isOne ? 'note' : 'notes'
  }
}

export interface MyahReviewStepProps {
  entityType: MyahEntityType
  parsed: MyahParsedRecord[]
  warnings: string[]
  importing: boolean
  error: string | null
  onRemoveAt: (index: number) => void
  onBack: () => void
  onStartOver: () => void
  onImport: () => void
}

export default function MyahReviewStep({
  entityType,
  parsed,
  warnings,
  importing,
  error,
  onRemoveAt,
  onBack,
  onStartOver,
  onImport,
}: MyahReviewStepProps) {
  const count = parsed.length
  const noun = entityNoun(entityType, count)
  const dest = destinationLabel(entityType)

  if (count === 0) {
    return (
      <section
        aria-label="No records to import"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
        }}
      >
        <EmptyState
          headline="Nothing left to import"
          subtext="You removed every parsed record. Go back and paste again, or start over."
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-3)',
          }}
        >
          <Button type="button" variant="secondary" size="lg" fullWidth onClick={onBack}>
            Back
          </Button>
          <Button type="button" variant="tertiary" size="md" fullWidth onClick={onStartOver}>
            Start over
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="Review parsed records"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-xs)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
            color: 'var(--v2-text-muted)',
            fontWeight: 'var(--v2-weight-semibold)',
          }}
        >
          Review
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          {count} {noun} ready to import. Tap the trash on a row to leave it
          out. When it looks right, import to {dest}.
        </p>
      </div>

      {warnings.length > 0 && (
        <Banner
          intent="warning"
          title="Heads up"
          body={
            warnings.length === 1
              ? warnings[0]
              : `${warnings[0]} (+${warnings.length - 1} more)`
          }
        />
      )}

      <div
        style={{
          background: 'var(--v2-bg-card)',
          border: '1px solid var(--v2-border-subtle)',
          borderRadius: 'var(--v2-radius-lg)',
          padding: '0 var(--v2-space-4)',
        }}
      >
        {parsed.map((record, i) =>
          renderRow(entityType, record, i, onRemoveAt, i < parsed.length - 1)
        )}
      </div>

      {error && (
        <Banner intent="danger" title="Could not import" body={error} />
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={onImport}
          disabled={importing}
        >
          {importing ? 'Importing...' : `Import ${count} ${noun}`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          fullWidth
          onClick={onBack}
          disabled={importing}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="tertiary"
          size="md"
          fullWidth
          onClick={onStartOver}
          disabled={importing}
        >
          Start over
        </Button>
      </div>
    </section>
  )
}
