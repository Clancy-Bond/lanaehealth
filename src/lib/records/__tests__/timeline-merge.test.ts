/**
 * Tests for the unified records timeline merge logic (Wave 2c D1+F6).
 */

import { describe, expect, it } from 'vitest'
import type {
  Appointment,
  ImagingStudy,
  LabResult,
  MedicalTimelineEvent,
} from '@/lib/types'
import {
  availableSpecialties,
  filterTimeline,
  kindFilterForTabParam,
  mergeTimeline,
  severityForLabFlag,
  specialtyForImaging,
  specialtyForLab,
  type ActiveProblemRow,
} from '../timeline-merge'

// ── Fixture builders ──────────────────────────────────────────────────

function buildLab(partial: Partial<LabResult> & Pick<LabResult, 'id' | 'date' | 'test_name'>): LabResult {
  return {
    category: 'Other',
    value: 10,
    unit: 'mg/dL',
    reference_range_low: 5,
    reference_range_high: 15,
    flag: null,
    source_document_id: null,
    created_at: '2026-04-17T00:00:00Z',
    ...partial,
  }
}

function buildImaging(
  partial: Partial<ImagingStudy> &
    Pick<ImagingStudy, 'id' | 'study_date' | 'modality' | 'body_part'>
): ImagingStudy {
  return {
    indication: null,
    findings_summary: null,
    raw_data_path: null,
    report_text: null,
    created_at: '2026-04-17T00:00:00Z',
    ...partial,
  }
}

function buildAppointment(
  partial: Partial<Appointment> & Pick<Appointment, 'id' | 'date'>
): Appointment {
  return {
    doctor_name: null,
    specialty: null,
    clinic: null,
    reason: null,
    notes: null,
    action_items: null,
    follow_up_date: null,
    created_at: '2026-04-17T00:00:00Z',
    ...partial,
  }
}

function buildEvent(
  partial: Partial<MedicalTimelineEvent> &
    Pick<MedicalTimelineEvent, 'id' | 'event_date' | 'event_type' | 'title'>
): MedicalTimelineEvent {
  return {
    description: null,
    significance: 'normal',
    linked_data: null,
    created_at: '2026-04-17T00:00:00Z',
    ...partial,
  }
}

function buildProblem(
  partial: Partial<ActiveProblemRow> & Pick<ActiveProblemRow, 'id' | 'problem'>
): ActiveProblemRow {
  return {
    status: 'active',
    onset_date: null,
    latest_data: null,
    linked_diagnoses: null,
    ...partial,
  }
}

// ── Specialty / severity helpers ─────────────────────────────────────

describe('specialtyForLab', () => {
  it('maps Hormones to OB/GYN so reproductive labs color-coordinate with OB/GYN appointments', () => {
    expect(specialtyForLab('Hormones')).toBe('OB/GYN')
  })

  it('maps Lipids to Cardiology', () => {
    expect(specialtyForLab('Lipids')).toBe('Cardiology')
  })

  it('falls back to "Labs" for categories with no specialty mapping', () => {
    expect(specialtyForLab('CBC')).toBe('Labs')
    expect(specialtyForLab('Iron Studies')).toBe('Labs')
    expect(specialtyForLab('Metabolic')).toBe('Labs')
    expect(specialtyForLab(null)).toBe('Labs')
  })
})

describe('specialtyForImaging', () => {
  it('groups CT + MRI under Imaging and EKG under Cardiology', () => {
    expect(specialtyForImaging('CT')).toBe('Imaging')
    expect(specialtyForImaging('MRI')).toBe('Imaging')
    expect(specialtyForImaging('EKG')).toBe('Cardiology')
  })
})

describe('severityForLabFlag', () => {
  it('maps critical to critical, high/low to watch, rest to info', () => {
    expect(severityForLabFlag('critical')).toBe('critical')
    expect(severityForLabFlag('high')).toBe('watch')
    expect(severityForLabFlag('low')).toBe('watch')
    expect(severityForLabFlag('normal')).toBe('info')
    expect(severityForLabFlag(null)).toBe('info')
  })
})

// ── mergeTimeline ────────────────────────────────────────────────────

describe('mergeTimeline', () => {
  it('merges all five streams into a single newest-first list', () => {
    const rows = mergeTimeline({
      labs: [buildLab({ id: 'l1', date: '2026-02-19', test_name: 'TSH' })],
      imaging: [
        buildImaging({
          id: 'i1',
          study_date: '2026-04-08',
          modality: 'CT',
          body_part: 'Head',
        }),
      ],
      appointments: [
        buildAppointment({
          id: 'a1',
          date: '2026-04-13',
          specialty: 'PCP',
          doctor_name: 'Dr. Williams',
        }),
      ],
      events: [
        buildEvent({
          id: 'e1',
          event_date: '2025-06-01',
          event_type: 'diagnosis',
          title: 'Menorrhagia diagnosed',
        }),
      ],
      problems: [
        buildProblem({
          id: 'p1',
          problem: 'Iron deficiency anemia',
          onset_date: '2025-06-01',
        }),
      ],
    })

    // Apr 13 appointment > Apr 8 imaging > Feb 19 lab > Jun 1 2025 (event + problem, same date)
    expect(rows.map((r) => r.id)).toEqual([
      'appointment:a1',
      'imaging:i1',
      'lab:l1',
      'event:e1',
      'problem:p1',
    ])
  })

  it('keeps a stable kind order for ties on the same date', () => {
    const rows = mergeTimeline({
      labs: [buildLab({ id: 'L', date: '2026-04-01', test_name: 'A' })],
      imaging: [
        buildImaging({
          id: 'I',
          study_date: '2026-04-01',
          modality: 'CT',
          body_part: 'Head',
        }),
      ],
      appointments: [buildAppointment({ id: 'A', date: '2026-04-01' })],
      events: [
        buildEvent({
          id: 'E',
          event_date: '2026-04-01',
          event_type: 'test',
          title: 'x',
        }),
      ],
      problems: [
        buildProblem({ id: 'P', problem: 'x', onset_date: '2026-04-01' }),
      ],
    })
    expect(rows.map((r) => r.kind)).toEqual([
      'lab',
      'imaging',
      'appointment',
      'event',
      'problem',
    ])
  })

  it('places problems without onset_date at the bottom via the epoch fallback', () => {
    const rows = mergeTimeline({
      labs: [buildLab({ id: 'l', date: '1990-01-01', test_name: 'A' })],
      imaging: [],
      appointments: [],
      events: [],
      problems: [
        buildProblem({ id: 'p', problem: 'Unknown onset', onset_date: null }),
      ],
    })
    expect(rows[0].kind).toBe('lab')
    expect(rows[rows.length - 1].id).toBe('problem:p')
    expect(rows[rows.length - 1].date).toBe('1970-01-01')
  })

  it('carries specialty + severity onto each row', () => {
    const rows = mergeTimeline({
      labs: [
        buildLab({
          id: 'l1',
          date: '2026-04-01',
          test_name: 'TSH',
          category: 'Hormones',
          flag: 'high',
        }),
      ],
      imaging: [],
      appointments: [
        buildAppointment({
          id: 'a1',
          date: '2026-04-02',
          specialty: 'Cardiology',
        }),
      ],
      events: [
        buildEvent({
          id: 'e1',
          event_date: '2026-04-03',
          event_type: 'diagnosis',
          title: 'x',
          significance: 'critical',
        }),
      ],
      problems: [],
    })
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(byId['lab:l1'].specialty).toBe('OB/GYN')
    expect(byId['lab:l1'].severity).toBe('watch')
    expect(byId['appointment:a1'].specialty).toBe('Cardiology')
    expect(byId['event:e1'].severity).toBe('critical')
  })

  it('produces a summary string for labs with value + unit + reference range', () => {
    const [row] = mergeTimeline({
      labs: [
        buildLab({
          id: 'l1',
          date: '2026-04-01',
          test_name: 'Ferritin',
          value: 12,
          unit: 'ng/mL',
          reference_range_low: 15,
          reference_range_high: 150,
        }),
      ],
      imaging: [],
      appointments: [],
      events: [],
      problems: [],
    })
    expect(row.summary).toContain('12 ng/mL')
    expect(row.summary).toContain('ref 15-150')
  })

  it('handles labs with no value gracefully', () => {
    const [row] = mergeTimeline({
      labs: [
        buildLab({
          id: 'l1',
          date: '2026-04-01',
          test_name: 'TSH',
          value: null,
          unit: null,
          reference_range_low: null,
          reference_range_high: null,
        }),
      ],
      imaging: [],
      appointments: [],
      events: [],
      problems: [],
    })
    expect(row.summary).toBe('value not recorded')
  })
})

// ── filterTimeline ───────────────────────────────────────────────────

describe('filterTimeline', () => {
  const rows = mergeTimeline({
    labs: [
      buildLab({
        id: 'l1',
        date: '2026-04-01',
        test_name: 'TSH',
        category: 'Hormones',
      }),
    ],
    imaging: [
      buildImaging({
        id: 'i1',
        study_date: '2026-04-08',
        modality: 'CT',
        body_part: 'Head',
      }),
    ],
    appointments: [
      buildAppointment({
        id: 'a1',
        date: '2026-04-13',
        specialty: 'PCP',
      }),
    ],
    events: [],
    problems: [],
  })

  it('returns everything with the default "all" filter', () => {
    const filtered = filterTimeline(rows, { kind: 'all', specialty: null })
    expect(filtered).toHaveLength(3)
  })

  it('narrows to a single kind', () => {
    const filtered = filterTimeline(rows, { kind: 'lab', specialty: null })
    expect(filtered.map((r) => r.id)).toEqual(['lab:l1'])
  })

  it('narrows to a specialty (labs derived from Hormones show alongside OB/GYN appointments)', () => {
    const filtered = filterTimeline(rows, {
      kind: 'all',
      specialty: 'OB/GYN',
    })
    expect(filtered.map((r) => r.id)).toEqual(['lab:l1'])
  })

  it('combines kind + specialty filters as AND', () => {
    const filtered = filterTimeline(rows, {
      kind: 'appointment',
      specialty: 'PCP',
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('appointment:a1')
  })
})

// ── availableSpecialties ─────────────────────────────────────────────

describe('availableSpecialties', () => {
  it('returns a sorted, de-duplicated list of non-null specialties', () => {
    const rows = mergeTimeline({
      labs: [
        buildLab({
          id: 'l1',
          date: '2026-04-01',
          test_name: 'TSH',
          category: 'Hormones',
        }),
        buildLab({
          id: 'l2',
          date: '2026-04-02',
          test_name: 'LDL',
          category: 'Lipids',
        }),
      ],
      imaging: [],
      appointments: [
        buildAppointment({
          id: 'a1',
          date: '2026-04-13',
          specialty: 'PCP',
        }),
        buildAppointment({
          id: 'a2',
          date: '2026-04-14',
          specialty: 'Cardiology',
        }),
      ],
      events: [
        // event with no specialty; should NOT appear in the list
        buildEvent({
          id: 'e1',
          event_date: '2026-04-15',
          event_type: 'test',
          title: 'x',
        }),
      ],
      problems: [],
    })
    expect(availableSpecialties(rows)).toEqual([
      'Cardiology',
      'OB/GYN',
      'PCP',
    ])
  })
})

// ── kindFilterForTabParam (URL back-compat) ──────────────────────────

describe('kindFilterForTabParam', () => {
  it('maps legacy tab params onto the new kind filter values', () => {
    expect(kindFilterForTabParam('labs')).toBe('lab')
    expect(kindFilterForTabParam('imaging')).toBe('imaging')
    expect(kindFilterForTabParam('appointments')).toBe('appointment')
    expect(kindFilterForTabParam('timeline')).toBe('event')
  })

  it('falls back to "all" for missing or unknown params', () => {
    expect(kindFilterForTabParam(null)).toBe('all')
    expect(kindFilterForTabParam(undefined)).toBe('all')
    expect(kindFilterForTabParam('')).toBe('all')
    expect(kindFilterForTabParam('bogus')).toBe('all')
  })
})
