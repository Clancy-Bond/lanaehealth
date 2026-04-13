import { NextResponse } from 'next/server'
import { disconnectOura } from '@/lib/oura'

export async function POST() {
  try {
    await disconnectOura()
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
