import { describe, expect, it } from 'vitest'
import { runImportPipeline } from '@/lib/import'

/*
 * Forward-compatibility pin: claims data via CARIN ExplanationOfBenefit
 *
 * Phase 8 of the medical-data-aggregation plan ingests payer Patient
 * Access API data — claims, coverage, formularies. The CARIN profile
 * surfaces these as FHIR resources, primarily `ExplanationOfBenefit`
 * (one EOB per billed claim) and `Coverage` (one per active plan).
 *
 * As of 2026-05-03, the FHIR parser at src/lib/import/parsers/fhir.ts
 * does NOT recognize these resource types. A synthetic CARIN bundle
 * runs through the pipeline cleanly (no exceptions, no errors), but
 * produces zero records because the parser silently skips unknown
 * types. That is the current behavior. This test pins it.
 *
 * When Phase 8 is fully implemented and the parser is taught to map
 * EOB into canonical records (e.g., one per billed encounter, with
 * provider, billed amount, paid amount, ICD/CPT codes), this test
 * will fail. Updating the assertions to expect non-zero records is
 * how the next session signals "EOB support is live."
 */

const CARIN_EOB_BUNDLE = {
  resourceType: 'Bundle',
  type: 'searchset',
  entry: [
    {
      resource: {
        resourceType: 'Coverage',
        id: 'coverage-1',
        status: 'active',
        beneficiary: { reference: 'Patient/lanae' },
        payor: [{ display: 'HMSA' }],
      },
    },
    {
      resource: {
        resourceType: 'ExplanationOfBenefit',
        id: 'eob-1',
        status: 'active',
        type: { coding: [{ code: 'professional' }] },
        use: 'claim',
        patient: { reference: 'Patient/lanae' },
        billablePeriod: { start: '2026-04-15', end: '2026-04-15' },
        provider: { display: "Queen's Medical Center" },
        item: [
          {
            sequence: 1,
            productOrService: {
              coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213' }],
            },
            servicedDate: '2026-04-15',
          },
        ],
      },
    },
  ],
}

describe('FHIR parser — CARIN ExplanationOfBenefit forward-compat pin', () => {
  it('runs a CARIN bundle through the pipeline without error', async () => {
    const result = await runImportPipeline({
      content: JSON.stringify(CARIN_EOB_BUNDLE),
      fileName: 'carin_eob_sample.json',
      mimeType: 'application/fhir+json',
    })
    expect(result).toBeTruthy()
    expect(result.parseResult).toBeTruthy()
    expect(Array.isArray(result.parseResult.records)).toBe(true)
  })

  it('CURRENT BEHAVIOR: parser produces zero records from a CARIN bundle (no EOB handling yet)', async () => {
    // When the parser is taught to handle EOB / Coverage, flip these
    // assertions to .toBeGreaterThan(0). That is the canonical "Phase 8
    // is live" signal.
    const result = await runImportPipeline({
      content: JSON.stringify(CARIN_EOB_BUNDLE),
      fileName: 'carin_eob_sample.json',
      mimeType: 'application/fhir+json',
    })
    expect(result.parseResult.records.length).toBe(0)
  })
})
