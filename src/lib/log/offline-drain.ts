import { drain, markAttempt, removeOp } from './offline-queue'
import { updateDailyLog } from '@/lib/api/logs'
import { addSymptom, deleteSymptom, updateSymptomSeverity } from '@/lib/api/symptoms'
import { addPainPoint } from '@/lib/api/logs'
import { addFoodEntry } from '@/lib/api/food'
import { updateCycleEntry } from '@/lib/api/cycle'
import type { SymptomInput, PainPointInput, DailyLog, CycleEntry, MealType } from '@/lib/types'

let draining = false

export async function drainQueueOnce(): Promise<{ processed: number; failed: number }> {
  if (draining) return { processed: 0, failed: 0 }
  draining = true
  let processed = 0
  let failed = 0
  try {
    const items = drain()
    for (const op of items) {
      if (op.attempts >= 5) {
        removeOp(op.id)
        continue
      }
      try {
        await runOp(op.kind, op.payload)
        removeOp(op.id)
        processed++
      } catch {
        markAttempt(op.id)
        failed++
      }
    }
  } finally {
    draining = false
  }
  return { processed, failed }
}

async function runOp(kind: string, payload: unknown): Promise<void> {
  switch (kind) {
    case 'updateDailyLog': {
      const p = payload as { logId: string; fields: Partial<DailyLog> }
      await updateDailyLog(p.logId, p.fields)
      return
    }
    case 'addSymptom': {
      await addSymptom(payload as SymptomInput)
      return
    }
    case 'deleteSymptom': {
      await deleteSymptom((payload as { id: string }).id)
      return
    }
    case 'updateSymptomSeverity': {
      const p = payload as { id: string; severity: 'mild' | 'moderate' | 'severe' }
      await updateSymptomSeverity(p.id, p.severity)
      return
    }
    case 'addPainPoint': {
      await addPainPoint(payload as PainPointInput)
      return
    }
    case 'addFoodEntry': {
      const p = payload as { log_id: string; meal_type: MealType; food_items: string; flagged_triggers: string[] }
      await addFoodEntry(p)
      return
    }
    case 'updateCycleEntry': {
      const p = payload as { date: string; fields: Partial<Omit<CycleEntry, 'id' | 'date' | 'created_at'>> }
      await updateCycleEntry(p.date, p.fields)
      return
    }
    default:
      throw new Error(`unknown queue op: ${kind}`)
  }
}

export function startOfflineAutoDrain(): () => void {
  if (typeof window === 'undefined') return () => {}
  const onOnline = () => { drainQueueOnce() }
  window.addEventListener('online', onOnline)
  const id = window.setInterval(() => {
    if (navigator.onLine) drainQueueOnce()
  }, 15000)
  drainQueueOnce()
  return () => {
    window.removeEventListener('online', onOnline)
    window.clearInterval(id)
  }
}
