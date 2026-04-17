import { format } from 'date-fns'

// Fire-and-forget rebuild of today's narrative chunk after a check-in save.
// Takes ~200-500ms server-side; we don't wait for it. Safe to call repeatedly.
let inflight: Promise<void> | null = null

export function refreshTodayNarrative(): Promise<void> {
  if (inflight) return inflight
  const today = format(new Date(), 'yyyy-MM-dd')
  inflight = fetch('/api/context/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start: today, end: today }),
  })
    .then(() => void 0)
    .catch(() => void 0)
    .finally(() => {
      inflight = null
    })
  return inflight
}
