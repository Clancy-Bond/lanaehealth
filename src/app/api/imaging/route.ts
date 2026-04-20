/**
 * Imaging API Route
 *
 * POST /api/imaging - Insert a new imaging study + timeline event
 * Body: { study_date, modality, body_part, indication?, findings_summary?, report_text? }
 */

import { createServiceClient } from '@/lib/supabase'
import type { ImagingModality } from '@/lib/types'
import { guardUpload } from '@/lib/upload-guard'

export const dynamic = 'force-dynamic'
interface ImagingInput {
  study_date: string
  modality: ImagingModality
  body_part: string
  indication: string | null
  findings_summary: string | null
  report_text: string | null
}

const VALID_MODALITIES = new Set(['CT', 'XR', 'MRI', 'US', 'EKG'])

export async function POST(request: Request) {
  // Imaging inputs are JSON-only today; keep a generous 2 MB cap.
  const guard = guardUpload(request, { maxBytes: 2 * 1024 * 1024 })
  if (guard) return guard

  try {
    const body = (await request.json()) as ImagingInput

    // Validation
    if (!body.study_date || !body.modality || !body.body_part) {
      return Response.json(
        { error: 'Missing required fields: study_date, modality, body_part' },
        { status: 400 }
      )
    }

    if (!VALID_MODALITIES.has(body.modality)) {
      return Response.json(
        { error: `Invalid modality: ${body.modality}` },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // 1. Insert into imaging_studies
    const { data: study, error: studyError } = await supabase
      .from('imaging_studies')
      .insert({
        study_date: body.study_date,
        modality: body.modality,
        body_part: body.body_part,
        indication: body.indication || null,
        findings_summary: body.findings_summary || null,
        report_text: body.report_text || null,
        raw_data_path: null,
      })
      .select()
      .single()

    if (studyError) {
      return Response.json(
        { error: `Failed to insert imaging study: ${studyError.message}` },
        { status: 500 }
      )
    }

    // 2. Insert into medical_timeline
    const modalityLabel =
      body.modality === 'CT'
        ? 'CT Scan'
        : body.modality === 'XR'
          ? 'X-Ray'
          : body.modality === 'MRI'
            ? 'MRI'
            : body.modality === 'US'
              ? 'Ultrasound'
              : body.modality === 'EKG'
                ? 'EKG'
                : body.modality

    const { error: timelineError } = await supabase
      .from('medical_timeline')
      .insert({
        event_date: body.study_date,
        event_type: 'imaging',
        title: `${modalityLabel} - ${body.body_part}`,
        description: body.indication || body.findings_summary || null,
        significance: 'normal',
        linked_data: { imaging_study_id: study.id },
      })

    if (timelineError) {
      // Log but do not fail the request - the study was already saved
      console.error('Timeline insert error:', timelineError.message)
    }

    return Response.json({ success: true, study })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
