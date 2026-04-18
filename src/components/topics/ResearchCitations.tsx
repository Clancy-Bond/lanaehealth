/**
 * Research Citations footer for topic pages.
 *
 * Signals clinical authority the way Clue (Oxford/Berkeley/MIT) and
 * N1-Headache ("scientifically discover factors") do. We don't have
 * research partnerships yet, but we cite real peer-reviewed papers
 * throughout the reasoning overlays (readiness-context.ts, the
 * orthostatic explainer, nutrition's POTS sodium callout). Surfacing
 * those citations as a visible footer reminds the reader that the
 * content is grounded.
 *
 * Per-topic citation lists. Keep them to 3-5 links each; it is a
 * signal, not a literature review.
 */

export interface Citation {
  label: string;
  url: string;
  /** Short tag like "PMC6936126" or "Oura Support". */
  source: string;
}

interface Props {
  /** Short list of citations for the topic at hand. */
  citations: Citation[];
  /**
   * Optional caption overriding the default "Based on clinical research".
   * Useful when the topic blends clinical + product sources (e.g. Oura docs).
   */
  caption?: string;
}

export function ResearchCitations({ citations, caption }: Props) {
  if (citations.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="none"
          style={{ color: 'var(--accent-sage)' }}
          aria-hidden
        >
          <path
            d="M4 5a2 2 0 012-2h7l4 4v8a2 2 0 01-2 2H6a2 2 0 01-2-2V5z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M13 3v4h4M7 10h6M7 13h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        {caption ?? 'Based on clinical research'}
      </div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {citations.map((c) => (
          <li key={c.url} style={{ fontSize: 12, lineHeight: 1.5 }}>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-secondary)',
                textDecoration: 'none',
              }}
            >
              {c.label}{' '}
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                ({c.source}) &#x2197;
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
