import { createServiceClient } from '@/lib/supabase'
import type { DailyLog, Symptom, FoodEntry, CycleEntry } from '@/lib/types'
import { format } from 'date-fns'
import DailyLogClient from '@/components/log/DailyLogClient'

export default async function LogPage() {
  const sb = createServiceClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  // Get or create today's daily log
  const { data: existing } = await sb
    .from('daily_logs')
    .select('*')
    .eq('date', today)
    .maybeSingle()

  let log: DailyLog
  if (existing) {
    log = existing as DailyLog
  } else {
    const { data: created, error } = await sb
      .from('daily_logs')
      .insert({ date: today })
      .select()
      .single()
    if (error) throw new Error(`Failed to create today's log: ${error.message}`)
    log = created as DailyLog
  }

  // Get or create today's cycle entry
  const { data: existingCycle } = await sb
    .from('cycle_entries')
    .select('*')
    .eq('date', today)
    .maybeSingle()

  let cycleEntry: CycleEntry
  if (existingCycle) {
    cycleEntry = existingCycle as CycleEntry
  } else {
    const { data: createdCycle, error } = await sb
      .from('cycle_entries')
      .insert({ date: today, menstruation: false })
      .select()
      .single()
    if (error) throw new Error(`Failed to create cycle entry: ${error.message}`)
    cycleEntry = createdCycle as CycleEntry
  }

  // Fetch symptoms and food entries in parallel
  const [symptomsResult, foodResult] = await Promise.all([
    sb
      .from('symptoms')
      .select('*')
      .eq('log_id', log.id)
      .order('logged_at', { ascending: true }),
    sb
      .from('food_entries')
      .select('*')
      .eq('log_id', log.id)
      .order('logged_at', { ascending: false }),
  ])

  const symptoms = (symptomsResult.data || []) as Symptom[]
  const foodEntries = (foodResult.data || []) as FoodEntry[]

  return (
    <DailyLogClient
      log={log}
      symptoms={symptoms}
      foodEntries={foodEntries}
      cycleEntry={cycleEntry}
    />
  )
}
