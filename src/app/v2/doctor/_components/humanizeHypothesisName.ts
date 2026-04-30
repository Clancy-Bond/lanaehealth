/*
 * humanizeHypothesisName
 *
 * KB hypothesis names from `clinical_knowledge_base.hypothesis_tracker`
 * are written by the synthesis prompt as snake_case identifiers, e.g.
 *   chiari_malformation_type1_or_craniocervical_instability
 *
 * They render fine when set in narrow display columns IF the row layout
 * allows breaking inside the token (see HypothesesCard's overflow-wrap
 * rule). But the doctor visit experience is also better when the
 * displayed string reads as language, not as a code identifier.
 *
 * This helper does presentation-side humanization only — no edits to
 * src/lib/doctor (locked). It:
 *   - replaces underscores with spaces,
 *   - inserts a space between digits and adjacent letters
 *     (type1 -> type 1) so the eye can parse boundaries,
 *   - uppercases the first character of the resulting string while
 *     leaving the rest alone, so doctors see sentence case rather
 *     than ALL_CAPS or all-lowercase.
 *
 * It deliberately does NOT capitalize each word. Most hypothesis names
 * contain proper nouns ("Chiari", "POTS") and common nouns
 * ("malformation", "instability") side-by-side; title-casing would
 * produce "Chiari Malformation Type 1 Or Craniocervical Instability"
 * which reads worse than "Chiari malformation type 1 or craniocervical
 * instability". Acronyms that arrive lowercase (e.g. "pots") will read
 * as lowercase; if that becomes a real problem we can ship a small
 * acronym list later.
 */

/* LEARNING-MODE HOOK · Capitalization design decision.
 *
 * The version below uses sentence case ("Chiari malformation type 1 or
 * craniocervical instability"). Two reasonable alternatives:
 *
 *   1) Title case every word: "Chiari Malformation Type 1 Or
 *      Craniocervical Instability". Common in clinical documents but
 *      reads more formally.
 *
 *   2) Preserve original casing for tokens that look like acronyms
 *      (>=3 consecutive uppercase letters or in a known list of
 *      medical acronyms: POTS, EDS, MCAS, hEDS, etc.) and lowercase
 *      everything else.
 *
 * If you prefer #1 or #2, swap the body of `humanizeHypothesisName`
 * accordingly. The unit tests at
 * src/app/v2/doctor/_components/humanizeHypothesisName.test.ts
 * pin the current behaviour so the regression is visible if you switch.
 */

export function humanizeHypothesisName(raw: string): string {
  if (!raw) return raw
  // 1. underscores → spaces
  let out = raw.replace(/_/g, ' ')
  // 2. insert space between digit and letter (typeN, N-letter)
  out = out.replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
  // 3. collapse whitespace
  out = out.replace(/\s+/g, ' ').trim()
  // 4. uppercase first character only
  if (out.length > 0) out = out[0].toUpperCase() + out.slice(1)
  return out
}
