/*
 * CitationList
 *
 * Renders the article's source list. Each entry has a stable id
 * (#cite-LABEL) so inline [LABEL] markers in the body can deep-link.
 */
import type { Citation } from '@/v2/learn/types'

interface CitationListProps {
  citations: Citation[]
}

export default function CitationList({ citations }: CitationListProps) {
  if (citations.length === 0) return null
  return (
    <section
      aria-labelledby="learn-sources-heading"
      data-testid="citation-list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
        marginTop: 'var(--v2-space-4)',
      }}
    >
      <h2
        id="learn-sources-heading"
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        Sources
      </h2>
      <ol
        style={{
          margin: 0,
          paddingLeft: 'var(--v2-space-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
          fontSize: 'var(--v2-text-sm)',
          lineHeight: 'var(--v2-leading-relaxed)',
          color: 'var(--v2-text-secondary)',
        }}
      >
        {citations.map((c) => (
          <li key={c.label} id={`cite-${c.label.replace(/\s+/g, '-')}`}>
            <span style={{ color: 'var(--v2-text-primary)' }}>[{c.label}]</span>{' '}
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--v2-accent-primary)',
                textDecoration: 'none',
              }}
            >
              {c.title}
            </a>
            <span> {c.publisher}.</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
