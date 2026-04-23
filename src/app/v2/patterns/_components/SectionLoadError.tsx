/**
 * SectionLoadError
 *
 * Inline failure chip for a single patterns section. Mirrors the
 * shape of CaloriesLoadError but smaller, since it sits inside a
 * larger compound page rather than replacing the whole shell.
 *
 * Used when a particular data source (correlations, day totals,
 * cycle context) fails while peers succeed. The page still renders;
 * the failed section reads as honest and recoverable instead of
 * silently empty.
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'

export interface SectionLoadErrorProps {
  /** What we failed to load, in plain language. e.g. "the calorie trend". */
  what: string
  /** Where to point the retry link. Defaults to the same path the user is on. */
  retryHref: string
}

export default function SectionLoadError({ what, retryHref }: SectionLoadErrorProps) {
  return (
    <Card variant="explanatory" padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          {`We could not load ${what} just now. Usually a brief network blip; the underlying records are safe.`}
        </p>
        <Link
          href={retryHref}
          style={{
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-accent-primary)',
            textDecoration: 'none',
            alignSelf: 'flex-start',
          }}
        >
          Try again
        </Link>
      </div>
    </Card>
  )
}
