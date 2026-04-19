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

import { registerWidget } from '@/lib/home/widgets';
import { SleepLastNightWidget } from '@/components/sleep/widgets/SleepLastNightWidget';
import { ReadinessTodayWidget } from '@/components/sleep/widgets/ReadinessTodayWidget';
import { HrvTrend7dWidget } from '@/components/sleep/widgets/HrvTrend7dWidget';

registerWidget({
  id: 'sleep-last-night',
  label: 'Sleep last night',
  category: 'sleep',
  defaultEnabled: true,
  defaultOrder: 10,
  Component: SleepLastNightWidget,
});

registerWidget({
  id: 'readiness-today',
  label: 'Readiness today',
  category: 'sleep',
  defaultEnabled: true,
  defaultOrder: 20,
  Component: ReadinessTodayWidget,
});

registerWidget({
  id: 'hrv-trend-7d',
  label: 'HRV over 7 days',
  category: 'sleep',
  defaultEnabled: true,
  defaultOrder: 30,
  Component: HrvTrend7dWidget,
});
