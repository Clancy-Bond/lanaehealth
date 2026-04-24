'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Upload, AlertCircle, Check } from 'lucide-react'
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
  const [errorKind, setErrorKind] = useState<'unauth' | 'client' | 'server' | null>(null)
  const [success, setSuccess] = useState(false)

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
    setErrorKind(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setErrorKind(null)

    if (!form.study_date) {
      setError('Add a study date to save.')
      return
    }
    if (!form.modality) {
      setError('Choose a modality to save.')
      return
    }
    if (!form.body_part.trim()) {
      setError('Add a body part to save.')
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
        // Differentiate auth (cookie expired) from server bugs so the user
        // sees a sign-in prompt instead of a misleading "broken" message.
        // 5xx keeps the retry copy; other 4xx gets a neutral can-not-save.
        if (res.status === 401) {
          setErrorKind('unauth')
          setError('You need to sign in to save imaging studies.')
          return
        }
        if (res.status >= 500) {
          setErrorKind('server')
          setError('Something broke on my end. Try again?')
          return
        }
        setErrorKind('client')
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'We could not save that imaging study.')
        return
      }

      setSuccess(true)
      setForm(INITIAL_FORM)

      setTimeout(() => {
        setSuccess(false)
        onSuccess?.()
      }, 1200)
    } catch (err) {
      // Network/parse failure: treat as transient server trouble.
      setErrorKind('server')
      setError(err instanceof Error ? err.message : 'Something broke on my end. Try again?')
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
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
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
          Add an imaging study
        </p>
      </div>

      {/* Form body */}
      <form
        onSubmit={handleSubmit}
        className="px-5 py-4"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        {/* Row: date + modality */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Study date</label>
            <input
              type="date"
              value={form.study_date}
              onChange={(e) => updateField('study_date', e.target.value)}
              style={inputStyle}
              disabled={submitting}
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
              disabled={submitting}
            >
              <option value="">Choose a modality</option>
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
          <label style={labelStyle}>Body part</label>
          <input
            type="text"
            placeholder="e.g. Brain, Chest, Abdomen/Pelvis"
            value={form.body_part}
            onChange={(e) => updateField('body_part', e.target.value)}
            style={inputStyle}
            disabled={submitting}
          />
        </div>

        {/* Indication */}
        <div>
          <label style={labelStyle}>Indication</label>
          <input
            type="text"
            placeholder="e.g. Chronic headaches, rule out pneumonia"
            value={form.indication}
            onChange={(e) => updateField('indication', e.target.value)}
            style={inputStyle}
            disabled={submitting}
          />
        </div>

        {/* Findings summary */}
        <div>
          <label style={labelStyle}>Findings summary</label>
          <textarea
            rows={3}
            placeholder="Key findings from the radiologist report"
            value={form.findings_summary}
            onChange={(e) => updateField('findings_summary', e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' as const }}
            disabled={submitting}
          />
        </div>

        {/* Report text (optional) */}
        <div>
          <label style={labelStyle}>
            Full report text{' '}
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
            disabled={submitting}
          />
        </div>

        {/* Error message: blush-tinted, not saturated red */}
        {error && (
          <div
            className="flex flex-col gap-2 text-xs px-3 py-2 rounded-lg"
            role="alert"
            style={{
              background: 'rgba(212, 160, 160, 0.12)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(212, 160, 160, 0.3)',
            }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle
                size={14}
                strokeWidth={2}
                style={{ color: 'var(--accent-blush)' }}
              />
              {error}
            </div>
            {errorKind === 'unauth' && (
              <Link
                href="/login?next=/imaging"
                className="inline-flex items-center self-start text-xs font-semibold rounded-lg px-3 py-1.5"
                style={{
                  background: 'var(--accent-sage)',
                  color: 'var(--text-inverse)',
                  textDecoration: 'none',
                }}
              >
                Take me to login
              </Link>
            )}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            role="status"
            style={{
              background: 'rgba(107, 144, 128, 0.12)',
              color: 'var(--accent-sage)',
              border: '1px solid rgba(107, 144, 128, 0.3)',
            }}
          >
            <Check size={14} strokeWidth={2} />
            Saved. Your study is on file.
          </div>
        )}

        {/* Submit: fill-on-save pattern, no spinner */}
        <button
          type="submit"
          disabled={submitting || success}
          className="press-feedback flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 rounded-xl relative overflow-hidden"
          style={{
            background: 'var(--accent-sage)',
            color: '#fff',
            opacity: submitting || success ? 0.9 : 1,
            cursor: submitting ? 'not-allowed' : 'pointer',
            pointerEvents: submitting || success ? 'none' : 'auto',
            border: 'none',
            transition: 'opacity var(--duration-fast) var(--ease-standard)',
          }}
        >
          {submitting && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)',
                transform: 'translateX(-100%)',
                animation: 'fill-sweep 300ms var(--ease-decelerate) forwards',
              }}
            />
          )}
          {success ? (
            <>
              <Check size={16} strokeWidth={2.5} />
              Saved
            </>
          ) : submitting ? (
            <>Saving</>
          ) : (
            <>
              <Upload size={16} strokeWidth={2} />
              Save study
            </>
          )}
        </button>
      </form>

      {/* Local keyframe for fill-on-save sweep: scoped; no globals.css edit */}
      <style jsx>{`
        @keyframes fill-sweep {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}
