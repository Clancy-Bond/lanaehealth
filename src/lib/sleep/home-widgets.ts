/**
 * Register the three Sleep home widgets.
 *
 * This file is imported once as a side-effect from
 * src/app/sleep/layout.tsx so `registerWidget()` runs when the sleep
 * tab mounts. Per docs/plans/2026-04-19-clone-prompts.md we do NOT
 * edit src/lib/home/widgets.ts directly; we simply call the exported
 * register function with our three widget descriptors.
 *
 * Widget ids are stable because they land in user-preference rows
 * (homeWidgetOrder / hiddenHomeWidgets). Renaming one is a breaking
 * change; see src/lib/api/user-preferences.ts.
 */

import { registerWidget, type HomeWidget } from '@/lib/home/widgets';
import { SleepLastNightWidget } from '@/lib/sleep/widgets/SleepLastNightWidget';
import { ReadinessTodayWidget } from '@/lib/sleep/widgets/ReadinessTodayWidget';
import { HrvTrend7dWidget } from '@/lib/sleep/widgets/HrvTrend7dWidget';

/**
 * Register once, tolerate re-imports during Next.js hot-module-reload.
 * HMR reruns this module each time a consumer edit triggers a rebuild,
 * which would otherwise hit the registry's duplicate-id guard. The
 * shell's registerWidget() throws on duplicates -- that's the right
 * behavior in prod and for tests, so we wrap here rather than mutate
 * the forbidden src/lib/home/widgets.ts.
 */
function safeRegister(widget: HomeWidget) {
  try {
    registerWidget(widget);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Duplicate home widget id')) {
      return;
    }
    throw err;
  }
}

safeRegister({
  id: 'sleep-last-night',
  label: 'Sleep last night',
  category: 'sleep',
  defaultEnabled: true,
  defaultOrder: 10,
  Component: SleepLastNightWidget,
});

safeRegister({
  id: 'readiness-today',
  label: 'Readiness today',
  category: 'sleep',
  defaultEnabled: true,
  defaultOrder: 20,
  Component: ReadinessTodayWidget,
});

safeRegister({
  id: 'hrv-trend-7d',
  label: 'HRV over 7 days',
  category: 'sleep',
  defaultEnabled: true,
  defaultOrder: 30,
  Component: HrvTrend7dWidget,
});
