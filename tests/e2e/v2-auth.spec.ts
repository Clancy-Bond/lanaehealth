/*
 * v2 Auth baseline.
 *
 * /v2/login + /v2/signup are the only pre-auth surfaces under /v2.
 * We verify they render with the right headings and that the submit
 * button stays disabled until the required fields are populated; the
 * forms gate submission with the disabled attribute rather than a
 * separate "required" message, so disabled-state is the real signal.
 *
 * We deliberately do not actually create accounts here. That is an
 * integration test against a fixture Supabase project, not a
 * front-door E2E.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2 auth', () => {
  test('login page renders the welcome heading and a disabled submit', async ({ page }) => {
    await page.goto('/v2/login')
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    const submit = page.getByRole('button', { name: /sign in/i })
    await expect(submit).toBeVisible()
    await expect(submit).toBeDisabled()
  })

  test('signup page renders the create-account heading and a disabled submit', async ({ page }) => {
    await page.goto('/v2/signup')
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible()
    const submit = page.getByRole('button', { name: /create account/i })
    await expect(submit).toBeVisible()
    await expect(submit).toBeDisabled()
  })
})
