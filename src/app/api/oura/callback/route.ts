import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, storeTokens } from '@/lib/oura'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?oura_error=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings?oura_error=no_code', request.url)
    )
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await storeTokens(tokens)

    return NextResponse.redirect(
      new URL('/settings?oura_connected=true', request.url)
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(`/settings?oura_error=${encodeURIComponent(message)}`, request.url)
    )
  }
}
