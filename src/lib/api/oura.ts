import { supabase } from '@/lib/supabase'
import type { OuraDaily } from '@/lib/types'

/**
 * Get Oura biometric data for a date range
 */
export async function getOuraData(startDate: string, endDate: string): Promise<OuraDaily[]> {
  const { data, error } = await supabase
    .from('oura_daily')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error) throw new Error(`Failed to fetch Oura data: ${error.message}`)
  return (data || []) as OuraDaily[]
}

/**
 * Get the latest Oura sync timestamp
 */
export async function getLastSyncTime(): Promise<string | null> {
  const { data, error } = await supabase
    .from('oura_daily')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data.synced_at as string
}

/**
 * Check if Oura is connected by checking for tokens
 */
export async function checkOuraConnection(): Promise<boolean> {
  const { data } = await supabase
    .from('oura_tokens')
    .select('id')
    .limit(1)
    .maybeSingle()

  return !!data
}

/**
 * Trigger a sync for a date range via the API route
 */
export async function triggerSync(startDate: string, endDate: string) {
  const res = await fetch('/api/oura/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_date: startDate, end_date: endDate }),
  })

  if (!res.ok) {
    const body = await res.json()
    throw new Error(body.error || 'Sync failed')
  }

  return res.json()
}

/**
 * Disconnect Oura via API
 */
export async function disconnectOuraClient() {
  const { error } = await supabase
    .from('oura_tokens')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) throw new Error(`Failed to disconnect: ${error.message}`)
}
