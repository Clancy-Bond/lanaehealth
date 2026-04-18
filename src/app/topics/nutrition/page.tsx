/**
 * Legacy redirect: /topics/nutrition was the original nutrition topic
 * page. As of 2026-04-17 the full MyNetDiary-equivalent dashboard
 * lives at /calories (top-level, surfaced from Home by a dedicated
 * "Calories" button). Preserve the old URL as a redirect so any
 * existing links or citations keep working.
 */

import { redirect } from 'next/navigation';

export default function LegacyNutritionTopic() {
  redirect('/calories');
}
