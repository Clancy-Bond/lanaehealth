/*
 * RelatedArticles
 *
 * Foot of an article: vertical list of related slugs resolved through
 * the catalog. Silently skips slugs the catalog does not know about
 * so a typo in the article data never crashes a page.
 */
import Link from 'next/link'
import { ARTICLE_BY_SLUG } from '@/v2/learn/catalog'

interface RelatedArticlesProps {
  slugs: string[]
}

export default function RelatedArticles({ slugs }: RelatedArticlesProps) {
  const items = slugs.map((s) => ARTICLE_BY_SLUG[s]).filter(Boolean)
  if (items.length === 0) return null
  return (
    <section
      aria-labelledby="learn-related-heading"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
        marginTop: 'var(--v2-space-4)',
      }}
    >
      <h2
        id="learn-related-heading"
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        Related
      </h2>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        {items.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/v2/learn/${article.slug}`}
              style={{
                display: 'block',
                background: 'var(--v2-bg-card)',
                border: '1px solid var(--v2-border-subtle)',
                borderRadius: 'var(--v2-radius-md)',
                padding: 'var(--v2-space-3) var(--v2-space-4)',
                color: 'var(--v2-text-primary)',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--v2-text-base)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  lineHeight: 'var(--v2-leading-snug)',
                }}
              >
                {article.title}
              </div>
              <div
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  marginTop: 'var(--v2-space-1)',
                  lineHeight: 'var(--v2-leading-normal)',
                }}
              >
                {article.subhead}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
