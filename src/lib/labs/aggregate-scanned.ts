/**
 * Aggregate and de-duplicate lab results extracted from multiple PDF pages.
 *
 * Multi-page lab PDFs frequently repeat the same table or summary across
 * page headers/footers. Without dedup, a 4-page PDF can produce N copies
 * of the same Hemoglobin result. With dedup, we collapse duplicates on
 * (test_name, date) so the review UI shows one row per real-world result.
 */

export interface ExtractedResult {
  test_name: string
  value: number | null
  unit: string | null
  reference_range_low: number | null
  reference_range_high: number | null
  date: string | null
  category: string
  uncertain?: boolean
}

/**
 * Compose a stable dedup key for a result.
 *
 * Why it matters:
 *   - Multi-page PDFs repeat header tables; the same (Hemoglobin, 2026-04-13)
 *     often appears on every page and we want one row, not four.
 *   - But "hemoglobin" and "Hemoglobin" should collapse too, and trailing
 *     whitespace from OCR should not create phantom duplicates.
 *   - Null-date results from pages with no printed date need a stable bucket
 *     so they dedupe against each other without colliding with dated results.
 *
 * TODO (contribution point): implement the dedup key composition.
 *   - Normalize the test name (case, whitespace — and decide if punctuation
 *     like "T3, Free" vs "Free T3" should match; it probably shouldn't,
 *     since the extractor is consistent within one PDF).
 *   - Decide how to represent a null date so two null-date Hemoglobin rows
 *     dedupe but do not collide with "2026-04-13 Hemoglobin".
 *   - Return a string like `${normalizedName}|${dateOrSentinel}`.
 */
const NO_DATE_SENTINEL = '__no_date__'

export function dedupKey(result: ExtractedResult): string {
  const name = result.test_name.toLowerCase().trim().replace(/\s+/g, ' ')
  const date = result.date?.trim() || NO_DATE_SENTINEL
  return `${name}|${date}`
}

/**
 * When two results share the same dedup key across pages, pick which one
 * survives. The default here keeps the first occurrence, but you may
 * want to prefer the entry with the most complete reference-range data.
 *
 * TODO (contribution point): decide the merge policy. Options:
 *   (a) keep first (current default)
 *   (b) keep whichever has a non-null reference range (PDFs sometimes
 *       repeat tests but only print the range on the first mention)
 *   (c) merge field-by-field, taking the non-null value from either side
 *   (d) flag as `uncertain` if values disagree
 */
export function mergeDuplicate(
  existing: ExtractedResult,
  incoming: ExtractedResult
): ExtractedResult {
  const valuesDisagree =
    existing.value !== null &&
    incoming.value !== null &&
    existing.value !== incoming.value

  return {
    test_name: existing.test_name,
    value: existing.value ?? incoming.value,
    unit: existing.unit ?? incoming.unit,
    reference_range_low: existing.reference_range_low ?? incoming.reference_range_low,
    reference_range_high: existing.reference_range_high ?? incoming.reference_range_high,
    date: existing.date ?? incoming.date,
    category:
      existing.category && existing.category !== 'Other'
        ? existing.category
        : incoming.category || existing.category,
    uncertain: existing.uncertain || incoming.uncertain || valuesDisagree || undefined,
  }
}

/** Aggregate results from every page into a deduped list, preserving order. */
export function aggregateScannedPages(
  pages: ExtractedResult[][]
): ExtractedResult[] {
  const byKey = new Map<string, ExtractedResult>()

  for (const pageResults of pages) {
    for (const result of pageResults) {
      if (!result.test_name || result.test_name.trim().length === 0) continue
      const key = dedupKey(result)
      const existing = byKey.get(key)
      if (existing) {
        byKey.set(key, mergeDuplicate(existing, result))
      } else {
        byKey.set(key, result)
      }
    }
  }

  return Array.from(byKey.values())
}
