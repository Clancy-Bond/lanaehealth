/**
 * Cron: /api/cron/build-status
 *
 * Polls Vercel for the latest deployment status and pushes a web-push
 * notification to all subscriptions when production goes red. The
 * motivating failure mode: builds silently failing for hours while
 * nobody notices, because we don't have Slack wired up and Vercel's
 * default email throttles.
 *
 * Runs every 10 minutes via vercel.json. Also safe to hit manually.
 *
 * State: we dedupe on the failing deployment's UID so a single failure
 * only sends one notification even across 10-minute polls. State lives
 * in a small KV-style row: medical_narrative.section_title =
 * 'build_status_last_notified' (reusing an existing table to avoid a
 * migration for a tiny string).
 *
 * Auth: Vercel Cron header OR CRON_SECRET bearer. Returns 401 for
 * arbitrary callers so external pings can't cause push spam.
 */

import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_CONTACT = process.env.VAPID_CONTACT ?? 'mailto:noreply@lanaehealth.local'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC, VAPID_PRIVATE)
}

// Vercel credentials. Project ID + team ID can be read from vercel.json
// when linked; token is user-scoped. We only need READ access on
// deployments so a least-privilege token is fine.
const VERCEL_TOKEN = process.env.VERCEL_TOKEN ?? ''
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? ''
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID ?? ''

const STATE_KEY = 'build_status_last_notified'

interface VercelDeployment {
  uid: string
  name: string
  url: string
  created: number
  state: 'READY' | 'ERROR' | 'BUILDING' | 'CANCELED' | 'QUEUED' | 'INITIALIZING'
  target: 'production' | 'preview' | null
  meta?: {
    githubCommitRef?: string
    githubCommitMessage?: string
    githubCommitSha?: string
  }
}

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  if (req.headers.get('x-vercel-cron') === '1') return true
  return false
}

async function fetchLatestDeployments(): Promise<VercelDeployment[]> {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    throw new Error('VERCEL_TOKEN or VERCEL_PROJECT_ID not set')
  }
  const params = new URLSearchParams({
    projectId: VERCEL_PROJECT_ID,
    limit: '10',
  })
  if (VERCEL_TEAM_ID) params.set('teamId', VERCEL_TEAM_ID)
  const resp = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })
  if (!resp.ok) {
    throw new Error(`vercel api ${resp.status}: ${await resp.text().catch(() => '')}`)
  }
  const body = (await resp.json()) as { deployments?: VercelDeployment[] }
  return body.deployments ?? []
}

async function loadLastNotifiedUid(): Promise<string | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('medical_narrative')
    .select('content')
    .eq('section_title', STATE_KEY)
    .maybeSingle()
  return (data?.content as string | undefined) ?? null
}

async function saveLastNotifiedUid(uid: string): Promise<void> {
  const sb = createServiceClient()
  await sb.from('medical_narrative').delete().eq('section_title', STATE_KEY)
  await sb.from('medical_narrative').insert({
    section_title: STATE_KEY,
    content: uid,
    section_order: 9999,
    updated_at: new Date().toISOString(),
  })
}

interface SubscriptionRow {
  id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
}

async function pushToAllSubscribers(
  title: string,
  body: string,
  url: string,
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, failed: 0 }
  const sb = createServiceClient()
  const { data } = await sb
    .from('push_subscriptions')
    .select('id, endpoint, keys')
  const subs = (data ?? []) as SubscriptionRow[]

  const payload = JSON.stringify({
    title,
    body,
    tag: 'build-status',
    data: { url },
  })

  let sent = 0
  let failed = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        payload,
      )
      sent++
    } catch {
      failed++
    }
  }
  return { sent, failed }
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const deployments = await fetchLatestDeployments()
    if (deployments.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'no deployments' })
    }

    // Newest first already. Find latest ERROR on production OR the
    // latest ERROR on preview if production is ok (catches branches
    // that will auto-promote later).
    const latestError = deployments.find((d) => d.state === 'ERROR')
    if (!latestError) {
      return NextResponse.json({
        ok: true,
        latestState: deployments[0].state,
        latestTarget: deployments[0].target,
      })
    }

    const lastUid = await loadLastNotifiedUid()
    if (lastUid === latestError.uid) {
      return NextResponse.json({
        skipped: true,
        reason: 'already notified',
        uid: latestError.uid,
      })
    }

    const branch = latestError.meta?.githubCommitRef ?? 'unknown'
    const commit = latestError.meta?.githubCommitMessage?.slice(0, 60) ?? '(no message)'
    const inspectUrl = `https://vercel.com/clancy-bonds-projects/lanaehealth/${latestError.uid}`

    const title =
      latestError.target === 'production'
        ? 'Production build failed'
        : `Preview build failed (${branch})`
    const body = `${commit}${latestError.meta?.githubCommitSha ? ` · ${latestError.meta.githubCommitSha.slice(0, 7)}` : ''}`

    const { sent, failed } = await pushToAllSubscribers(title, body, inspectUrl)
    await saveLastNotifiedUid(latestError.uid)

    return NextResponse.json({
      notified: true,
      uid: latestError.uid,
      target: latestError.target,
      branch,
      sent,
      failed,
      inspectUrl,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
