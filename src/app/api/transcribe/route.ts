import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-user'
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Enforce server-side limits on untrusted uploads:
//   - 15 MB cap (~15 min of opus/webm at ~128 kbps). Well under the
//     Whisper API's 25 MB limit and plenty for any real voice log.
//   - Explicit content-type allowlist so the caller can't smuggle
//     arbitrary bytes by mislabeling the field.
const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const ALLOWED_CONTENT_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
])

function isAllowedContentType(type: string | undefined | null): boolean {
  if (!type) return false
  const normalized = type.toLowerCase().trim()
  if (ALLOWED_CONTENT_TYPES.has(normalized)) return true
  // Also allow the base type when a charset/params follow.
  const base = normalized.split(';')[0]?.trim() ?? ''
  return ALLOWED_CONTENT_TYPES.has(base)
}

export async function POST(req: NextRequest) {
  const audit = auditMetaFromRequest(req)
  const auth = requireAuth(req)
  if (!auth.ok) {
    await recordAuditEvent({
      endpoint: 'POST /api/transcribe',
      actor: audit.ip ?? 'unauthenticated',
      outcome: 'deny',
      status: 401,
      reason: 'auth',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return auth.response
  }

  const limit = checkRateLimit({
    scope: 'transcribe',
    max: 30,
    windowMs: 10 * 60 * 1000,
    key: clientIdFromRequest(req),
  })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
  }

  // Reject payloads larger than MAX_AUDIO_BYTES before parsing the form.
  // Next's formData() buffers the whole body, so this is the guard that
  // stops an attacker from uploading a multi-GB blob.
  const contentLengthHeader = req.headers.get('content-length')
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader)
    if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES) {
      await recordAuditEvent({
        endpoint: 'POST /api/transcribe',
        actor: `via:`,
        outcome: 'deny',
        status: 413,
        reason: 'size-limit',
        bytes: contentLength,
        ip: audit.ip,
        userAgent: audit.userAgent,
      })
      return NextResponse.json(
        { error: `audio exceeds ${MAX_AUDIO_BYTES}-byte limit` },
        { status: 413 },
      )
    }
  }

  let incoming: FormData
  try {
    incoming = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid multipart body' }, { status: 400 })
  }

  const file = incoming.get('audio')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'audio file required' }, { status: 400 })
  }

  if (file.size > MAX_AUDIO_BYTES) {
    await recordAuditEvent({
      endpoint: 'POST /api/transcribe',
      actor: `via:`,
      outcome: 'deny',
      status: 413,
      reason: 'size-limit',
      bytes: file.size,
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return NextResponse.json(
      { error: `audio exceeds ${MAX_AUDIO_BYTES}-byte limit` },
      { status: 413 },
    )
  }

  if (!isAllowedContentType(file.type)) {
    await recordAuditEvent({
      endpoint: 'POST /api/transcribe',
      actor: `via:`,
      outcome: 'deny',
      status: 415,
      reason: 'content-type',
      ip: audit.ip,
      userAgent: audit.userAgent,
      meta: { content_type: file.type || null },
    })
    return NextResponse.json(
      { error: 'unsupported audio content-type' },
      { status: 415 },
    )
  }

  const forward = new FormData()
  forward.append('file', file, file.name || 'audio.webm')
  forward.append('model', 'whisper-1')
  forward.append('response_format', 'json')
  forward.append('language', 'en')

  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: forward,
    })
  } catch (err) {
    console.error('[transcribe] network error:', err)
    return NextResponse.json({ error: 'Whisper upstream unreachable' }, { status: 502 })
  }

  if (!res.ok) {
    // Log the upstream body server-side but do not echo it back. Whisper
    // errors can include the submitted filename, which may carry PHI.
    const upstreamText = await res.text().catch(() => '')
    console.error(`[transcribe] Whisper ${res.status}:`, upstreamText.slice(0, 500))
    await recordAuditEvent({
      endpoint: 'POST /api/transcribe',
      actor: `via:`,
      outcome: 'error',
      status: 502,
      reason: 'whisper-upstream',
      ip: audit.ip,
      userAgent: audit.userAgent,
      meta: { upstream_status: res.status },
    })
    return NextResponse.json(
      { error: `Whisper returned ${res.status}` },
      { status: 502 },
    )
  }

  let json: { text?: string }
  try {
    json = (await res.json()) as { text?: string }
  } catch {
    return NextResponse.json({ error: 'Whisper returned malformed JSON' }, { status: 502 })
  }

  await recordAuditEvent({
    endpoint: 'POST /api/transcribe',
    actor: `via:`,
    outcome: 'allow',
    status: 200,
    bytes: file.size,
    ip: audit.ip,
    userAgent: audit.userAgent,
    meta: { content_type: file.type },
  })

  return NextResponse.json({ text: json.text ?? '' })
}
