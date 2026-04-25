/**
 * HomeLayout
 *
 * Server component that takes the live HomeContext + the user's
 * saved layout and renders the home screen widget by widget,
 * in priority order. Auto-elevated widgets get a small "Heads
 * up" badge in the top-right of their card so the user can see
 * WHY this widget bubbled up today.
 *
 * The composer logic lives in @/lib/v2/home; this component is
 * just the render shell. That separation lets us unit-test the
 * elevation rules without rendering React.
 */
import type { ReactNode } from 'react'
import type { HomeContext } from '@/lib/v2/load-home-context'
import { buildWidgetRegistry, type WidgetRenderers } from '@/lib/v2/home/widget-registry'
import { composeHomeLayout } from '@/lib/v2/home/composer'
import type { HomeLayout as HomeLayoutDoc } from '@/lib/v2/home/layout-store'

export interface HomeLayoutProps {
  ctx: HomeContext
  layout: HomeLayoutDoc
  renderers: WidgetRenderers
}

export default function HomeLayout({ ctx, layout, renderers }: HomeLayoutProps) {
  const registry = buildWidgetRegistry(renderers)
  const composed = composeHomeLayout(registry, layout, ctx)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-5)',
      }}
    >
      {composed.map(({ widget, elevation }) => {
        const node = widget.render(ctx)
        if (!node) return null
        return (
          <WidgetSlot
            key={widget.id}
            elevated={elevation.elevate && widget.canReorder}
            reason={elevation.reason}
          >
            {node}
          </WidgetSlot>
        )
      })}
    </div>
  )
}

function WidgetSlot({
  elevated,
  reason,
  children,
}: {
  elevated: boolean
  reason: string
  children: ReactNode
}) {
  if (!elevated) {
    return <>{children}</>
  }
  return (
    <div style={{ position: 'relative' }}>
      <div
        aria-label={`Heads up: ${reason}`}
        title={reason}
        style={{
          position: 'absolute',
          top: 'calc(var(--v2-space-2) * -1)',
          right: 'var(--v2-space-3)',
          zIndex: 1,
          background: 'var(--v2-accent-warning)',
          color: 'var(--v2-text-on-accent, #fff)',
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          padding: '2px var(--v2-space-2)',
          borderRadius: 'var(--v2-radius-sm)',
          boxShadow: 'var(--v2-shadow-sm)',
          letterSpacing: '0.02em',
        }}
      >
        Heads up
      </div>
      {children}
    </div>
  )
}
