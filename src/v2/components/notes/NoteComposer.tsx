'use client'

/**
 * NoteComposer
 *
 * Modal sheet that slides up from the bottom over the current page.
 * Type or hold-to-speak. Save persists to /api/notes (verbatim) and
 * dismisses; voice transcription runs through /api/transcribe.
 *
 * Time stamp = the moment the modal opened, not save-press, so a "took
 * Tylenol 5 mins ago" note carries the right anchor even if she takes
 * 30 seconds to compose.
 *
 * No counters, streaks, or guilt copy. NC voice ("How are you feeling?"
 * not "Log your symptoms"). Cream/blush/sage palette per the
 * "explanatory surface" rule in CLAUDE.md.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface SavedNoteHandoff {
  noteId: string
  capturedAt: string
}

interface Props {
  open: boolean
  onClose: () => void
  /**
   * Called after a successful save with the new note id. The parent
   * can use this to fire AI extraction in the background and surface
   * the resulting chip toast.
   */
  onSaved?: (note: SavedNoteHandoff) => void
}

const PROMPTS = [
  'How are you feeling?',
  'Anything to remember?',
  "What's on your mind?",
] as const

function pickPrompt(): string {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)]
}

interface RecorderState {
  recording: boolean
  uploading: boolean
  errorMessage: string | null
}

export default function NoteComposer({ open, onClose, onSaved }: Props) {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [body, setBody] = useState('')
  const [prompt, setPrompt] = useState<string>(PROMPTS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const capturedAtRef = useRef<string>(new Date().toISOString())
  const sourceRef = useRef<'text' | 'voice' | 'mixed'>('text')
  const [recorder, setRecorder] = useState<RecorderState>({
    recording: false,
    uploading: false,
    errorMessage: null,
  })
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Reset on open. captured_at is fixed at modal-open time so a slow
  // composer does not drift the clinical timestamp.
  useEffect(() => {
    if (!open) return
    setBody('')
    setError(null)
    setSaving(false)
    setPrompt(pickPrompt())
    sourceRef.current = 'text'
    capturedAtRef.current = new Date().toISOString()
    setRecorder({ recording: false, uploading: false, errorMessage: null })
    // Auto-focus the textarea after the sheet animation.
    const t = window.setTimeout(() => textareaRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [open])

  // Escape closes; cmd/ctrl+enter saves.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, body])

  async function save() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const resp = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          body: trimmed,
          source: sourceRef.current,
          captured_at: capturedAtRef.current,
        }),
      })
      if (!resp.ok) {
        const err = (await resp.json().catch(() => ({}))) as { error?: string }
        if (resp.status === 503) {
          setError(
            err.error ?? 'The notes table is not migrated yet. Try again later.',
          )
        } else {
          setError(err.error ?? 'Save failed. Try again.')
        }
        setSaving(false)
        return
      }
      const data = (await resp.json().catch(() => ({}))) as {
        id?: string
        captured_at?: string
      }
      onClose()
      // Refresh whatever screen she returns to so the new note shows up.
      router.refresh()
      if (data.id && data.captured_at) {
        onSaved?.({ noteId: data.id, capturedAt: data.captured_at })
      }
    } catch {
      setError('Network hiccup. Check your connection and try again.')
      setSaving(false)
    }
  }

  async function startRecording() {
    if (recorder.recording || recorder.uploading) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecorder((r) => ({ ...r, errorMessage: 'Microphone is not available on this device.' }))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        // Stop the mic LED.
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        chunksRef.current = []
        await uploadAudio(blob, mr.mimeType || 'audio/webm')
      }
      mr.start()
      setRecorder({ recording: true, uploading: false, errorMessage: null })
    } catch {
      setRecorder({
        recording: false,
        uploading: false,
        errorMessage: 'Could not access the microphone. Check your browser permission.',
      })
    }
  }

  function stopRecording() {
    const mr = mediaRef.current
    if (!mr) return
    if (mr.state === 'recording') {
      setRecorder({ recording: false, uploading: true, errorMessage: null })
      mr.stop()
    }
  }

  async function uploadAudio(blob: Blob, contentType: string) {
    try {
      const fd = new FormData()
      // Whisper accepts the blob with a friendly extension hint.
      const ext = contentType.includes('mp4')
        ? 'm4a'
        : contentType.includes('ogg')
          ? 'ogg'
          : 'webm'
      fd.append('audio', new File([blob], `note.${ext}`, { type: contentType }))
      const resp = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (!resp.ok) {
        const err = (await resp.json().catch(() => ({}))) as { error?: string }
        setRecorder({
          recording: false,
          uploading: false,
          errorMessage: err.error ?? "Couldn't catch that. Try again or type.",
        })
        return
      }
      const data = (await resp.json()) as { text?: string }
      const transcript = (data.text ?? '').trim()
      if (transcript) {
        setBody((cur) => {
          const sep = cur.trim() ? '\n' : ''
          // If the existing body was already typed, mark mixed; if not, voice-only.
          sourceRef.current = cur.trim() ? 'mixed' : 'voice'
          return cur + sep + transcript
        })
      }
      setRecorder({ recording: false, uploading: false, errorMessage: null })
      window.setTimeout(() => textareaRef.current?.focus(), 0)
    } catch {
      setRecorder({
        recording: false,
        uploading: false,
        errorMessage: 'Network hiccup while transcribing. Try again or type.',
      })
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-composer-prompt"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        animation: 'v2-fade-in 200ms ease-out',
      }}
      onClick={(e) => {
        // Click on the backdrop dismisses; click inside does not.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          background: 'var(--v2-surface-explanatory-card)',
          color: 'var(--v2-surface-explanatory-text)',
          borderTopLeftRadius: 'var(--v2-radius-xl)',
          borderTopRightRadius: 'var(--v2-radius-xl)',
          paddingBottom: 'calc(var(--v2-safe-bottom) + var(--v2-space-3))',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--v2-shadow-lg)',
          animation: 'v2-slide-up 280ms cubic-bezier(0.2, 0.7, 0.2, 1)',
        }}
      >
        {/* Header: Cancel · Save */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--v2-space-3) var(--v2-space-4)',
            borderBottom: '1px solid var(--v2-surface-explanatory-border)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={btnStyle('ghost')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || body.trim().length === 0}
            style={btnStyle('primary', body.trim().length === 0 || saving)}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </header>

        {/* Body: prompt + textarea + mic */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-3)',
            padding: 'var(--v2-space-4)',
            overflow: 'auto',
          }}
        >
          <h2
            id="note-composer-prompt"
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-xl)',
              fontWeight: 'var(--v2-weight-medium)',
              color: 'var(--v2-surface-explanatory-text)',
            }}
          >
            {prompt}
          </h2>

          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type or hold the mic to speak"
            rows={6}
            disabled={saving}
            style={{
              width: '100%',
              minHeight: 160,
              padding: 'var(--v2-space-3)',
              fontFamily: 'inherit',
              fontSize: 'var(--v2-text-base)',
              lineHeight: 1.5,
              borderRadius: 'var(--v2-radius-md)',
              border: '1px solid var(--v2-surface-explanatory-border)',
              background: 'var(--v2-surface-explanatory-bg)',
              color: 'var(--v2-surface-explanatory-text)',
              resize: 'vertical',
              outline: 'none',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--v2-space-3)',
            }}
          >
            <MicButton recorder={recorder} onPressStart={startRecording} onPressEnd={stopRecording} />
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTimestamp(capturedAtRef.current)}
            </span>
          </div>

          {recorder.errorMessage && (
            <p
              role="alert"
              style={{
                margin: 0,
                color: 'var(--v2-accent-danger)',
                fontSize: 'var(--v2-text-sm)',
              }}
            >
              {recorder.errorMessage}
            </p>
          )}

          {error && (
            <p
              role="alert"
              style={{
                margin: 0,
                color: 'var(--v2-accent-danger)',
                fontSize: 'var(--v2-text-sm)',
              }}
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Mic button (hold-to-speak) ─────────────────────────────────────

function MicButton({
  recorder,
  onPressStart,
  onPressEnd,
}: {
  recorder: RecorderState
  onPressStart: () => void
  onPressEnd: () => void
}) {
  const label = recorder.recording
    ? 'Listening…'
    : recorder.uploading
      ? 'Transcribing…'
      : 'Hold to speak'

  return (
    <button
      type="button"
      aria-label="Hold to dictate, release to transcribe"
      aria-pressed={recorder.recording}
      disabled={recorder.uploading}
      onPointerDown={(e) => {
        e.preventDefault()
        onPressStart()
      }}
      onPointerUp={(e) => {
        e.preventDefault()
        onPressEnd()
      }}
      onPointerCancel={() => onPressEnd()}
      onPointerLeave={() => {
        if (recorder.recording) onPressEnd()
      }}
      style={{
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--v2-space-2)',
        padding: 'var(--v2-space-2) var(--v2-space-4)',
        borderRadius: 'var(--v2-radius-full)',
        border: '1px solid var(--v2-surface-explanatory-border)',
        background: recorder.recording
          ? 'var(--v2-accent-danger-soft, #FEE)'
          : 'var(--v2-surface-explanatory-bg)',
        color: recorder.recording
          ? 'var(--v2-accent-danger)'
          : 'var(--v2-surface-explanatory-text)',
        fontFamily: 'inherit',
        fontSize: 'var(--v2-text-sm)',
        fontWeight: 'var(--v2-weight-semibold)',
        cursor: recorder.uploading ? 'progress' : 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        minHeight: 44,
        minWidth: 140,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: recorder.recording
            ? 'var(--v2-accent-danger)'
            : 'var(--v2-text-secondary)',
          animation: recorder.recording ? 'v2-pulse 1.2s ease-in-out infinite' : 'none',
        }}
      />
      {label}
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────────────

function btnStyle(variant: 'primary' | 'ghost', disabled = false): React.CSSProperties {
  if (variant === 'primary') {
    return {
      appearance: 'none',
      border: 'none',
      background: disabled
        ? 'var(--v2-surface-explanatory-border)'
        : 'var(--v2-accent-primary)',
      color: 'var(--v2-on-accent)',
      padding: 'var(--v2-space-2) var(--v2-space-4)',
      borderRadius: 'var(--v2-radius-full)',
      fontFamily: 'inherit',
      fontSize: 'var(--v2-text-sm)',
      fontWeight: 'var(--v2-weight-semibold)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      minHeight: 36,
    }
  }
  return {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--v2-text-muted)',
    padding: 'var(--v2-space-2)',
    fontFamily: 'inherit',
    fontSize: 'var(--v2-text-sm)',
    fontWeight: 'var(--v2-weight-medium)',
    cursor: 'pointer',
  }
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
