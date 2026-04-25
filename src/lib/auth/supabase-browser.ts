/**
 * Browser-side Supabase client for client components.
 *
 * Used by signup/login/forgot-password forms and the sign-out
 * button. Reads/writes session cookies via @supabase/ssr so the
 * server can pick them up on the next request.
 */
'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY must be set for Supabase Auth',
    )
  }
  _client = createBrowserClient(url, anonKey)
  return _client
}
