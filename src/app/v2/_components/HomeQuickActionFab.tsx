'use client'

/*
 * HomeQuickActionFab
 *
 * Replaces the legacy single-action "Log today" FAB on /v2 home with
 * an action sheet anchored to the same bottom-right slot. Uses the
 * pure-HTML <details>/<summary> pattern (mirrors QuickLogFabV2 in
 * /v2/calories) so it works on iOS Safari without client JS state.
 *
 * Top item is "Ask AI" so the Three-Layer Context Engine becomes a
 * first-class action without touching the 5-tab structure. The
 * remaining items mirror what the user can do today: log a daily
 * check-in, capture food, and scan a barcode.
 */
import Link from 'next/link'
import { Sparkles, ClipboardCheck, Camera, ScanBarcode } from 'lucide-react'
import type { ReactNode } from 'react'

interface QuickAction {
  href: string
  label: string
  icon: ReactNode
  /** When true, the row is highlighted (used for Ask AI). */
  emphasize?: boolean
}

const ACTIONS: QuickAction[] = [
  {
    href: '/v2/chat',
    label: 'Ask AI',
    icon: <Sparkles size={16} aria-hidden="true" />,
    emphasize: true,
  },
  {
    href: '/v2/log',
    label: 'Log today',
    icon: <ClipboardCheck size={16} aria-hidden="true" />,
  },
  {
    href: '/v2/calories/photo',
    label: 'Take a photo',
    icon: <Camera size={16} aria-hidden="true" />,
  },
  {
    href: '/v2/calories/search?view=scan',
    label: 'Scan barcode',
    icon: <ScanBarcode size={16} aria-hidden="true" />,
  },
]

export default function HomeQuickActionFab() {
  return (
    <details
      className="v2-home-fab"
      style={{
        position: 'fixed',
        right: 'calc(var(--v2-space-4) + var(--v2-safe-right))',
        bottom: `calc(var(--v2-tabbar-height) + var(--v2-safe-bottom) + var(--v2-space-4))`,
        zIndex: 30,
      }}
    >
      <summary
        aria-label="Open quick actions"
        style={{
          listStyle: 'none',
          width: 'var(--v2-fab-size)',
          height: 'var(--v2-fab-size)',
          borderRadius: 'var(--v2-radius-full)',
          background: 'var(--v2-accent-primary)',
          color: 'var(--v2-bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          fontWeight: 'var(--v2-weight-semibold)',
          cursor: 'pointer',
          boxShadow: 'var(--v2-shadow-lg)',
          userSelect: 'none',
        }}
      >
        +
      </summary>
      <nav
        aria-label="Quick action menu"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 'calc(var(--v2-fab-size) + var(--v2-space-2))',
          minWidth: 224,
          padding: 'var(--v2-space-1)',
          borderRadius: 'var(--v2-radius-md)',
          background: 'var(--v2-bg-elevated)',
          border: '1px solid var(--v2-border)',
          boxShadow: 'var(--v2-shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {ACTIONS.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 'var(--v2-touch-target-min)',
              padding: 'var(--v2-space-2) var(--v2-space-3)',
              borderRadius: 'var(--v2-radius-sm)',
              textDecoration: 'none',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-medium)',
              color: a.emphasize ? 'var(--v2-accent-primary)' : 'var(--v2-text-primary)',
              background: a.emphasize ? 'var(--v2-accent-primary-soft)' : 'transparent',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 24,
                height: 24,
                borderRadius: 'var(--v2-radius-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: a.emphasize ? 'var(--v2-accent-primary)' : 'var(--v2-text-secondary)',
                background: a.emphasize ? 'transparent' : 'var(--v2-bg-card)',
              }}
            >
              {a.icon}
            </span>
            {a.label}
          </Link>
        ))}
      </nav>
      <style>{`
        .v2-home-fab summary::-webkit-details-marker { display: none; }
        .v2-home-fab summary::marker { content: ''; }
        .v2-home-fab nav a:hover,
        .v2-home-fab nav a:focus-visible {
          background: var(--v2-accent-primary-soft);
          outline: none;
        }
      `}</style>
    </details>
  )
}
