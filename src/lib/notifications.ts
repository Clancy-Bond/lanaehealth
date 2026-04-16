/**
 * Browser Notification System
 *
 * Handles medication reminders and other push notifications.
 * Uses the browser Notification API with a lightweight scheduler.
 *
 * No service worker needed for basic notifications -- we schedule
 * them client-side and fire when the app is open. For background
 * notifications, a service worker + push subscription would be added later.
 */

export interface ScheduledReminder {
  id: string
  medicationName: string
  dose: string | null
  scheduledTime: string          // HH:MM format
  daysOfWeek: number[]           // 0=Sun, 1=Mon, ..., 6=Sat. Empty = every day
  isActive: boolean
}

// ── Permission ─────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function hasNotificationPermission(): boolean {
  if (!('Notification' in window)) return false
  return Notification.permission === 'granted'
}

// ── Send Notification ──────────────────────────────────────────────

export function sendMedicationReminder(reminder: ScheduledReminder): void {
  if (!hasNotificationPermission()) return

  const body = reminder.dose
    ? `Time to take ${reminder.medicationName} (${reminder.dose})`
    : `Time to take ${reminder.medicationName}`

  const notification = new Notification('Medication Reminder', {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `med-${reminder.id}`,
    requireInteraction: true, // Stay until dismissed (persistent reminder)
    silent: false,
  })

  // Auto-close after 5 minutes if not interacted with
  setTimeout(() => notification.close(), 5 * 60 * 1000)

  notification.onclick = () => {
    window.focus()
    notification.close()
    // Navigate to log page to record the dose
    window.location.href = '/log'
  }
}

// ── Scheduler ──────────────────────────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null
let activeReminders: ScheduledReminder[] = []
const firedToday = new Set<string>()

/**
 * Start the reminder scheduler. Checks every minute for due reminders.
 */
export function startReminderScheduler(reminders: ScheduledReminder[]): void {
  activeReminders = reminders.filter(r => r.isActive)

  if (schedulerInterval) {
    clearInterval(schedulerInterval)
  }

  // Check immediately, then every 60 seconds
  checkReminders()
  schedulerInterval = setInterval(checkReminders, 60 * 1000)
}

export function stopReminderScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
}

export function updateReminders(reminders: ScheduledReminder[]): void {
  activeReminders = reminders.filter(r => r.isActive)
}

function checkReminders(): void {
  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const currentDay = now.getDay()
  const todayStr = now.toISOString().slice(0, 10)

  for (const reminder of activeReminders) {
    // Check if this reminder is for today
    if (reminder.daysOfWeek.length > 0 && !reminder.daysOfWeek.includes(currentDay)) {
      continue
    }

    // Check if it's the right time (within 1 minute window)
    if (reminder.scheduledTime !== currentTime) continue

    // Check if already fired today
    const fireKey = `${reminder.id}_${todayStr}`
    if (firedToday.has(fireKey)) continue

    // Fire the notification
    firedToday.add(fireKey)
    sendMedicationReminder(reminder)
  }

  // Clean up old fired entries (reset at midnight)
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    firedToday.clear()
  }
}

// ── Local Storage Persistence ──────────────────────────────────────

const REMINDERS_KEY = 'lanaehealth_med_reminders'

export function saveRemindersToStorage(reminders: ScheduledReminder[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders))
}

export function loadRemindersFromStorage(): ScheduledReminder[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(REMINDERS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}
