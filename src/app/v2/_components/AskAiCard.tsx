/*
 * AskAiCard
 *
 * Prominent home-screen entry point for the AI chat. The chat is
 * the app's value-prop crown jewel (the model that sees Lanae's full
 * record), so it deserves a real card on the front door, not a
 * tab-bar hack alone.
 *
 * Stays in dark chrome to match the rest of /v2 home, with a teal
 * accent eyebrow so the eye finds it. NC voice in the body line.
 */
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'
import { Card } from '@/v2/components/primitives'

export default function AskAiCard() {
  return (
    <Link href="/v2/chat" style={{ textDecoration: 'none', color: 'inherit' }}>
      <Card padding="md" style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--v2-space-3)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--v2-radius-md)',
              background: 'var(--v2-accent-primary-soft)',
              color: 'var(--v2-accent-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={18} />
          </span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-accent-primary)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
                fontWeight: 'var(--v2-weight-semibold)',
              }}
            >
              Ask AI
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-base)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
                lineHeight: 'var(--v2-leading-tight)',
              }}
            >
              Ask about your health
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                lineHeight: 'var(--v2-leading-normal)',
              }}
            >
              I see your full record: cycles, sleep, food, symptoms, labs. I will cite what I find.
            </span>
          </div>
          <ArrowRight
            size={18}
            aria-hidden="true"
            style={{ color: 'var(--v2-text-muted)', flexShrink: 0, marginTop: 4 }}
          />
        </div>
      </Card>
    </Link>
  )
}
