import { describe, expect, it } from 'vitest'
import {
  bucketVisible,
  orderedBuckets,
  SPECIALIST_CONFIG,
  type DataBucket,
  type SpecialistView,
} from '@/lib/doctor/specialist-config'

const ALL_VIEWS: SpecialistView[] = ['pcp', 'obgyn', 'cardiology']
const ALL_BUCKETS: DataBucket[] = [
  'activeProblems',
  'vitals',
  'labs',
  'cycle',
  'orthostatic',
  'imaging',
  'correlations',
  'medications',
]

describe('specialist-config', () => {
  describe('bucketVisible: explicit cases the doctor brief depends on', () => {
    it('shows cycle to PCP (general clinical context)', () => {
      expect(bucketVisible('pcp', 'cycle')).toBe(true)
    })

    it('hides cycle from cardiology (weight = -1)', () => {
      expect(bucketVisible('cardiology', 'cycle')).toBe(false)
    })

    it('hides orthostatic from OB/GYN (weight = -1)', () => {
      expect(bucketVisible('obgyn', 'orthostatic')).toBe(false)
    })

    it('shows orthostatic to cardiology (weight = 3)', () => {
      expect(bucketVisible('cardiology', 'orthostatic')).toBe(true)
    })

    it('shows cycle to OB/GYN as a top-priority bucket', () => {
      expect(bucketVisible('obgyn', 'cycle')).toBe(true)
    })
  })

  describe('bucketVisible: full visibility matrix', () => {
    // The matrix below mirrors the SPECIALIST_CONFIG weights at the time of
    // writing. If you intentionally change a bucket weight to or from -1,
    // update this table in lockstep.
    const matrix: Record<SpecialistView, Record<DataBucket, boolean>> = {
      pcp: {
        activeProblems: true,
        vitals: true,
        labs: true,
        cycle: true,
        orthostatic: true,
        imaging: true,
        correlations: true,
        medications: true,
      },
      obgyn: {
        activeProblems: true,
        vitals: true,
        labs: true,
        cycle: true,
        orthostatic: false, // hidden
        imaging: true,
        correlations: true,
        medications: true,
      },
      cardiology: {
        activeProblems: true,
        vitals: true,
        labs: true,
        cycle: false, // hidden
        orthostatic: true,
        imaging: true,
        correlations: true,
        medications: true,
      },
    }

    for (const view of ALL_VIEWS) {
      for (const bucket of ALL_BUCKETS) {
        const expected = matrix[view][bucket]
        it(`${view} + ${bucket} → ${expected ? 'visible' : 'hidden'}`, () => {
          expect(bucketVisible(view, bucket)).toBe(expected)
        })
      }
    }
  })

  describe('orderedBuckets', () => {
    it('returns buckets sorted by weight descending', () => {
      const order = orderedBuckets('cardiology')
      // The first bucket should have the highest weight; the last visible
      // bucket should have the lowest non-negative weight.
      const weights = SPECIALIST_CONFIG.cardiology.bucketWeights
      const ordered = order.map((b) => weights[b])
      const sortedDesc = [...ordered].sort((a, b) => b - a)
      expect(ordered).toEqual(sortedDesc)
    })

    it('omits buckets with weight = -1', () => {
      expect(orderedBuckets('cardiology')).not.toContain('cycle')
      expect(orderedBuckets('obgyn')).not.toContain('orthostatic')
      expect(orderedBuckets('pcp').length).toBe(ALL_BUCKETS.length)
    })

    it('returns the same set of buckets that bucketVisible reports as visible', () => {
      for (const view of ALL_VIEWS) {
        const visible = ALL_BUCKETS.filter((b) => bucketVisible(view, b))
        expect(orderedBuckets(view).sort()).toEqual(visible.sort())
      }
    })
  })

  describe('SPECIALIST_CONFIG sanity', () => {
    it('defines a config for every SpecialistView', () => {
      for (const view of ALL_VIEWS) {
        expect(SPECIALIST_CONFIG[view]).toBeDefined()
        expect(SPECIALIST_CONFIG[view].label.length).toBeGreaterThan(0)
        expect(SPECIALIST_CONFIG[view].openingLine.length).toBeGreaterThan(0)
      }
    })

    it('weights every DataBucket for every SpecialistView', () => {
      for (const view of ALL_VIEWS) {
        for (const bucket of ALL_BUCKETS) {
          expect(typeof SPECIALIST_CONFIG[view].bucketWeights[bucket]).toBe('number')
        }
      }
    })
  })
})
