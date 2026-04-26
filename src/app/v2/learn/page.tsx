/*
 * /v2/learn (server component)
 *
 * The Learn hub. NC-style educational library: a list of categories,
 * each surfacing the articles that have shipped, with a quiet "more
 * soon" hint for categories that are scaffolded but not yet populated.
 *
 * Pure RSC. No client hooks, no runtime fetches; the catalog is built
 * at build time.
 */
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import { CATEGORIES } from '@/v2/learn/categories'
import { articlesInCategory, ARTICLES } from '@/v2/learn/catalog'

export const dynamic = 'force-static'

export const metadata = {
  title: 'Learn',
  description:
    'Plain-English explainers on cycle, fertility awareness, periods, hormones, and how chronic conditions can interact with the cycle.',
}

export default function V2LearnHubPage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Learn"
          leading={
            <Link
              href="/v2"
              aria-label="Back to home"
              style={{
                color: 'var(--v2-text-secondary)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                minWidth: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        <Card variant="explanatory">
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-surface-explanatory-text)',
              lineHeight: 'var(--v2-leading-snug)',
            }}
          >
            Honest, with context.
          </h2>
          <p
            style={{
              margin: 0,
              marginTop: 'var(--v2-space-2)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-surface-explanatory-text)',
              opacity: 0.85,
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Plain-English articles on cycles, hormones, and what to ask your
            doctor. Every clinical claim is sourced.
          </p>
        </Card>

        {CATEGORIES.map((cat) => {
          const articles = articlesInCategory(cat.slug)
          const hasArticles = articles.length > 0
          return (
            <section
              key={cat.slug}
              aria-labelledby={`learn-cat-${cat.slug}`}
              data-testid={`learn-category-${cat.slug}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--v2-space-2)',
              }}
            >
              <header
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--v2-space-1)',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    color: cat.accent,
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--v2-tracking-wide)',
                    fontWeight: 'var(--v2-weight-semibold)',
                  }}
                >
                  {cat.title}
                </span>
                <h2
                  id={`learn-cat-${cat.slug}`}
                  style={{
                    margin: 0,
                    fontSize: 'var(--v2-text-lg)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-text-primary)',
                    lineHeight: 'var(--v2-leading-snug)',
                  }}
                >
                  {cat.blurb}
                </h2>
              </header>

              {hasArticles ? (
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
                  {articles.map((article) => (
                    <li key={article.slug}>
                      <Link
                        href={`/v2/learn/${article.slug}`}
                        data-testid="learn-article-link"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 'var(--v2-space-3)',
                          background: 'var(--v2-bg-card)',
                          border: '1px solid var(--v2-border-subtle)',
                          borderRadius: 'var(--v2-radius-md)',
                          padding: 'var(--v2-space-3) var(--v2-space-4)',
                          color: 'var(--v2-text-primary)',
                          textDecoration: 'none',
                          minHeight: 'var(--v2-touch-target-min)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--v2-space-1)',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 'var(--v2-text-base)',
                              fontWeight: 'var(--v2-weight-semibold)',
                              lineHeight: 'var(--v2-leading-snug)',
                            }}
                          >
                            {article.title}
                          </span>
                          <span
                            style={{
                              fontSize: 'var(--v2-text-sm)',
                              color: 'var(--v2-text-secondary)',
                              lineHeight: 'var(--v2-leading-normal)',
                            }}
                          >
                            {article.subhead}
                          </span>
                          <span
                            style={{
                              fontSize: 'var(--v2-text-xs)',
                              color: 'var(--v2-text-tertiary, var(--v2-text-secondary))',
                              marginTop: 'var(--v2-space-1)',
                            }}
                          >
                            {article.readingMinutes} min read
                          </span>
                        </div>
                        <ChevronRight
                          size={18}
                          strokeWidth={1.5}
                          aria-hidden="true"
                          style={{ color: 'var(--v2-text-secondary)', flexShrink: 0 }}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Card padding="md">
                  <span
                    style={{
                      fontSize: 'var(--v2-text-sm)',
                      color: 'var(--v2-text-secondary)',
                      lineHeight: 'var(--v2-leading-relaxed)',
                    }}
                  >
                    More articles coming here soon.
                  </span>
                </Card>
              )}
            </section>
          )
        })}

        <p
          style={{
            margin: 0,
            marginTop: 'var(--v2-space-4)',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
            textAlign: 'center',
          }}
        >
          {ARTICLES.length} articles published. Every clinical claim sourced
          to ACOG, the Office on Women&apos;s Health, or Mayo Clinic.
        </p>
      </div>
    </MobileShell>
  )
}
