/**
 * Tutorial progress persistence.
 *
 * Stores resumable in-app coachmark tour state on
 * `health_profile.section = 'tutorial_progress'`. Schema is additive,
 * mirrors the home-layout pattern.
 *
 * Shape:
 *   {
 *     cycle: { lastStep: number, completed: boolean, dismissed: boolean,
 *              startedAt: string, finishedAt: string | null }
 *   }
 *
 * `dismissed` lets us distinguish "user skipped" from "user finished",
 * which matters for the replay control. `completed` flips true on the
 * final Got it.
 */
import { createServiceClient } from '@/lib/supabase'
import { runScopedQuery } from '@/lib/auth/scope-query'
import { upsertProfileSection } from '@/lib/auth/scope-upsert'

const SECTION = 'tutorial_progress'

export interface CycleTourState {
  lastStep: number
  completed: boolean
  dismissed: boolean
  startedAt: string
  finishedAt: string | null
}

export interface TutorialProgress {
  cycle: CycleTourState
}

export const DEFAULT_TUTORIAL_PROGRESS: TutorialProgress = {
  cycle: {
    lastStep: 0,
    completed: false,
    dismissed: false,
    startedAt: new Date(0).toISOString(),
    finishedAt: null,
  },
}

/**
 * Read the user's tutorial progress, returning defaults when missing.
 * Never throws. Returns the default when the user_id is missing so
 * server-rendered pages can call this without auth gymnastics.
 */
export async function getTutorialProgress(
  userId: string | null | undefined,
): Promise<TutorialProgress> {
  if (!userId) return DEFAULT_TUTORIAL_PROGRESS
  try {
    const sb = createServiceClient()
    // Pre-035 production lacks the user_id column on health_profile.
    // Without graceful scoping, the .eq('user_id', ...) filter throws,
    // we fall through to DEFAULT (completed=false, dismissed=false),
    // and the cycle tour relaunches on every page visit.
    const result = await runScopedQuery({
      table: 'health_profile',
      userId,
      withFilter: () =>
        sb
          .from('health_profile')
          .select('content')
          .eq('section', SECTION)
          .eq('user_id', userId)
          .maybeSingle(),
      withoutFilter: () =>
        sb
          .from('health_profile')
          .select('content')
          .eq('section', SECTION)
          .maybeSingle(),
    })
    const data = result.data as { content?: unknown } | null
    if (result.error || !data) return DEFAULT_TUTORIAL_PROGRESS
    const parsed = parseProgress(data.content)
    return parsed ?? DEFAULT_TUTORIAL_PROGRESS
  } catch {
    return DEFAULT_TUTORIAL_PROGRESS
  }
}

/**
 * Persist the user's tutorial progress (upsert by user_id + section).
 */
export async function setTutorialProgress(
  userId: string,
  next: TutorialProgress,
): Promise<boolean> {
  if (!userId) return false
  // upsertProfileSection handles the full pre-035 / pre-041 fallback
  // ladder so the cycle-tour completion actually persists on the
  // legacy single-tenant schema and the tour stops auto-launching
  // on every visit.
  const result = await upsertProfileSection({
    sb: createServiceClient(),
    table: 'health_profile',
    userId,
    section: SECTION,
    content: next,
  })
  return result.ok
}

/**
 * Convenience: update only the cycle tour state, merging with existing.
 */
export async function updateCycleTour(
  userId: string,
  patch: Partial<CycleTourState>,
): Promise<boolean> {
  const current = await getTutorialProgress(userId)
  const next: TutorialProgress = {
    ...current,
    cycle: { ...current.cycle, ...patch },
  }
  return setTutorialProgress(userId, next)
}

function parseProgress(content: unknown): TutorialProgress | null {
  if (!content || typeof content !== 'object') return null
  let obj: Record<string, unknown>
  if (typeof content === 'string') {
    try {
      obj = JSON.parse(content) as Record<string, unknown>
    } catch {
      return null
    }
  } else {
    obj = content as Record<string, unknown>
  }
  const cycle = obj.cycle && typeof obj.cycle === 'object' ? (obj.cycle as Record<string, unknown>) : {}
  return {
    cycle: {
      lastStep: Number.isFinite(cycle.lastStep) ? (cycle.lastStep as number) : 0,
      completed: cycle.completed === true,
      dismissed: cycle.dismissed === true,
      startedAt:
        typeof cycle.startedAt === 'string'
          ? cycle.startedAt
          : DEFAULT_TUTORIAL_PROGRESS.cycle.startedAt,
      finishedAt: typeof cycle.finishedAt === 'string' ? cycle.finishedAt : null,
    },
  }
}
