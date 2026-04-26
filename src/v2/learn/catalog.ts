/*
 * Learn module: catalog index
 *
 * Single source of truth for the article inventory. The hub page,
 * the dynamic article route, the cross-link components, and the E2E
 * tests all read from here. Keep imports cheap (these files are pure
 * data with no React or runtime dependencies).
 *
 * The first 4 categories ship with 3 articles each (12 total). The
 * remaining 4 categories are scaffolded as empty buckets and surfaced
 * on the hub with a "More articles soon" hint per the audit roadmap.
 */

import type { LearnArticle, LearnCategorySlug } from './types'
import { CYCLE_BASICS_ARTICLES } from './articles/cycle-basics'
import { FERTILITY_AWARENESS_ARTICLES } from './articles/fertility-awareness'
import { PERIOD_BASICS_ARTICLES } from './articles/period-basics'
import { HORMONES_ARTICLES } from './articles/hormones'

export const ARTICLES: LearnArticle[] = [
  ...CYCLE_BASICS_ARTICLES,
  ...FERTILITY_AWARENESS_ARTICLES,
  ...PERIOD_BASICS_ARTICLES,
  ...HORMONES_ARTICLES,
]

export const ARTICLE_BY_SLUG: Record<string, LearnArticle> = ARTICLES.reduce(
  (acc, a) => {
    acc[a.slug] = a
    return acc
  },
  {} as Record<string, LearnArticle>,
)

export function articlesInCategory(slug: LearnCategorySlug): LearnArticle[] {
  return ARTICLES.filter((a) => a.category === slug)
}

export function getArticle(slug: string): LearnArticle | null {
  return ARTICLE_BY_SLUG[slug] ?? null
}
