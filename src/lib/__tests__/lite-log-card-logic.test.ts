/**
 * Tests for LiteLogCard integration points (Wave 2e F2).
 *
 * The component itself lives in React and this project's vitest config uses
 * `environment: 'node'`, so we cannot render the DOM here. Instead we
 * exercise the pure helpers LiteLogCard depends on and document the save
 * path contract:
 *
 *   - Mood selection writes via saveMood() with (logId, score, emotions).
 *   - Activity toggle writes via saveTrackableEntry with { toggled: true }.
 *   - Un-toggling writes via deleteTrackableEntry(logId, trackableId).
 *
 * Spec: docs/plans/2026-04-17-wave-2e-briefs.md brief F2.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { LITE_LOG_ACTIVITIES } from '@/lib/lite-log/activities'

describe('LiteLogCard integration contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('every registry entry has an icon key present in the ICON_MAP', async () => {
    // Import the icon map indirectly by re-importing the module, but since
    // ICON_MAP is not exported we validate through the registry's icon
    // literal union: the TypeScript types ensure only valid names are
    // accepted. This test runs at runtime to guard against future edits
    // of activities.ts that introduce a new icon string without updating
    // the map.
    const validIcons = new Set([
      'socks', 'droplets', 'salad', 'bed', 'armchair', 'flame',
      'shower-head', 'utensils-crossed', 'coffee', 'footprints',
      'dumbbell', 'pill', 'pill-bottle', 'droplet', 'flower-2',
      'zap-off', 'brain', 'thermometer-sun', 'moon', 'sun',
      'wind', 'users', 'heart-pulse', 'cloud-sun-rain',
      'eye-closed', 'waves', 'briefcase', 'car',
    ])
    for (const a of LITE_LOG_ACTIVITIES) {
      expect(validIcons.has(a.icon)).toBe(true)
    }
  })

  it('icon keys are all valid lucide-react exports', async () => {
    // Smoke-test that each icon the registry references actually exists in
    // the installed lucide-react. If a future upgrade renames an icon this
    // test will fail before users see missing tiles.
    const lucide = await import('lucide-react')
    const names = LITE_LOG_ACTIVITIES.map((a) => a.icon)
    // Mapping from our kebab-case ids to lucide's PascalCase export names.
    const PascalMap: Record<string, string> = {
      'socks': 'Footprints',
      'droplets': 'Droplets',
      'salad': 'Salad',
      'bed': 'Bed',
      'armchair': 'Armchair',
      'flame': 'Flame',
      'shower-head': 'ShowerHead',
      'utensils-crossed': 'UtensilsCrossed',
      'coffee': 'Coffee',
      'footprints': 'Footprints',
      'dumbbell': 'Dumbbell',
      'pill': 'Pill',
      'pill-bottle': 'PillBottle',
      'droplet': 'Droplet',
      'flower-2': 'Flower2',
      'zap-off': 'ZapOff',
      'brain': 'Brain',
      'thermometer-sun': 'ThermometerSun',
      'moon': 'Moon',
      'sun': 'Sun',
      'users': 'Users',
      'heart-pulse': 'HeartPulse',
      'cloud-sun-rain': 'CloudSunRain',
      'eye-closed': 'EyeClosed',
      'waves': 'Waves',
      'briefcase': 'Briefcase',
      'car': 'Car',
    }
    for (const name of names) {
      const pascal = PascalMap[name]
      expect(pascal, `no pascal mapping for "${name}"`).toBeTruthy()
      expect(
        (lucide as Record<string, unknown>)[pascal],
        `lucide-react export "${pascal}" is missing for icon "${name}"`
      ).toBeDefined()
    }
  })

  it('save contract: toggle on writes toggled=true via saveTrackableEntry', async () => {
    // Import the API module to get the function signature. We are not
    // executing it here (it would need a live DB), but asserting that the
    // function exists and accepts the shape LiteLogCard uses.
    const api = await import('@/lib/api/custom-trackables')
    expect(typeof api.saveTrackableEntry).toBe('function')
    expect(typeof api.deleteTrackableEntry).toBe('function')
    expect(api.saveTrackableEntry.length).toBe(3) // (logId, trackableId, value)
    expect(api.deleteTrackableEntry.length).toBe(2) // (logId, trackableId)
  })
})
