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
    const { data, error } = await sb
      .from('health_profile')
      .select('content')
      .eq('section', SECTION)
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return DEFAULT_TUTORIAL_PROGRESS
    const parsed = parseProgress((data as { content: unknown }).content)
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
  try {
    const sb = createServiceClient()
    const { error } = await sb
      .from('health_profile')
      .upsert(
        {
          user_id: userId,
          section: SECTION,
          content: next,
        },
        { onConflict: 'user_id,section' },
      )
    return !error
  } catch {
    return false
  }
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
