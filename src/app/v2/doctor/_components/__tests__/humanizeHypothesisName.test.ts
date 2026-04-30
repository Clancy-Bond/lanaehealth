import { describe, expect, it } from 'vitest'

import { humanizeHypothesisName } from '../humanizeHypothesisName'

describe('humanizeHypothesisName', () => {
  it('replaces underscores with spaces', () => {
    expect(humanizeHypothesisName('iron_deficiency_without_anemia')).toBe(
      'Iron deficiency without anemia',
    )
  })

  it('inserts a space between digits and adjacent letters', () => {
    expect(humanizeHypothesisName('chiari_malformation_type1_or_craniocervical_instability')).toBe(
      'Chiari malformation type 1 or craniocervical instability',
    )
  })

  it('uppercases only the first character (sentence case)', () => {
    // Title case would produce "Postural Orthostatic Tachycardia
    // Syndrome (Pots)"; we deliberately avoid that.
    expect(humanizeHypothesisName('postural_orthostatic_tachycardia_syndrome')).toBe(
      'Postural orthostatic tachycardia syndrome',
    )
  })

  it('passes already-human-readable strings through unchanged except first-letter case', () => {
    expect(humanizeHypothesisName('Endometriosis')).toBe('Endometriosis')
    expect(humanizeHypothesisName('endometriosis')).toBe('Endometriosis')
  })

  it('returns the original on empty input', () => {
    expect(humanizeHypothesisName('')).toBe('')
  })

  it('collapses whitespace introduced by separator handling', () => {
    expect(humanizeHypothesisName('vitamin_d_deficiency_severity4')).toBe(
      'Vitamin d deficiency severity 4',
    )
  })
})
