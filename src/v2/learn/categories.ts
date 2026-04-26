/*
 * Learn module: category catalog
 *
 * 8 categories scaffolded; the first 4 ship populated articles in this
 * PR. The remaining 4 (cycle health, lifestyle factors, conditions,
 * chronic illness + cycle) are scaffolded as empty buckets, surfaced
 * on the hub with a "More articles soon" hint, so the IA is in place
 * for follow-up content drops without a routing churn.
 */

import type { LearnCategory, LearnCategorySlug } from './types'

export const CATEGORIES: LearnCategory[] = [
  {
    slug: 'cycle-basics',
    title: 'Cycle basics',
    blurb: 'How cycles work, the four phases, what is typical, what is not.',
    accent: 'var(--v2-accent-primary)',
  },
  {
    slug: 'fertility-awareness',
    title: 'Fertility awareness',
    blurb: 'How the algorithm reads BBT, what LH tests measure, mucus changes.',
    accent: 'var(--v2-ring-readiness)',
  },
  {
    slug: 'period-basics',
    title: 'Period basics',
    blurb: 'Flow patterns, period pain when normal versus when to call your doctor.',
    accent: 'var(--v2-ring-activity)',
  },
  {
    slug: 'hormones',
    title: 'Hormones',
    blurb: 'Estrogen, progesterone, and how to tell when something is off.',
    accent: 'var(--v2-ring-sleep)',
  },
  {
    slug: 'cycle-health',
    title: 'Cycle health',
    blurb: 'What makes a cycle healthy, anovulatory cycles, when to seek help.',
    accent: 'var(--v2-surface-explanatory-accent)',
  },
  {
    slug: 'lifestyle-factors',
    title: 'Lifestyle factors',
    blurb: 'Sleep, stress, nutrition, exercise, alcohol. How each touches your cycle.',
    accent: 'var(--v2-accent-highlight)',
  },
  {
    slug: 'conditions',
    title: 'Conditions',
    blurb: 'PCOS, endometriosis, PMDD, thyroid, perimenopause. When to suspect each.',
    accent: 'var(--v2-accent-primary)',
  },
  {
    slug: 'chronic-illness-cycle',
    title: 'For chronic illness',
    blurb: 'POTS, migraine, EDS. Where the cycle and your other conditions overlap.',
    accent: 'var(--v2-ring-readiness)',
  },
]

export const CATEGORY_BY_SLUG: Record<LearnCategorySlug, LearnCategory> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.slug] = c
    return acc
  },
  {} as Record<LearnCategorySlug, LearnCategory>,
)
