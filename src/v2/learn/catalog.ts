/*
 * Learn module: catalog index
 *
 * Single source of truth for the article inventory. The hub page,
 * the dynamic article route, the cross-link components, and the E2E
 * tests all read from here. Keep imports cheap (these files are pure
 * data with no React or runtime dependencies).
 *
 * All 8 categories now ship with 3 articles each (24 total). The
 * second wave (cycle health, lifestyle factors, conditions, chronic
 * illness + cycle) was added in the Learn tab expansion follow-up.
 */

import type { LearnArticle, LearnCategorySlug } from './types'
import { CYCLE_BASICS_ARTICLES } from './articles/cycle-basics'
import { FERTILITY_AWARENESS_ARTICLES } from './articles/fertility-awareness'
import { PERIOD_BASICS_ARTICLES } from './articles/period-basics'
import { HORMONES_ARTICLES } from './articles/hormones'
import { CYCLE_HEALTH_ARTICLES } from './articles/cycle-health'
import { LIFESTYLE_FACTORS_ARTICLES } from './articles/lifestyle-factors'
import { CONDITIONS_ARTICLES } from './articles/conditions'
import { CHRONIC_ILLNESS_CYCLE_ARTICLES } from './articles/chronic-illness-cycle'

export const ARTICLES: LearnArticle[] = [
  ...CYCLE_BASICS_ARTICLES,
  ...FERTILITY_AWARENESS_ARTICLES,
  ...PERIOD_BASICS_ARTICLES,
  ...HORMONES_ARTICLES,
  ...CYCLE_HEALTH_ARTICLES,
  ...LIFESTYLE_FACTORS_ARTICLES,
  ...CONDITIONS_ARTICLES,
  ...CHRONIC_ILLNESS_CYCLE_ARTICLES,
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
