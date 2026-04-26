import { createServiceClient } from '@/lib/supabase'

/**
 * Retrieves a cached API response from the `api_cache` Supabase table.
 * Returns null if no valid (non-expired) cache entry exists.
 *
 * The returned value is typed `unknown` because cached payloads come from
 * many external APIs with different shapes. Callers cast to their expected
 * domain type once they have validated the source.
 */
export async function getCached(apiName: string, cacheKey: string): Promise<unknown | null> {
  try {
    const supabase = createServiceClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('api_cache')
      .select('response_json')
      .eq('api_name', apiName)
      .eq('cache_key', cacheKey)
      .gt('expires_at', now)
      .order('cached_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    return data.response_json
  } catch {
    return null
  }
}

/**
 * Stores an API response in the `api_cache` Supabase table.
 * Uses upsert keyed on (api_name, cache_key) so repeated calls overwrite stale entries.
 * @param ttlDays - number of days until this cache entry expires (default 7)
 */
export async function setCache(
  apiName: string,
  cacheKey: string,
  data: unknown,
  ttlDays: number = 7
): Promise<void> {
  try {
    const supabase = createServiceClient()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000)

    await supabase.from('api_cache').upsert(
      {
        api_name: apiName,
        cache_key: cacheKey,
        response_json: data,
        cached_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'api_name,cache_key' }
    )
  } catch (err) {
    console.warn('[cache] Failed to write cache entry:', err)
  }
}
