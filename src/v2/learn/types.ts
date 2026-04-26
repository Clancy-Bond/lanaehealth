/*
 * Learn module: types
 *
 * Articles are catalog entries with structured body content, sourced
 * citations, and category grouping. Body is a discriminated-union of
 * blocks so the renderer can lay out paragraphs, headings, lists,
 * pull-quotes, and "for you" personalization callouts uniformly.
 *
 * No engine changes here; this is a static content catalog read at
 * build time and rendered as RSC.
 */

export type LearnCategorySlug =
  | 'cycle-basics'
  | 'fertility-awareness'
  | 'period-basics'
  | 'hormones'
  | 'cycle-health'
  | 'lifestyle-factors'
  | 'conditions'
  | 'chronic-illness-cycle'

export interface LearnCategory {
  slug: LearnCategorySlug
  title: string
  blurb: string
  /** Hex hint for the eyebrow accent. Maps onto v2 tokens already in use. */
  accent: string
}

export type ArticleBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'callout'; tone: 'info' | 'caution'; title?: string; text: string }
  | { kind: 'forYou'; title: string; text: string }

export interface Citation {
  /** Inline marker shown in body text. e.g. "ACOG", "OWH". */
  label: string
  /** Full title of the source. */
  title: string
  /** Authoritative source URL. */
  url: string
  /** Publishing org. */
  publisher: string
}

export interface LearnArticle {
  slug: string
  category: LearnCategorySlug
  /** Headline shown on hub + article hero. */
  title: string
  /** Subhead under the title. NC voice, never preachy. */
  subhead: string
  /** Estimated reading time in minutes (rounded up). */
  readingMinutes: number
  /** Body blocks rendered in order. */
  body: ArticleBlock[]
  /** Sourced citations referenced inline. */
  citations: Citation[]
  /** Slugs of related articles shown at the foot. */
  related: string[]
}
