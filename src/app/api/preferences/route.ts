/**
 * User Preferences API Route
 *
 * GET /api/preferences - Get current user preferences
 * PUT /api/preferences - Update preferences (partial update)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getPreferences,
  savePreferences,
  MODULE_DEFINITIONS,
  getDefaultModulesForArchetype,
  CONDITION_PRESETS,
} from '@/lib/api/user-preferences'
import type { UserArchetype, FeatureModule } from '@/lib/api/user-preferences'

export async function GET() {
  const prefs = await getPreferences()

  // If no preferences exist, return defaults
  if (!prefs) {
    const defaults = MODULE_DEFINITIONS.filter(m => m.defaultEnabled).map(m => m.id)
    return NextResponse.json({
      userArchetype: null,
      enabledModules: defaults,
      conditions: [],
      connectedApps: [],
      logSectionOrder: [],
      hiddenSections: [],
      homeWidgetOrder: [],
      hiddenHomeWidgets: [],
      onboardingCompletedAt: null,
      moduleDefinitions: MODULE_DEFINITIONS,
      conditionPresets: CONDITION_PRESETS,
    })
  }

  return NextResponse.json({
    ...prefs,
    moduleDefinitions: MODULE_DEFINITIONS,
    conditionPresets: CONDITION_PRESETS,
  })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()

  // If archetype is being set, merge default modules
  if (body.userArchetype && !body.enabledModules) {
    const defaults = getDefaultModulesForArchetype(body.userArchetype as UserArchetype)

    // If conditions are specified, merge in condition preset modules
    const conditionModules: FeatureModule[] = []
    if (body.conditions?.length) {
      for (const condition of body.conditions) {
        const preset = CONDITION_PRESETS.find(p => p.condition === condition)
        if (preset) conditionModules.push(...preset.enabledModules)
      }
    }

    body.enabledModules = [...new Set([...defaults, ...conditionModules])]
  }

  await savePreferences(body)

  return NextResponse.json({ success: true })
}
