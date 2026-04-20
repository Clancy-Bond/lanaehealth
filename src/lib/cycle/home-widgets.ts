/**
 * Cycle tab home widget registration.
 *
 * Imported once from src/app/cycle/layout.tsx so the side-effect runs
 * regardless of which surface served first. registerWidget() throws on
 * duplicate ids, so we guard with try/catch to survive hot reloads in
 * dev where the module can execute twice.
 */
import { registerWidget } from '@/lib/home/widgets'
import { CycleTodayRingWidget } from '@/components/cycle/widgets/CycleTodayRingWidget'
import { NextPeriodCountdownWidget } from '@/components/cycle/widgets/NextPeriodCountdownWidget'
import { FertilityWindowWidget } from '@/components/cycle/widgets/FertilityWindowWidget'

function safeRegister(
  widget: Parameters<typeof registerWidget>[0],
): void {
  try {
    registerWidget(widget)
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Duplicate home widget id:')) {
      return
    }
    throw err
  }
}

safeRegister({
  id: 'cycle-today-ring',
  label: 'Cycle today (day + phase)',
  category: 'cycle',
  defaultEnabled: true,
  defaultOrder: 220,
  Component: CycleTodayRingWidget,
})

safeRegister({
  id: 'next-period-countdown',
  label: 'Next period countdown',
  category: 'cycle',
  defaultEnabled: true,
  defaultOrder: 222,
  Component: NextPeriodCountdownWidget,
})

safeRegister({
  id: 'fertility-window-now',
  label: 'Fertility window (today)',
  category: 'cycle',
  defaultEnabled: false,
  defaultOrder: 224,
  Component: FertilityWindowWidget,
})
