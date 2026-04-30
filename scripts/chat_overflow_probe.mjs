// Mock /api/chat with a long markdown response, navigate to /v2/chat,
// type, send, and report scrollWidth vs clientWidth on iPhone 13 Pro.
import { chromium, devices } from 'playwright'

const PATHOLOGICAL = 'a'.repeat(400) + ' OR ' + 'https://example.com/' + 'x'.repeat(300)
const LONG_MD = `Here is a quick summary with a pathological unbroken token.

## Sleep
- Sleep score is 78/100. Average duration 7h 23m.
- HRV trended up: 42, 45, 48, 51, 49.

### Pathological URL (single 700+ char token)

${PATHOLOGICAL}

### Lab values (simulated table; markdown-lite has no table grammar)

| Test | Value | Reference |
|---|---|---|
| Hemoglobin | 13.2 g/dL | 12.0,15.5 |
| Ferritin | 24 ng/mL | 15,150 |
| Vitamin D, 25-OH | 28 ng/mL | 30,80 |

\`\`\`
const dose = { medication: "Zyrtec", time: "morning", note: "blood pressure: 145.6789012/85.4321098" }
\`\`\`

Some **bold** with a metric chip like sleep score and readiness inline.
`

const browser = await chromium.launch()
const context = await browser.newContext({ ...devices['iPhone 13 Pro'] })
const page = await context.newPage()

await page.route('**/api/chat/history', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
)
await page.route('**/api/chat', async (route) => {
  const headers = route.request().headers()
  if ((headers['accept'] || '').includes('text/event-stream')) {
    const enc = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    const body =
      enc('context', { citations: [], tokenEstimate: 1200 }) +
      enc('token', LONG_MD) +
      enc('done', { full_response: LONG_MD, toolsUsed: [], citations: [] })
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body })
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response: LONG_MD, toolsUsed: [], citations: [] }) })
})

await page.goto('http://localhost:3005/v2/chat', { waitUntil: 'load', timeout: 90_000 })
// Wait for the history fetch to settle so the empty-state starters render.
await page.waitForFunction(() => !!document.querySelector('textarea'), { timeout: 60_000 })
await page.waitForTimeout(1500)
const ta = page.locator('textarea').first()
await ta.click()
await page.keyboard.type('test')
await page.waitForFunction(() => {
  const btn = document.querySelector('button[aria-label="Send message"]')
  return btn && !btn.disabled
}, { timeout: 15_000 })
await page.keyboard.press('Enter')
await page.waitForTimeout(3500)
const result = await page.evaluate(() => {
  const html = document.documentElement
  const body = document.body
  // Find the rendered assistant message bubble (the "94%" max-width box).
  const bubble = Array.from(document.querySelectorAll('div'))
    .find((d) => /16px 16px 16px 4px/.test(d.style.borderRadius))
  const widest = Array.from(document.querySelectorAll('*'))
    .filter((el) => !el.matches('a.sr-only'))
    .map((el) => ({ tag: el.tagName, cls: (el.className?.toString?.() ?? '').slice(0, 60), sw: el.scrollWidth, cw: el.clientWidth, rect: el.getBoundingClientRect() }))
    .filter((x) => x.sw > x.cw + 1)
    .sort((a, b) => (b.sw - b.cw) - (a.sw - a.cw))
    .slice(0, 8)
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    html: { sw: html.scrollWidth, cw: html.clientWidth },
    body: { sw: body.scrollWidth, cw: body.clientWidth },
    bubble: bubble ? { sw: bubble.scrollWidth, cw: bubble.clientWidth, w: Math.round(bubble.getBoundingClientRect().width), txt: bubble.innerText.slice(0, 80) } : null,
    overflowing: widest.map((x) => ({ tag: x.tag, cls: String(x.cls), sw: x.sw, cw: x.cw, w: Math.round(x.rect.width), x: Math.round(x.rect.x) })),
  }
})
console.log(JSON.stringify(result, null, 2))
await browser.close()
