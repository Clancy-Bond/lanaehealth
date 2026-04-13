'use client'

import { useState } from 'react'
import { Upload, X, Loader2, Check } from 'lucide-react'
import type { ImagingModality } from '@/lib/types'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface ScanUploaderProps {
  onSuccess?: () => void
}

interface FormState {
  study_date: string
  modality: ImagingModality | ''
  body_part: string
  indication: string
  findings_summary: string
  report_text: string
}

const MODALITIES: { value: ImagingModality; label: string }[] = [
  { value: 'CT', label: 'CT Scan' },
  { value: 'XR', label: 'X-Ray' },
  { value: 'MRI', label: 'MRI' },
  { value: 'US', label: 'Ultrasound' },
  { value: 'EKG', label: 'EKG' },
]

const INITIAL_FORM: FormState = {
  study_date: '',
  modality: '',
  body_part: '',
  indication: '',
  findings_summary: '',
  report_text: '',
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ScanUploader({ onSuccess }: ScanUploaderProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validation
    if (!form.study_date) {
      setError('Study date is required.')
      return
    }
    if (!form.modality) {
      setError('Please select a modality.')
      return
    }
    if (!form.body_part.trim()) {
      setError('Body part is required.')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/imaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          study_date: form.study_date,
          modality: form.modality,
          body_part: form.body_part.trim(),
          indication: form.indication.trim() || null,
          findings_summary: form.findings_summary.trim() || null,
          report_text: form.report_text.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }

      setSuccess(true)
      setForm(INITIAL_FORM)

      // Brief success state, then notify parent
      setTimeout(() => {
        setSuccess(false)
        onSuccess?.()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save study')
    } finally {
      setSubmitting(false)
    }
  }

  /* ---- Shared input styles ---- */
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-light)',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    width: '100%',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-2.5 px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border-light)' }}
      >
        <Upload
          size={16}
          strokeWidth={2}
          style={{ color: 'var(--accent-sage)' }}
        />
        <p
          className="text-sm font-semibold flex-1"
          style={{ color: 'var(--text-primary)' }}
        >
          Upload Imaging Study
        </p>
      </div>

      {/* Form body */}
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        {/* Row: date + modality */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Study Date</label>
            <input
              type="date"
              value={form.study_date}
              onChange={(e) => updateField('study_date', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Modality</label>
            <select
              value={form.modality}
              onChange={(e) =>
                updateField('modality', e.target.value as ImagingModality | '')
              }
              style={inputStyle}
            >
              <option value="">Select...</option>
              {MODALITIES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Body part */}
        <div>
          <label style={labelStyle}>Body Part / Region</label>
          <input
            type="text"
            placeholder="e.g. Brain, Chest, Abdomen/Pelvis"
            value={form.body_part}
            onChange={(e) => updateField('body_part', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Indication */}
        <div>
          <label style={labelStyle}>Indication / Reason</label>
          <input
            type="text"
            placeholder="e.g. Chronic headaches, rule out pneumonia"
            value={form.indication}
            onChange={(e) => updateField('indication', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Findings summary */}
        <div>
          <label style={labelStyle}>Findings Summary</label>
          <textarea
            rows={3}
            placeholder="Key findings from the radiologist report"
            value={form.findings_summary}
            onChange={(e) => updateField('findings_summary', e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' as const }}
          />
        </div>

        {/* Report text (optional) */}
        <div>
          <label style={labelStyle}>
            Full Report Text{' '}
            <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
          </label>
          <textarea
            rows={4}
            placeholder="Paste the full radiology report here"
            value={form.report_text}
            onChange={(e) => updateField('report_text', e.target.value)}
            style={{
              ...inputStyle,
              resize: 'vertical' as const,
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 13,
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <div
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(220, 80, 80, 0.1)',
              color: '#DC5050',
              border: '1px solid rgba(220, 80, 80, 0.2)',
            }}
          >
            <X size={14} strokeWidth={2} />
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(107, 144, 128, 0.1)',
              color: 'var(--accent-sage)',
              border: '1px solid rgba(107, 144, 128, 0.2)',
            }}
          >
            <Check size={14} strokeWidth={2} />
            Study saved successfully.
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl transition-opacity"
          style={{
            background: 'var(--accent-sage)',
            color: '#fff',
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? 'not-allowed' : 'pointer',
            border: 'none',
          }}
        >
          {submitting ? (
            <>
              <Loader2 size={16} strokeWidth={2} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Upload size={16} strokeWidth={2} />
              Save Imaging Study
            </>
          )}
        </button>
      </form>
    </div>
  )
}
