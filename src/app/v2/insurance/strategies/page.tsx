/*
 * /v2/insurance/strategies (server component)
 *
 * Anti-gaslighting and self-advocacy strategies for chronic illness
 * patients. Universal across plans (does not change based on which
 * insurance the user picked).
 *
 * The seven strategies below are paraphrased from POTS Patient
 * Support (S8) and NormaLyte (S9) plus general HMO appeals knowledge.
 * Voice is gentle: doctors are time-pressured, here is how to make
 * the visit count, never "fight back" or "you're being gaslit".
 *
 * Voice rules:
 *   - No em-dashes anywhere
 *   - Plain language; no jargon without a quick gloss
 *   - Empathy first, action second
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import BackChevron from '../_components/BackChevron'
import SectionHeading from '../_components/SectionHeading'

export const dynamic = 'force-dynamic'

interface Strategy {
  number: number
  heading: string
  body: string
  example?: string
}

const STRATEGIES: Strategy[] = [
  {
    number: 1,
    heading: 'Bring a written symptom log',
    body:
      "Doctors have 12 to 15 minutes. A typed page beats trying to remember a month of symptoms in real time. The v2 app generates this from what you've been logging; print it the day before. Even a hand-written list on an index card works.",
  },
  {
    number: 2,
    heading: 'Lead with function, not pain',
    body:
      "How a symptom changes your life carries more weight than a 0-10 number. \"I cannot drive 30 minutes without lying down\" is concrete. \"My pain is a 7\" sounds the same as last visit's 7. Tell the story of what you cannot do anymore.",
    example:
      '"I have stopped driving over the Pali because I get presyncope every time I cross the bridge."',
  },
  {
    number: 3,
    heading: 'Ask for the test by name',
    body:
      'A specific request is harder to deflect than a vague worry. Look up the standard workup for what you suspect, then name the test. Your doctor can still say no, but they have to give a reason.',
    example:
      '"I would like a tilt-table test to evaluate for POTS." beats "I think I might have something orthostatic."',
  },
  {
    number: 4,
    heading: 'If a test is declined, ask for it in writing',
    body:
      'A polite, neutral request to document the refusal in your chart shifts the dynamic without confrontation. Most clinicians will reconsider when asked. If they still decline, the documentation protects you for the next visit.',
    example:
      '"Could you note in my chart the reason you are not ordering this test today? I want it on record."',
  },
  {
    number: 5,
    heading: 'You are entitled to a second opinion',
    body:
      'Every state allows second opinions, and most insurance plans cover them. You do not need to break up with your current doctor to seek one. If the answers you are getting do not feel complete, a second specialist visit is your right.',
  },
  {
    number: 6,
    heading: 'Find a condition-specific specialist',
    body:
      'For complex chronic conditions, the right specialist is often a sub-specialist. Dysautonomia clinics for POTS. Headache specialty centers for chronic migraine. Endometriosis excision specialists for suspected endo. Patient advocacy organizations keep lists of trusted providers.',
  },
  {
    number: 7,
    heading: 'Know how to appeal a denied claim',
    body:
      "If a claim or service is denied, you have an appeal path. For HMSA QUEST it's 60 days from the denial. The medical director (not the original reviewer) looks at your case. State-level review is the next step if you are still unhappy.",
  },
]

export default function StrategiesPage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="How to make your visit count"
          leading={<BackChevron href="/v2/insurance" label="Back to insurance hub" />}
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        <Card>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Doctors are pressed for time. Most visits are 12 to 15 minutes,
            and chronic complex illness does not fit neatly into that
            window. The strategies below are about getting the most out of
            the visit, not about fighting your doctor. They work because
            they make your concerns easier to hear.
          </p>
        </Card>

        {STRATEGIES.map((s) => (
          <Card key={s.number}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--v2-space-2)',
                marginBottom: 'var(--v2-space-2)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-accent-primary)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  letterSpacing: 'var(--v2-tracking-wide)',
                  textTransform: 'uppercase',
                }}
              >
                Strategy {s.number}
              </span>
            </div>
            <SectionHeading level="h2">{s.heading}</SectionHeading>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              {s.body}
            </p>
            {s.example && (
              <Card
                variant="explanatory"
                padding="md"
                style={{ marginTop: 'var(--v2-space-3)' }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--v2-text-sm)',
                    color: 'var(--v2-surface-explanatory-text)',
                    lineHeight: 'var(--v2-leading-relaxed)',
                    fontStyle: 'italic',
                  }}
                >
                  {s.example}
                </p>
              </Card>
            )}
            {s.number === 7 && (
              <p
                style={{
                  margin: 'var(--v2-space-3) 0 0',
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                }}
              >
                See the{' '}
                <Link
                  href="/v2/insurance/hmsa-quest#appeals"
                  style={{
                    color: 'var(--v2-accent-primary)',
                    textDecoration: 'none',
                  }}
                >
                  HMSA QUEST appeals section
                </Link>{' '}
                for the full process.
              </p>
            )}
          </Card>
        ))}

        <Card>
          <SectionHeading level="h2">If you feel dismissed</SectionHeading>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Walking out of an appointment feeling unheard is exhausting.
            Some things that help in the moment:
          </p>
          <ul
            style={{
              margin: 'var(--v2-space-3) 0 0',
              padding: '0 0 0 var(--v2-space-4)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-relaxed)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
            }}
          >
            <li>Bring an advocate (partner, friend, parent) to your next visit</li>
            <li>Write down what was said as soon as you get home</li>
            <li>Talk to a trusted friend or therapist about the experience</li>
            <li>Consider switching providers; see the PCP explainer for when</li>
          </ul>
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
            }}
          >
            Adapted from POTS Patient Support, &quot;Navigating Medical
            Gaslighting&quot; (Dr. Melissa Geraghty, Psy.D.).
          </p>
        </Card>

        <Card>
          <SectionHeading level="h2">Advocacy organizations</SectionHeading>
          <ul
            style={{
              margin: 0,
              padding: '0 0 0 var(--v2-space-4)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-relaxed)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
            }}
          >
            <li>
              <a
                href="https://www.dysautonomiainternational.org/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
              >
                Dysautonomia International
              </a>{' '}
              for POTS and autonomic disorders, including a clinician finder.
            </li>
            <li>
              <a
                href="https://www.pots.support/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
              >
                POTS Patient Support
              </a>{' '}
              for plain-language guides and the gaslighting reference used here.
            </li>
            <li>
              <a
                href="https://migrainetrust.org/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
              >
                The Migraine Trust
              </a>{' '}
              for migraine-specific advocacy and treatment resources.
            </li>
            <li>
              <a
                href="https://nancysnookendo.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--v2-accent-primary)', textDecoration: 'none' }}
              >
                Nancy&apos;s Nook
              </a>{' '}
              for excision-specialist directories and endometriosis education.
            </li>
          </ul>
        </Card>
      </div>
    </MobileShell>
  )
}
