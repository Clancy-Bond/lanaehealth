/*
 * v2 Chat round-trip.
 *
 * Drives the full happy path: composer renders, typed message submits,
 * assistant bubble streams in, citations panel surfaces. We mock the
 * SSE response so the test stays deterministic without depending on
 * Anthropic / Supabase. The mock pattern is the same shape `/api/chat`
 * emits in production: a `context` event, a few `token` deltas, and a
 * terminal `done` event.
 *
 * The brief for this session asked for at least one E2E that opens
 * the composer, types, submits, and asserts a response renders. This
 * is that test.
 */
import { expect, test } from '@playwright/test'

const ASSISTANT_REPLY = `Here is what I see for your last week.

## Sleep
- Sleep score has been steady around 78.
- HRV trended up: 42, 45, 48, 51, 49.

### Long token guard

This long token https://lanaehealth.vercel.app/v2/cycle?date=2026-04-29&phase=ovulatory&note=do-not-push-the-column should not push layout.

A bare metric like sleep score should render as a tappable chip.
`

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

test.describe('/v2/chat round-trip', () => {
  test('composer submits and the assistant bubble renders', async ({ page }) => {
    // Pretend there is no prior history so the empty-state starters render.
    await page.route('**/api/chat/history', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      }),
    )

    // Synthesize an SSE response. The real route emits these exact
    // event names: context, token (one per chunk), done.
    await page.route('**/api/chat', async (route) => {
      const accept = route.request().headers()['accept'] ?? ''
      if (!accept.includes('text/event-stream')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: ASSISTANT_REPLY,
            toolsUsed: ['get_oura_biometrics'],
            citations: [],
          }),
        })
      }

      const body =
        sseLine('context', { citations: [], tokenEstimate: 1200 }) +
        sseLine('tool', { name: 'get_oura_biometrics' }) +
        sseLine('token', ASSISTANT_REPLY) +
        sseLine('done', {
          full_response: ASSISTANT_REPLY,
          toolsUsed: ['get_oura_biometrics'],
          citations: [
            {
              kind: 'retrieval',
              label: 'Oura recording 2026-04-28',
              contentType: 'oura_daily',
              date: '2026-04-28',
              href: '/v2/sleep?date=2026-04-28',
            },
          ],
        })

      return route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
        },
        body,
      })
    })

    await page.goto('/v2/chat')

    const input = page.getByRole('textbox', {
      name: 'Ask the AI a question about your health',
    })
    await expect(input).toBeVisible()

    // The textarea is briefly disabled while the SSR/CSR boundary
    // hydrates; wait for it to enable before typing so the keystrokes
    // actually feed the React state.
    await expect(input).toBeEnabled()
    await input.click()
    await input.fill('How has my sleep been?')

    const send = page.getByRole('button', { name: 'Send message' })
    await expect(send).toBeEnabled()
    await send.click()

    // The user bubble should render immediately from the optimistic
    // setMessages call inside ChatClient.sendMessage.
    await expect(page.getByText('How has my sleep been?')).toBeVisible()

    // The assistant bubble streams in over SSE. We wait for a chunk of
    // the seeded reply that is unique enough to not match any chrome.
    await expect(page.getByText('Here is what I see for your last week.')).toBeVisible({
      timeout: 10_000,
    })

    // Tools-used chip surfaces when the `done` event delivers
    // toolsUsed. The TOOL_LABELS map renders 'get_oura_biometrics'
    // as 'Oura'.
    await expect(page.getByText('Oura', { exact: true }).first()).toBeVisible()

    // Citations panel is collapsed by default; tap to expand, then
    // verify the deep-link into the matching v2 surface.
    const citationsToggle = page.getByRole('button', { name: /Based on 1 record/i })
    await expect(citationsToggle).toBeVisible()
    await citationsToggle.click()
    await expect(
      page.getByRole('link', { name: /Oura recording 2026-04-28/i }),
    ).toBeVisible()
  })

  test('?starter=summary seeds the composer with a primed prompt', async ({ page }) => {
    await page.route('**/api/chat/history', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      }),
    )

    await page.goto('/v2/chat?starter=summary')

    const input = page.getByRole('textbox', {
      name: 'Ask the AI a question about your health',
    })
    await expect(input).toHaveValue('Give me a summary of my last week.')
  })
})
