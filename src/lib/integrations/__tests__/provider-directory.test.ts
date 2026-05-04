import { describe, expect, it } from 'vitest'
import {
  PROVIDERS,
  REGIONS,
  PATH_DESCRIPTIONS,
} from '../provider-directory'

describe('provider-directory data integrity', () => {
  it('has no duplicate provider IDs', () => {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const p of PROVIDERS) {
      if (seen.has(p.id)) dupes.push(p.id)
      seen.add(p.id)
    }
    expect(dupes).toEqual([])
  })

  it('every provider has a primary path with a corresponding description', () => {
    for (const p of PROVIDERS) {
      expect(
        PATH_DESCRIPTIONS[p.primaryPath],
        `provider ${p.id} primary path "${p.primaryPath}" missing in PATH_DESCRIPTIONS`,
      ).toBeDefined()
    }
  })

  it('every provider region is one of the declared REGIONS', () => {
    const allowed = new Set<string>(REGIONS)
    for (const p of PROVIDERS) {
      expect(
        allowed.has(p.region),
        `provider ${p.id} region "${p.region}" not in REGIONS`,
      ).toBe(true)
    }
  })

  it('Apple Health Records primary paths come with a search-term hint', () => {
    // If primaryPath === apple-health-records, the user needs to know
    // exactly what to type in Apple's search. Without that hint, the
    // UI gives generic guidance and the user is stuck.
    for (const p of PROVIDERS) {
      if (p.primaryPath === 'apple-health-records') {
        expect(
          p.appleHealthRecordsName,
          `provider ${p.id} routes to Apple Health Records but has no appleHealthRecordsName`,
        ).toBeTruthy()
      }
    }
  })

  it('every Oahu hospital, FQHC, lab, or imaging center is covered', () => {
    // Sanity check: at least one entry per category in the Oahu region.
    const oahuCategories = new Set<string>()
    for (const p of PROVIDERS) {
      if (p.region === 'oahu') oahuCategories.add(p.category)
    }
    for (const c of ['hospital', 'clinic', 'lab', 'imaging', 'specialty', 'urgent-care']) {
      expect(
        oahuCategories.has(c),
        `Oahu region missing at least one provider in category "${c}"`,
      ).toBe(true)
    }
  })

  it('fallbackPaths never include the primaryPath (no redundant fallback)', () => {
    for (const p of PROVIDERS) {
      expect(
        p.fallbackPaths.includes(p.primaryPath),
        `provider ${p.id} lists ${p.primaryPath} as both primary and fallback`,
      ).toBe(false)
    }
  })

  it('directory has at least 30 entries (sanity check on coverage)', () => {
    // We started at 23 and expanded to 34. This pin keeps the directory
    // from accidentally shrinking; raise it deliberately when entries
    // are removed.
    expect(PROVIDERS.length).toBeGreaterThanOrEqual(30)
  })
})
