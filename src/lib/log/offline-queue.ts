const QUEUE_KEY = 'lanae.offline.queue.v1'

export interface QueuedOperation {
  id: string
  kind: 'updateDailyLog' | 'addSymptom' | 'deleteSymptom' | 'updateSymptomSeverity' | 'addPainPoint' | 'addFoodEntry' | 'updateCycleEntry'
  payload: unknown
  createdAt: number
  attempts: number
}

interface QueueState {
  items: QueuedOperation[]
}

function read(): QueueState {
  if (typeof window === 'undefined') return { items: [] }
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return { items: [] }
    return JSON.parse(raw) as QueueState
  } catch {
    return { items: [] }
  }
}

function write(state: QueueState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(QUEUE_KEY, JSON.stringify(state))
}

export function enqueue(op: Omit<QueuedOperation, 'id' | 'createdAt' | 'attempts'>): QueuedOperation {
  const full: QueuedOperation = {
    ...op,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    attempts: 0,
  }
  const state = read()
  state.items.push(full)
  write(state)
  return full
}

export function drain(): QueuedOperation[] {
  const state = read()
  return state.items.slice()
}

export function removeOp(id: string): void {
  const state = read()
  state.items = state.items.filter(item => item.id !== id)
  write(state)
}

export function markAttempt(id: string): void {
  const state = read()
  const found = state.items.find(item => item.id === id)
  if (found) {
    found.attempts += 1
    write(state)
  }
}

export function queueSize(): number {
  return read().items.length
}

export function clearQueue(): void {
  write({ items: [] })
}
