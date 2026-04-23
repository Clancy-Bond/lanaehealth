/*
 * LoadingShell
 *
 * Shared scaffold for v2 Next.js loading.tsx files. Renders the
 * v2 chrome (TopAppBar) and a vertical stack of Skeleton blocks
 * shaped like the eventual page content. Keeps cold loads from
 * flashing a blank screen while hydration runs.
 */
import { ReactNode } from 'react'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card, Skeleton } from '@/v2/components/primitives'

export interface LoadingShellProps {
  title: ReactNode
  /**
   * Variant determines the shape of the skeleton block underneath
   * the bar. `hero` matches a large ring + tiles page (sleep,
   * calories, today). `feed` matches a stack of insight cards
   * (patterns hub).
   */
  variant?: 'hero' | 'feed'
  topLeading?: ReactNode
  topTrailing?: ReactNode
}

export default function LoadingShell({
  title,
  variant = 'hero',
  topLeading,
  topTrailing,
}: LoadingShellProps) {
  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title={title}
          leading={topLeading}
          trailing={topTrailing}
        />
      }
    >
      <div
        aria-busy="true"
        aria-live="polite"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-5)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-10)',
        }}
      >
        {variant === 'hero' ? <HeroSkeleton /> : <FeedSkeleton />}
      </div>
    </MobileShell>
  )
}

function HeroSkeleton() {
  return (
    <>
      <Card padding="lg">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--v2-space-3)',
          }}
        >
          <Skeleton shape="circle" width={140} height={140} />
          <Skeleton shape="text" width="60%" height={14} />
          <Skeleton shape="text" width="40%" height={12} />
        </div>
      </Card>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--v2-space-2)',
        }}
      >
        <Skeleton shape="rect" height={72} />
        <Skeleton shape="rect" height={72} />
        <Skeleton shape="rect" height={72} />
        <Skeleton shape="rect" height={72} />
      </div>
      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <Skeleton shape="text" width="30%" height={12} />
          <Skeleton shape="rect" height={120} />
          <Skeleton shape="text" width="80%" height={12} />
        </div>
      </Card>
      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <Skeleton shape="text" width="50%" height={14} />
          <Skeleton shape="text" width="90%" height={12} />
          <Skeleton shape="text" width="75%" height={12} />
        </div>
      </Card>
    </>
  )
}

function FeedSkeleton() {
  return (
    <>
      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <Skeleton shape="text" width="80%" height={12} />
          <Skeleton shape="text" width="65%" height={12} />
        </div>
      </Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <Skeleton shape="text" width="35%" height={12} />
        <Card padding="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            <Skeleton shape="text" width="90%" height={14} />
            <Skeleton shape="text" width="75%" height={12} />
          </div>
        </Card>
        <Card padding="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            <Skeleton shape="text" width="85%" height={14} />
            <Skeleton shape="text" width="70%" height={12} />
          </div>
        </Card>
        <Card padding="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            <Skeleton shape="text" width="90%" height={14} />
            <Skeleton shape="text" width="60%" height={12} />
          </div>
        </Card>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'var(--v2-space-3)',
        }}
      >
        <Skeleton shape="rect" height={88} />
        <Skeleton shape="rect" height={88} />
        <Skeleton shape="rect" height={88} />
        <Skeleton shape="rect" height={88} />
      </div>
    </>
  )
}
