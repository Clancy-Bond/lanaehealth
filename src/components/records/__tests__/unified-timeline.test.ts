/**
 * Tests for the unified medical records timeline helpers.
 *
 * Coverage:
 *  - buildUnifiedStream: merge + date-desc sort + tie-break stability
 *  - filterByKind: correctness across all kinds
 *  - groupByMonth: month bucketing, ongoing bucket for sentinel dates,
 *    chronological bucket order
 *
 * The React rendering path (TimelineEntry component output) is covered at
 * the integration layer; these tests keep the pure helpers honest without
 * requiring a DOM environment.
 */

import { describe, it, expect } from 'vitest'
import {
  buildUnifiedStream,
  filterByKind,
  groupByMonth,
  type ActiveProblemRow,
} from '../TimelineEntry'
import type {
  LabResult,
  ImagingStudy,
  Appointment,
  MedicalTimelineEvent,
} from '@/lib/types'

function makeLab(id: string, date: string, overrides: Partial<LabResult> = {}): LabResult {
  return {
    id,
    date,
    category: 'Iron Studies',
    test_name: 'Ferritin',
    value: 42,
    unit: 'ng/mL',
    reference_range_low: 15,
    reference_range_high: 150,
    flag: null,
    source_document_id: null,
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

function makeImaging(id: string, study_date: string, overrides: Partial<ImagingStudy> = {}): ImagingStudy {
  return {
    id,
    study_date,
    modality: 'CT',
    body_part: 'Head',
    indication: null,
    findings_summary: null,
    raw_data_path: null,
    report_text: null,
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

function makeAppt(id: string, date: string, overrides: Partial<Appointment> = {}): Appointment {
  return {
    id,
    date,
    doctor_name: 'Dr. Test',
    specialty: 'PCP',
    clinic: 'Test Clinic',
    reason: 'Check-up',
    notes: null,
    action_items: null,
    follow_up_date: null,
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

function makeEvent(
  id: string,
  event_date: string,
  overrides: Partial<MedicalTimelineEvent> = {},
): MedicalTimelineEvent {
  return {
    id,
    event_date,
    event_type: 'diagnosis',
    title: 'Test event',
    description: null,
    significance: 'normal',
    linked_data: null,
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

function makeProblem(id: string, onset_date: string | null = null): ActiveProblemRow {
  return {
    id,
    problem: 'Test problem',
    status: 'active',
    onset_date,
    latest_data: null,
  }
}

// ── buildUnifiedStream ─────────────────────────────────────────────────

describe('buildUnifiedStream', () => {
  it('merges all record types into a single array', () => {
    const stream = buildUnifiedStream({
      labs: [makeLab('l1', '2026-03-01')],
      imaging: [makeImaging('i1', '2026-02-01')],
      appointments: [makeAppt('a1', '2026-04-01')],
      events: [makeEvent('e1', '2026-04-10')],
      problems: [makeProblem('p1', '2025-12-01')],
    })
    expect(stream).toHaveLength(5)
    const kinds = stream.map((r) => r.kind).sort()
    expect(kinds).toEqual(['appointment', 'event', 'imaging', 'lab', 'problem'])
  })

  it('sorts entries by date descending', () => {
    const stream = buildUnifiedStream({
      labs: [
        makeLab('l-old', '2025-01-01'),
        makeLab('l-new', '2026-04-15'),
        makeLab('l-mid', '2025-12-01'),
      ],
      imaging: [],
      appointments: [],
      events: [],
      problems: [],
    })
    expect(stream.map((r) => r.id)).toEqual(['l-new', 'l-mid', 'l-old'])
  })

  it('breaks same-date ties using the kind priority order', () => {
    // event > appointment > imaging > lab > problem
    const stream = buildUnifiedStream({
      labs: [makeLab('l', '2026-04-17')],
      imaging: [makeImaging('i', '2026-04-17')],
      appointments: [makeAppt('a', '2026-04-17')],
      events: [makeEvent('e', '2026-04-17')],
      problems: [makeProblem('p', '2026-04-17')],
    })
    expect(stream.map((r) => r.kind)).toEqual([
      'event',
      'appointment',
      'imaging',
      'lab',
      'problem',
    ])
  })

  it('places problems without onset_date at the bottom via a sentinel date', () => {
    const stream = buildUnifiedStream({
      labs: [makeLab('l', '2020-01-01')],
      imaging: [],
      appointments: [],
      events: [],
      problems: [makeProblem('p-no-onset', null)],
    })
    // The lab should come first - its 2020 date beats the 1900 sentinel.
    expect(stream[0].kind).toBe('lab')
    expect(stream[1].kind).toBe('problem')
  })
})

// ── filterByKind ───────────────────────────────────────────────────────

describe('filterByKind', () => {
  const stream = buildUnifiedStream({
    labs: [makeLab('l', '2026-04-01')],
    imaging: [makeImaging('i', '2026-03-01')],
    appointments: [makeAppt('a', '2026-02-01')],
    events: [makeEvent('e', '2026-01-01')],
    problems: [makeProblem('p', '2025-12-01')],
  })

  it('returns everything when kind is "all"', () => {
    expect(filterByKind(stream, 'all')).toHaveLength(5)
  })

  it('returns only lab rows when kind is "lab"', () => {
    const filtered = filterByKind(stream, 'lab')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].kind).toBe('lab')
  })

  it('returns only problem rows when kind is "problem"', () => {
    const filtered = filterByKind(stream, 'problem')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].kind).toBe('problem')
  })

  it('returns an empty array when no entries match the requested kind', () => {
    const onlyLabs = buildUnifiedStream({
      labs: [makeLab('l', '2026-04-01')],
      imaging: [],
      appointments: [],
      events: [],
      problems: [],
    })
    expect(filterByKind(onlyLabs, 'event')).toEqual([])
  })
})

// ── groupByMonth ───────────────────────────────────────────────────────

describe('groupByMonth', () => {
  it('buckets entries by YYYY-MM', () => {
    const stream = buildUnifiedStream({
      labs: [
        makeLab('l-apr', '2026-04-15'),
        makeLab('l-apr-2', '2026-04-01'),
        makeLab('l-feb', '2026-02-19'),
      ],
      imaging: [],
      appointments: [],
      events: [],
      problems: [],
    })
    const groups = groupByMonth(stream)
    expect(groups).toHaveLength(2)
    expect(groups[0].key).toBe('2026-04')
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].key).toBe('2026-02')
    expect(groups[1].items).toHaveLength(1)
  })

  it('formats group labels as "Month Year"', () => {
    const stream = buildUnifiedStream({
      labs: [makeLab('l', '2026-04-15')],
      imaging: [],
      appointments: [],
      events: [],
      problems: [],
    })
    const groups = groupByMonth(stream)
    expect(groups[0].label).toBe('April 2026')
  })

  it('puts problems without onset_date into an "Ongoing" bucket that sorts to the bottom', () => {
    const stream = buildUnifiedStream({
      labs: [makeLab('l', '2026-04-15')],
      imaging: [],
      appointments: [],
      events: [],
      problems: [makeProblem('p', null)],
    })
    const groups = groupByMonth(stream)
    expect(groups).toHaveLength(2)
    expect(groups[0].key).toBe('2026-04')
    expect(groups[1].key).toBe('ongoing')
    expect(groups[1].label).toBe('Ongoing')
    expect(groups[1].items[0].kind).toBe('problem')
  })

  it('sorts month buckets from most recent to oldest', () => {
    const stream = buildUnifiedStream({
      labs: [
        makeLab('l1', '2025-08-01'),
        makeLab('l2', '2026-04-01'),
        makeLab('l3', '2025-12-01'),
      ],
      imaging: [],
      appointments: [],
      events: [],
      problems: [],
    })
    const groups = groupByMonth(stream)
    expect(groups.map((g) => g.key)).toEqual(['2026-04', '2025-12', '2025-08'])
  })
})
