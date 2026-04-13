import { getOrCreateTodayLog } from '@/lib/api/logs'
import { getSymptoms } from '@/lib/api/symptoms'
import { getFoodEntries } from '@/lib/api/food'
import { getOrCreateTodayCycleEntry } from '@/lib/api/cycle'
import DailyLogClient from '@/components/log/DailyLogClient'

export default async function LogPage() {
  // Fetch all data in parallel
  const log = await getOrCreateTodayLog()

  const [symptoms, foodEntries, cycleEntry] = await Promise.all([
    getSymptoms(log.id),
    getFoodEntries(log.id),
    getOrCreateTodayCycleEntry(),
  ])

  return (
    <DailyLogClient
      log={log}
      symptoms={symptoms}
      foodEntries={foodEntries}
      cycleEntry={cycleEntry}
    />
  )
}
