'use client'

/*
 * RefreshRouter
 *
 * Wraps a server-rendered page with PullToRefresh and triggers a
 * router.refresh() on pull. Use this on dashboard surfaces (home,
 * sleep, cycle) so the user can pull down to re-query server data
 * without leaving the screen.
 */
import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import PullToRefresh from './PullToRefresh'

export interface RefreshRouterProps {
  children: ReactNode
}

export default function RefreshRouter({ children }: RefreshRouterProps) {
  const router = useRouter()
  return (
    <PullToRefresh
      onRefresh={async () => {
        router.refresh()
        // Hold the spinner briefly so the user perceives the refresh
        // even when the underlying re-fetch returns instantly. Without
        // this the "Refreshing" pill blinks too fast to read.
        await new Promise((r) => setTimeout(r, 450))
      }}
    >
      {children}
    </PullToRefresh>
  )
}
