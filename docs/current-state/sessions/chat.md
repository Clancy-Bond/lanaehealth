# Session: AI chat surface

Owner: chat session (this brief). Doctor mode (frames 57-113) is owned
by the doctors session and is out of scope here.

The chat surface is the front door to the Three-Layer Context Engine.
Brief authorship inherited a couple of confusions about which sheet is
"the chat input"; this doc resolves them in writing so the next
session does not start from the same ambiguity.

## What "the chat surface" actually is

The brief asked me to find a chat input sheet that lives on Home (`/v2`).
There is one such sheet on Home, but it is the **NoteComposer**, not
the AI chat. The AI chat lives at its own dedicated route, `/v2/chat`.

| Surface | Route | Component | What it is |
|---|---|---|---|
| AI chat (this session's scope) | `/v2/chat` | `ChatClient` + `ChatInput` | Dedicated AI conversation surface. Streams SSE from `/api/chat`. |
| Note composer (out of scope) | Modal on `/v2`, `/v2/log`, etc. | `NoteComposer` | Voice + text note capture. Saves to `notes`. Triggers AI extraction in the background but does NOT chat. |

The brief's "Hold to speak", "How are you feeling?", "Cancel · Save"
affordances all describe NoteComposer. ChatInput has none of those.
Frame 0001 (the H-clipped "How are you feeling?" sheet) is therefore
showing the NoteComposer mid-animation, not the chat composer.

## Files I own

Locked-file rules in `docs/sessions/README.md` apply. Anything under
`src/lib/context/**` and `src/app/api/**` is foundation territory and
gets a FOUNDATION-REQUEST, not a local edit.

In scope:

- `src/app/v2/chat/page.tsx` : server shell, MobileShell + TopAppBar.
- `src/app/v2/chat/_components/ChatClient.tsx` : conversation state,
  SSE consumption, history loading, starters.
- `src/app/v2/chat/_components/ChatInput.tsx` : the composer (textarea
  + send button).
- `src/app/v2/chat/_components/MessageBubble.tsx` : per-message render,
  markdown-lite, metric chips, error states.
- `src/app/v2/chat/_components/CitationsPanel.tsx` : citations panel
  rendered under assistant bubbles.
- `src/app/v2/chat/_components/ToolCallIndicator.tsx` : phase pill
  ("Reviewing your records...", "Pulling Cycle...").
- `src/app/v2/chat/_components/ChatHistorySheet.tsx` : past
  conversations sheet.
- `src/app/v2/chat/_components/sse-client.ts` : tiny SSE consumer that
  dispatches `context | tool | token | done | error` events.
- `src/app/v2/chat/loading.tsx`, `src/app/v2/chat/error.tsx` : route
  fallbacks.
- `src/app/v2/_components/AskAiCard.tsx` : home tile (not strictly
  inside `/v2/chat`, but it is chat-only and lives one folder up).

Locked / out of scope:

- `src/lib/context/**` : the context engine (assembler, permanent-core,
  summary-engine, vector-store, sync-pipeline, compaction, handoff).
- `src/app/api/chat/route.ts`, `src/app/api/chat/history/route.ts`,
  `src/app/api/chat/nutrition-coach/route.ts` : all chat API surface.
- `src/v2/components/**` and `src/v2/theme/**` : foundation shell and
  primitives.
- `src/v2/components/notes/NoteComposer.tsx` : owned by the notes
  session (it shares the home FAB with chat via QuickNoteFab's
  long-press menu, but the component itself is not chat).

## Entry points (every way the chat surface opens)

1. **Home tile : AskAiCard.** The most prominent door. `/v2/_components/AskAiCard.tsx`
   wraps a `Card` in a `Link href="/v2/chat"`. Sparkles eyebrow, "Ask
   about your health" headline, NC-voice subline.
2. **Home FAB long-press menu.** Long-press or right-click on the
   `+` FAB on `/v2` reveals a small action sheet whose only item is a
   pill "Ask AI" link to `/v2/chat`. See
   `src/v2/components/notes/QuickNoteFab.tsx`.
3. **404 page secondary CTA.** `src/v2/components/states/NotFoundState.tsx`
   surfaces "Try the chat" as the secondary route after Home.
4. **Onboarding completion.** `src/app/v2/onboarding/[step]/steps/StepDone.tsx`
   links to `/v2/chat?starter=summary`. NB the chat client only reads
   `?q=` to seed the input; `?starter=summary` is dead. Filed under
   known issues below; in-scope to fix or align with `?q=`.
5. **Legacy /chat redirect.** `next.config.ts` rewrites `/chat -> /v2/chat`
   permanently=false. Any deep link or external bookmark to the legacy
   surface lands here.
6. **Sign-in deep link.** Unauthenticated assistant bubbles render a
   "Take me to login" CTA pointing at `/login?next=/v2/chat`. The auth
   round-trip returns to the chat with the original message context
   gone (we re-load history on mount).
7. **Deep link via `?q=`.** External links (e.g. legacy
   `src/components/log/AskAICta.tsx` building `/chat?q=<prompt>`) seed
   the input on mount. The legacy redirect preserves the query string.

## Voice trigger

There is no voice trigger on the chat composer today. ChatInput is
plain text only; the voice button is a comment in the source ("Voice
button is intentionally a stub today.") and not yet rendered. Voice
capture lives on the NoteComposer surface, which is a different
session.

## Backend plumbing (read-only context for this brief)

- `POST /api/chat` accepts `{ message }`. JSON path returns
  `{ response, toolsUsed, citations }`; SSE path streams `context |
  tool | token | done | error` events.
- The route calls `getFullSystemPromptCached(userMessage, { userId })`
  in `src/lib/context/assembler.ts`, which returns a two-block array:
  `[{ type: 'text', text: STATIC_PROMPT, cache_control: ephemeral },
  { type: 'text', text: dynamicContext }]`. This is the cache-correct
  shape for Anthropic prompt caching.
- The static block contains identity + objectivity rules + the
  self-distrust principle + the prompt-injection directive. The
  dynamic block contains permanent core, last session handoff,
  knowledge base, smart summaries, and per-day retrieval.
- The assembler appends in the right order: static first, dynamic
  last. The static/dynamic boundary marker `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__`
  lives in `getFullSystemPrompt` for the JSON-string variant; the
  cached variant uses array-block separation instead, which is the
  same boundary expressed differently.

I verified the boundary contract on every chat path:

- `/api/chat` (this surface) : ✅ uses `getFullSystemPromptCached`.
- `/api/chat/nutrition-coach` : (out of scope, but worth a note) read
  if you suspect drift here.
- History route (`/api/chat/history`) : no Claude call, no boundary
  concern.

If you find a violation here later, do not fix it locally : the
context engine is locked. File a FOUNDATION-REQUEST and link this doc.

## Known issues (chat-scope)

1. **`?starter=summary` is a dead query param.** Onboarding ends with
   a CTA to `/v2/chat?starter=summary` but ChatClient only reads
   `searchParams.get('q')`. The deep link lands on an empty composer.
   In-scope fix: support `starter=` (map to `q=`) OR change the
   onboarding link to `?q=Give me a summary of my last week`.
2. **Long markdown overflow risk on assistant bubbles.** See
   `docs/current-state/audits/chat.md` for the diagnosis. Tables,
   code blocks, and unbroken tokens (long URLs, bare lab values
   `145.6789012/85.4321098`) can push the conversation horizontally
   on iPhone 13 Pro (390pt) because:
   - The scroll container only sets `overflow-y: auto`; there is no
     `overflow-x: hidden`.
   - MessageBubble uses `wordBreak: 'break-word'` but not
     `overflowWrap: 'anywhere'`, which is the property that handles
     unbroken URLs and number strings on WebKit.
   - `renderMarkdown` does not handle ` ``` ` fences or `|`-pipe
     tables; they fall through to `<p>` which has no overflow guard.
3. **Voice button stub.** ChatInput leaves a comment saying voice is
   coming but renders only a textarea + send. NC's parity surface has
   "Hold to speak" on its composer (NoteComposer); the chat composer
   does not. Decision pending: do we want voice on the chat composer
   or keep that strictly in the notes flow?
4. **ConversationToolbar dust.** The Clear button reads "Clear" with
   `aria-label="Archive and clear conversation"`. The endpoint is an
   archive, not a delete (`?confirm=archive`); the visible label
   should match the aria copy so the user knows their record survives.

The four items above are in-scope candidates. The plumbing review
turned up zero static/dynamic boundary violations.
