/*
 * /v2/learn/[slug] (server component, statically generated)
 *
 * One Learn article per route. Pulled from the static catalog at
 * src/v2/learn/. Article body, citations, and related links are
 * rendered through the local _components.
 *
 * Builds at request-or-build time via generateStaticParams; export
 * `dynamic = 'force-static'` so the routes ship pre-rendered.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { ARTICLES, getArticle } from '@/v2/learn/catalog'
import { CATEGORY_BY_SLUG } from '@/v2/learn/categories'
import ArticleBody from '../_components/ArticleBody'
import CitationList from '../_components/CitationList'
import RelatedArticles from '../_components/RelatedArticles'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }))
}

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return { title: 'Learn' }
  return {
    title: `${article.title} | Learn`,
    description: article.subhead,
  }
}

export default async function V2LearnArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) {
    notFound()
  }
  const category = CATEGORY_BY_SLUG[article.category]

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Learn"
          leading={
            <Link
              href="/v2/learn"
              aria-label="Back to Learn"
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
      <article
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-5)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-10)',
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        <header
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          <Link
            href={`/v2/learn#learn-cat-${category.slug}`}
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: category.accent,
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-semibold)',
              textDecoration: 'none',
            }}
          >
            {category.title}
          </Link>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-3xl)',
              fontWeight: 'var(--v2-weight-bold)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-snug)',
              letterSpacing: 'var(--v2-tracking-tight)',
            }}
          >
            {article.title}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {article.subhead}
          </p>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-secondary)',
              marginTop: 'var(--v2-space-1)',
            }}
          >
            {article.readingMinutes} min read
          </span>
        </header>

        <ArticleBody blocks={article.body} citations={article.citations} />

        <CitationList citations={article.citations} />

        <RelatedArticles slugs={article.related} />
      </article>
    </MobileShell>
  )
}
