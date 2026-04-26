/*
 * ArticleBody
 *
 * Renders an article's structured body blocks. Every block kind
 * maps to a small piece of layout. Inline citation labels (e.g. [ACOG])
 * inside paragraph text are auto-linked to the matching citation in
 * the citations list at the foot of the page.
 *
 * Pure server component, no client hooks, no runtime fetches.
 */
import type { ArticleBlock, Citation } from '@/v2/learn/types'

interface ArticleBodyProps {
  blocks: ArticleBlock[]
  citations: Citation[]
}

function renderInline(text: string, citations: Citation[]): React.ReactNode {
  // Replace [LABEL] tokens with anchor links to the matching citation.
  // We split on the bracketed pattern and rebuild the children list with
  // the matched labels turned into <a href="#cite-LABEL"> nodes.
  const labelSet = new Set(citations.map((c) => c.label))
  const parts: React.ReactNode[] = []
  const re = /\[([^\]]+)\]/g
  let lastIndex = 0
  let key = 0
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0
    const before = text.slice(lastIndex, idx)
    if (before) parts.push(before)
    const label = m[1]
    if (labelSet.has(label)) {
      parts.push(
        <a
          key={`cite-${key++}`}
          href={`#cite-${label.replace(/\s+/g, '-')}`}
          style={{
            color: 'var(--v2-accent-primary)',
            fontSize: '0.85em',
            textDecoration: 'none',
            verticalAlign: 'baseline',
            padding: '0 0.15em',
          }}
        >
          [{label}]
        </a>,
      )
    } else {
      parts.push(m[0])
    }
    lastIndex = idx + m[0].length
  }
  const tail = text.slice(lastIndex)
  if (tail) parts.push(tail)
  return parts
}

export default function ArticleBody({ blocks, citations }: ArticleBodyProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
      }}
    >
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'p':
            return (
              <p
                key={i}
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-base)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                {renderInline(block.text, citations)}
              </p>
            )
          case 'h2':
            return (
              <h2
                key={i}
                style={{
                  margin: 0,
                  marginTop: 'var(--v2-space-3)',
                  fontSize: 'var(--v2-text-xl)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                  lineHeight: 'var(--v2-leading-snug)',
                }}
              >
                {block.text}
              </h2>
            )
          case 'h3':
            return (
              <h3
                key={i}
                style={{
                  margin: 0,
                  marginTop: 'var(--v2-space-2)',
                  fontSize: 'var(--v2-text-lg)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                  lineHeight: 'var(--v2-leading-snug)',
                }}
              >
                {block.text}
              </h3>
            )
          case 'ul':
            return (
              <ul
                key={i}
                style={{
                  margin: 0,
                  paddingLeft: 'var(--v2-space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--v2-space-2)',
                  fontSize: 'var(--v2-text-base)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item, citations)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol
                key={i}
                style={{
                  margin: 0,
                  paddingLeft: 'var(--v2-space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--v2-space-2)',
                  fontSize: 'var(--v2-text-base)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item, citations)}</li>
                ))}
              </ol>
            )
          case 'callout': {
            const isCaution = block.tone === 'caution'
            return (
              <div
                key={i}
                role="note"
                style={{
                  borderLeft: `3px solid ${isCaution ? 'var(--v2-status-danger, #E5484D)' : 'var(--v2-accent-primary)'}`,
                  background: 'var(--v2-bg-elevated)',
                  borderRadius: 'var(--v2-radius-md)',
                  padding: 'var(--v2-space-3) var(--v2-space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--v2-space-1)',
                }}
              >
                {block.title && (
                  <span
                    style={{
                      fontSize: 'var(--v2-text-sm)',
                      fontWeight: 'var(--v2-weight-semibold)',
                      color: 'var(--v2-text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: 'var(--v2-tracking-wide)',
                    }}
                  >
                    {block.title}
                  </span>
                )}
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--v2-text-sm)',
                    lineHeight: 'var(--v2-leading-relaxed)',
                    color: 'var(--v2-text-secondary)',
                  }}
                >
                  {renderInline(block.text, citations)}
                </p>
              </div>
            )
          }
          case 'forYou':
            return (
              <div
                key={i}
                data-testid="for-you-callout"
                style={{
                  background: 'var(--v2-surface-explanatory-card)',
                  color: 'var(--v2-surface-explanatory-text)',
                  border: '1px solid var(--v2-surface-explanatory-border)',
                  borderRadius: 'var(--v2-radius-lg)',
                  padding: 'var(--v2-space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--v2-space-2)',
                  boxShadow: 'var(--v2-shadow-explanatory-sm)',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-surface-explanatory-accent)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--v2-tracking-wide)',
                  }}
                >
                  {block.title}
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--v2-text-base)',
                    lineHeight: 'var(--v2-leading-relaxed)',
                    color: 'var(--v2-surface-explanatory-text)',
                  }}
                >
                  {block.text}
                </p>
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
