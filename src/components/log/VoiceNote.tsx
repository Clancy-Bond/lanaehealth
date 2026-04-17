'use client'

import { useState, useRef, useCallback } from 'react'

interface VoiceNoteProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

type Status = 'idle' | 'recording' | 'transcribing' | 'error'

export default function VoiceNote({ onTranscript, disabled = false }: VoiceNoteProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    try {
      setErrorMsg('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stopStream()
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size === 0) {
          setStatus('idle')
          return
        }
        setStatus('transcribing')
        try {
          const form = new FormData()
          form.append('audio', blob, 'note.webm')
          const res = await fetch('/api/transcribe', { method: 'POST', body: form })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const { text } = (await res.json()) as { text: string }
          if (text) onTranscript(text.trim())
          setStatus('idle')
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'transcription failed'
          setErrorMsg(msg)
          setStatus('error')
          setTimeout(() => setStatus('idle'), 3000)
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setStatus('recording')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'microphone permission denied'
      setErrorMsg(msg)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }, [onTranscript, stopStream])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
  }, [])

  const label = status === 'recording' ? 'Stop' : status === 'transcribing' ? 'Working' : status === 'error' ? 'Retry' : 'Voice'
  const bg = status === 'recording' ? '#D4A0A0' : '#6B9080'

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={status === 'recording' ? stop : start}
        disabled={disabled || status === 'transcribing'}
        className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
        style={{
          background: bg,
          color: '#fff',
          opacity: disabled || status === 'transcribing' ? 0.6 : 1,
          transition: `background var(--duration-fast) var(--ease-standard)`,
        }}
        aria-label={status === 'recording' ? 'Stop recording' : 'Start voice note'}
      >
        <span
          aria-hidden
          className="inline-block w-2 h-2 rounded-full"
          style={{
            background: status === 'recording' ? '#fff' : 'rgba(255,255,255,0.7)',
            animation: status === 'recording' ? 'pulse 1s infinite' : undefined,
          }}
        />
        {label}
      </button>
      {status === 'error' ? (
        <span className="text-xs" style={{ color: '#D4A0A0' }}>
          {errorMsg}
        </span>
      ) : status === 'transcribing' ? (
        <span className="text-xs" style={{ color: '#8a8a8a' }}>Transcribing</span>
      ) : null}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
