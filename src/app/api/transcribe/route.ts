import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
  }

  const incoming = await req.formData()
  const file = incoming.get('audio')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'audio file required' }, { status: 400 })
  }

  const forward = new FormData()
  forward.append('file', file, file.name || 'audio.webm')
  forward.append('model', 'whisper-1')
  forward.append('response_format', 'json')
  forward.append('language', 'en')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: forward,
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Whisper failed: ${res.status} ${text}` }, { status: 502 })
  }

  const json = (await res.json()) as { text: string }
  return NextResponse.json({ text: json.text })
}
