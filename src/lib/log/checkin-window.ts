export type CheckInWindow = 'morning' | 'evening' | 'offhours'

export function getCheckInWindow(now: Date = new Date()): CheckInWindow {
  const h = now.getHours()
  if (h >= 6 && h < 11) return 'morning'
  if (h >= 18 && h < 24) return 'evening'
  return 'offhours'
}

export function nextWindowLabel(now: Date = new Date()): string {
  const h = now.getHours()
  if (h >= 11 && h < 18) return 'Evening check-in opens at 6pm'
  if (h >= 0 && h < 6) return 'Morning check-in opens at 6am'
  return ''
}
