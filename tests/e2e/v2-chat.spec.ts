/*
 * v2 Chat baseline.
 *
 * The chat surface wires the Three-Layer Context Engine. We keep the
 * test honest by only asserting the surface renders + the input is
 * usable. Asserting on AI response content would couple this test to
 * model output and to live Supabase / Claude credentials in CI; we
 * verify the SSE round-trip elsewhere in integration tests.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/chat', () => {
  test('renders the chat input and history affordance', async ({ page }) => {
    await page.goto('/v2/chat')
    await expect(page).toHaveURL(/\/v2\/chat$/)
    const input = page.getByRole('textbox', { name: 'Ask the AI a question about your health' })
    await expect(input).toBeVisible()
    const send = page.getByRole('button', { name: 'Send message' })
    await expect(send).toBeVisible()
  })

  test('typing into the input enables the send button', async ({ page }) => {
    await page.goto('/v2/chat')
    const input = page.getByRole('textbox', { name: 'Ask the AI a question about your health' })
    await input.fill('Hi')
    await expect(input).toHaveValue('Hi')
    const send = page.getByRole('button', { name: 'Send message' })
    await expect(send).toBeEnabled()
  })
})
