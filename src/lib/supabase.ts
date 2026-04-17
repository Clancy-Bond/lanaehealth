import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy module-scoped clients. Previously these were created at module
// load time, which caused Vercel's build-time page-data collection phase
// to fail with "supabaseUrl is required" when env vars weren't injected
// for every worker. Creating the client on first call defers the env
// check until runtime, where the vars are always present.

let _publicClient: SupabaseClient | null = null

function getPublicClient(): SupabaseClient {
  if (_publicClient) return _publicClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set')
  }
  _publicClient = createClient(url, key)
  return _publicClient
}

// Proxy preserves the `import { supabase } from '@/lib/supabase'` API
// while deferring creation. Every property access resolves to the live
// client.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getPublicClient() as unknown as Record<string | symbol, unknown>
    const value = client[prop]
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client)
    }
    return value
  },
})

// Server-side client with service role for admin operations.
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set for service client',
    )
  }
  return createClient(url, key)
}
