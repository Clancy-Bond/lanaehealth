/**
 * Server-side Supabase client wired to Next.js cookies.
 *
 * Returns a Supabase client that reads and writes the auth session
 * via the request's cookie store. Use inside Server Components,
 * Server Actions, Route Handlers, and the middleware.
 *
 * The client uses the anon key, not the service role. Auth state
 * comes from the cookies the SDK sets on sign-in. Row-level reads
 * stay scoped by Postgres RLS once we enable it; until then this
 * client is mainly used to identify the requesting user.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

function readEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY must be set for Supabase Auth',
    )
  }
  return { url, anonKey }
}

/**
 * Build a Supabase client bound to the current request's cookie
 * jar. Must be called inside a Server Component, Route Handler,
 * Server Action, or middleware.
 *
 * Next.js `cookies()` is async in app router; this helper hides
 * that detail behind a single await point.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, anonKey } = readEnv()
  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }))
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({ name, value, ...(options as CookieOptions) })
          }
        } catch {
          // `cookies().set()` throws when called from a Server
          // Component context (read-only). The middleware writes
          // session cookies on its own response object, so this
          // try/catch is the documented pattern from the SDK.
        }
      },
    },
  })
}
