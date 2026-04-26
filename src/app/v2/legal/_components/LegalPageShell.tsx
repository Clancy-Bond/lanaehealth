/**
 * LegalPageShell
 *
 * Shared chrome for the three /v2/legal pages (privacy, terms,
 * cookie-policy). Renders inside the standard MobileShell with a
 * back-button TopAppBar so the bottom tab bar still works.
 *
 * Body uses the v2 dark palette but lifts type sizes a notch so
 * dense legal copy stays scannable on a phone. The "Last updated"
 * date is shown at the top so a reader can see at a glance whether
 * they need to re-read.
 */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'

export interface LegalPageShellProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export default function LegalPageShell({ title, lastUpdated, children }: LegalPageShellProps) {
  return (
    <MobileShell
      top={
        <TopAppBar
          variant="standard"
          title={title}
          leading={
            <Link
              href="/v2/settings"
              prefetch={false}
              aria-label="Back to settings"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 'var(--v2-touch-target-min)',
                minHeight: 'var(--v2-touch-target-min)',
                color: 'var(--v2-text-primary)',
                textDecoration: 'none',
                fontSize: 'var(--v2-text-base)',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M15 6l-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          }
        />
      }
    >
      <article
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: 'var(--v2-space-4) var(--v2-space-5) var(--v2-space-8)',
          fontSize: 'var(--v2-text-base)',
          lineHeight: 'var(--v2-leading-relaxed)',
          color: 'var(--v2-text-primary)',
        }}
      >
        <p
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '0 0 var(--v2-space-2)',
          }}
        >
          Last updated: {lastUpdated}
        </p>
        {children}
        <hr
          style={{
            margin: 'var(--v2-space-6) 0 var(--v2-space-4)',
            border: 0,
            borderTop: '1px solid var(--v2-border-subtle)',
          }}
        />
        <nav
          aria-label="Other legal documents"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--v2-space-3)',
            fontSize: 'var(--v2-text-sm)',
          }}
        >
          <LegalNavLink href="/v2/legal/privacy">Privacy Policy</LegalNavLink>
          <LegalNavLink href="/v2/legal/terms">Terms of Service</LegalNavLink>
          <LegalNavLink href="/v2/legal/cookie-policy">Cookie Policy</LegalNavLink>
        </nav>
      </article>
    </MobileShell>
  )
}

function LegalNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      style={{
        color: 'var(--v2-accent-primary)',
        textDecoration: 'none',
        fontWeight: 'var(--v2-weight-semibold)',
      }}
    >
      {children}
    </Link>
  )
}

/**
 * Shared section heading. Keeps spacing and color consistent across
 * all three legal pages.
 */
export function LegalH2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      style={{
        fontSize: 'var(--v2-text-xl)',
        fontWeight: 'var(--v2-weight-semibold)',
        color: 'var(--v2-text-primary)',
        margin: 'var(--v2-space-6) 0 var(--v2-space-2)',
        letterSpacing: 'var(--v2-tracking-tight)',
        scrollMarginTop: 'var(--v2-topbar-height)',
      }}
    >
      {children}
    </h2>
  )
}

export function LegalH3({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 'var(--v2-text-lg)',
        fontWeight: 'var(--v2-weight-semibold)',
        color: 'var(--v2-text-primary)',
        margin: 'var(--v2-space-4) 0 var(--v2-space-2)',
      }}
    >
      {children}
    </h3>
  )
}

export function LegalP({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: 'var(--v2-space-2) 0',
        color: 'var(--v2-text-primary)',
      }}
    >
      {children}
    </p>
  )
}

export function LegalUL({ children }: { children: ReactNode }) {
  return (
    <ul
      style={{
        margin: 'var(--v2-space-2) 0 var(--v2-space-3)',
        paddingLeft: 'var(--v2-space-5)',
        color: 'var(--v2-text-primary)',
      }}
    >
      {children}
    </ul>
  )
}

export function LegalLI({ children }: { children: ReactNode }) {
  return (
    <li
      style={{
        margin: 'var(--v2-space-1) 0',
      }}
    >
      {children}
    </li>
  )
}

/**
 * Citation block - rendered in muted small text. Used per-section to
 * cite the public legal text or guidance we patterned the section on.
 */
export function LegalCitation({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: 'var(--v2-space-2) 0 var(--v2-space-4)',
        fontSize: 'var(--v2-text-xs)',
        color: 'var(--v2-text-muted)',
        fontStyle: 'italic',
      }}
    >
      {children}
    </p>
  )
}

/**
 * Prominent callout, used for the medical disclaimer in /v2/legal/terms.
 */
export function LegalCallout({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <aside
      role="note"
      style={{
        margin: 'var(--v2-space-4) 0',
        padding: 'var(--v2-space-4) var(--v2-space-5)',
        border: '2px solid var(--v2-accent-primary)',
        borderRadius: 'var(--v2-radius-lg)',
        background: 'var(--v2-bg-card)',
      }}
    >
      {title && (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-bold)',
            color: 'var(--v2-accent-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {title}
        </p>
      )}
      <div style={{ marginTop: title ? 'var(--v2-space-2)' : 0 }}>{children}</div>
    </aside>
  )
}
