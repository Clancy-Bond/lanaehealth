/**
 * Shared medication-name normalizer used by import dedupe logic.
 *
 * Problem: "Tylenol 500mg", "tylenol 500 mg", "TYLENOL 500 MG", and
 * "  Tylenol  500mg  taken" should all collapse to a single dedupe key.
 * Prior to normalization, `.includes()` comparisons against mixed-case,
 * variably-spaced strings let duplicates slip through or wrongly merged
 * distinct medications that shared a prefix.
 *
 * Rules:
 *   - lowercase
 *   - whitespace collapsed to single spaces, trimmed
 *   - dose numerics joined to their unit ("500 mg" -> "500mg")
 *   - trailing action verbs ("taken", "logged", "dose") and whatever
 *     follows them are stripped
 *
 * Keep this helper tiny and deterministic so it is cheap to call on
 * every comparison.
 */
export function normalizeMedicationName(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(\d+)\s*(mg|mcg|g|ml|iu)\b/g, '$1$2')
    .replace(/\s+(taken|logged|dose)\b.*$/i, '')
    .replace(/\s+-\s+/g, ' ')
    .trim()
}
