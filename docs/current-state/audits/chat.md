# Audit: AI chat surface

Surface: `/v2/chat`. Inspected at 390pt (iPhone 13 Pro) and 412pt
(Pixel 7) via the Playwright + WebKit harness. Probe script lives at
`scripts/chat_overflow_probe.mjs`.

The recording the brief references (`docs/current-state/frames/2026-04-29-app-tour/frame_000{1,2,3,4}.png`)
does not exist in the repo I was handed; "exercised in recording?" is
left as TBD where I could not verify. I exercised every affordance
manually in the running dev server.

## Composer affordances (the input row at the bottom of /v2/chat)

| Element | Location (file:line) | Visual / behavior | Exercised in recording? |
|---|---|---|---|
| Textarea | `ChatInput.tsx:76-98` | Auto-grows from 1 to ~120px (about 4 rows). `aria-label="Ask the AI a question about your health"`. Disabled while a turn is in flight. Placeholder "Ask about your health". | TBD (frames not in repo) |
| Send button | `ChatInput.tsx:99-135` | 36×36 teal circle with `ArrowUp` icon. Has an invisible 44pt hit-area span on top so the touch target meets the iOS guideline without inflating the visual. Disabled when textarea is empty or a turn is loading. `aria-label="Send message"`. | TBD |
| Enter to submit | `ChatInput.tsx:49-54` | Enter submits, Shift+Enter inserts newline. | TBD |
| Mic / voice trigger | (not implemented) | Comment in `ChatInput.tsx:12-15` says voice is intentionally a stub. The "Hold to speak" affordance the brief listed is on `NoteComposer`, not ChatInput. | n/a |
| Predictive-text suggestion strip | `ChatClient.tsx:584-678` (EmptyState) | Six hard-coded starter prompts shown only when there is no history and no in-flight turn. Tapping one calls `sendMessage(starter)` directly, no second tap. | TBD |
| Cancel | (not implemented) | The brief mentions Cancel; that is on NoteComposer. ChatInput has no Cancel because the underlying view persists conversation state and we do not need an "abandon and dismiss" gesture. The conversation toolbar's Clear button (top right) is a separate archive action. | n/a |
| Save | (not implemented) | Same as Cancel. Chat does not have a save state; messages persist on every successful turn via the `done` SSE event handler in `ChatClient.tsx:224-241`. | n/a |
| Attachments | (not implemented) | None present. Confirmed by reading the JSX tree. | n/a |

## Toolbar (top of the conversation list)

| Element | Location | Behavior | Notes |
|---|---|---|---|
| History button | `ChatClient.tsx:534-555` | Opens `ChatHistorySheet` with all loaded messages. Always visible. | Label reads "History" + `MessagesSquare` icon. |
| Clear button | `ChatClient.tsx:556-579` | Visible only when `messages.length > 0`. Calls `DELETE /api/chat/history?confirm=archive`. The aria-label says "Archive and clear conversation"; the visible label says only "Clear". | Pre-existing dust: see fix item below. Endpoint is archive, not destructive delete; label should hint at that. |

## Conversation surface (between toolbar and composer)

| Element | Location | Behavior |
|---|---|---|
| Empty state | `ChatClient.tsx:584-678` | Sparkles eyebrow chip + "Ask anything about your health." + NC-voice subline + 6 starter pills. Renders only on cold-start with no history. |
| Message bubble (user) | `MessageBubble.tsx:296-380` (isUser branch) | Right-aligned, teal fill, dark text, 85% max-width. Em/en dashes scrubbed. |
| Message bubble (assistant) | `MessageBubble.tsx:296-380` (else branch) | Left-aligned, dark card, 94% max-width, 1px hairline. Markdown-lite via `renderMarkdown` (see grammar table below). |
| Inline metric chip | `MessageBubble.tsx:73-122` | Wraps `sleep score`, `readiness`, `cover line`, `fertility status`, `BBT` etc. in a tappable pill that opens the matching `MetricExplainer` sheet. |
| "How did I know this?" | `ChatClient.tsx:385-408` | Underlined caption shown under finished assistant bubbles when `toolsUsed.length > 0`. Opens an `ExplainerSheet`. |
| Citations panel | `CitationsPanel.tsx` | Rendered under assistant bubbles when the `done` event delivers citations. Each citation deep-links to a v2 surface. |
| Tool-call indicator | `ToolCallIndicator.tsx` | Phase pill rendered while `loading && phase !== 'streaming'`. Phases: `connecting`, `context`, `tool`, `streaming`. |
| Unauth bubble | `MessageBubble.tsx:334-350` | If `errorKind === 'unauth'`, render a "Take me to login" pill that targets `/login?next=/v2/chat`. |

## Markdown-lite grammar (assistant bubble)

| Token | Renders as | Notes |
|---|---|---|
| `## heading` | `<h3>` 14px bold | OK |
| `### heading` | `<h4>` 13px bold | OK |
| `- item` / `* item` | flex row with teal `•` | Bullet list |
| `1. item` | flex row with teal numeric prefix | Numbered list |
| `**bold**` | `<strong>` semibold | OK |
| em / en dash | scrubbed to comma at render | Repo-wide dash ban enforced defensively |
| (everything else) | `<p>` | Tables, code fences, raw URLs, blockquotes all fall through here |

## Viewport diagnosis (known-issue #1)

The brief warned that the assistant response surface "likely renders
markdown the same way doctor mode does and will exhibit the same
overflow." I tested with three pathological payloads on the iPhone 13
Pro emulator (390pt × 664pt):

1. A single 700+ character unbroken token mixing `a` repetition, a
   long URL, and zero whitespace.
2. A pipe-rendered "table" (markdown-lite has no table grammar; the
   pipes fall through to `<p>`).
3. A fenced code block with a wide one-liner.

Result on every payload:

- `documentElement.scrollWidth === clientWidth === 390`
- `body.scrollWidth === clientWidth === 390`
- The assistant bubble itself: `width = 344, scrollWidth = 342,
  clientWidth = 342` (94% of available column).
- Only "overflow" reported by `scrollWidth > clientWidth` is the
  send-button hit-area span, which is intentional (44pt invisible
  span on a 36pt visual button) and contained.

**Confirmed clean on this surface.** The combination of:

- `maxWidth: 94%` on the assistant bubble (`MessageBubble.tsx:314`),
- `wordBreak: 'break-word'` on the bubble (`MessageBubble.tsx:323`),
- WebKit's CJK-friendly `word-break: break-word` (legacy alias for
  `overflow-wrap: anywhere`),

is enough to keep a single 700-char unbroken token from pushing the
column width on iOS Safari. Doctor mode appears to have a different
markdown renderer (deeper, with table support); the symptom reported
there does not regress here. Probe script is checked in at
`scripts/chat_overflow_probe.mjs` so the next session can re-run it
without re-deriving the test payloads.

Caveats worth noting even though the document is clean:

- `wordBreak: 'break-word'` is the legacy WebKit name. On Firefox the
  modern equivalent is `overflow-wrap: anywhere`. We do not target
  Firefox mobile but the v2 site renders fine on desktop Firefox in
  responsive mode and that path is **not** tested here. If we ever
  add Firefox to the Playwright matrix, switch to
  `overflowWrap: 'anywhere'` for cross-browser parity.
- Markdown-lite emits a literal pipe-table when the LLM thinks it is
  building a table. It is readable but ugly; if doctor mode adds a
  shared markdown renderer with table + code-fence support, we should
  consume it on this surface too. Filed as a v-next item.

## Voice + copy review (Oura chrome + NC voice)

Oura sheet patterns from `docs/reference/oura/components.md`:

- Sheet style ✅ (not really applicable; chat is a full route, not a
  bottom sheet, but the dark chrome + hairline matches Oura tile/card
  observations).
- Top app bar ✅ (`TopAppBar variant="standard" title="Ask AI"` is
  the correct Oura standard variant).
- Bullet color ✅ (teal `•` matches Oura "primary" hue).
- Chip eyebrow ✅ (the "ASK AI" eyebrow on the empty state matches
  the Oura "uppercase, letter-spaced, accent-soft chip" pattern seen
  in `MetricTile`/`Card` callouts).

NC voice rules from `docs/reference/natural-cycles/components.md`:

- "short, kind, explanatory" ✅ on all visible copy:
  - Empty state heading: "Ask anything about your health."
  - Empty state body: "I have access to your full record: cycles,
    sleep, food, symptoms, labs, appointments. I will cite what I
    find and tell you when the data is thin." (35 words, kind, no
    counters, no streaks, no guilt.)
  - Server error: "Something paused on my end. Try again in a moment."
    (NC pattern of softening machine errors with a human metaphor.)
  - Unauth bubble: "You need to sign in before I can pull your records."
- Em-dash ban ✅ (defensive scrubber at render time).

Deltas I want to land in this session (in scope, no foundation touch):

1. **`Clear` button label.** Change visible "Clear" → "Archive" so the
   label tells the truth about the endpoint. Aria stays "Archive and
   clear conversation". Trash icon stays for visual continuity. (One
   word edit + a tooltip line in this audit.)
2. **`?starter=` query param.** Map onboarding's
   `/v2/chat?starter=summary` to a real seed prompt by reading
   `searchParams.get('starter')` alongside `q`. Falls back to the
   existing `q=` behavior; does not change the public URL contract.
3. **Composer placeholder warmth.** Current placeholder reads "Ask
   about your health". NC voice precedent on the same surface ("Ask
   anything about your health.") is one word warmer. Bring the
   composer in line with the empty-state heading: change to "Ask
   anything about your health".
4. **Toolbar History label asymmetry.** "History" is a noun; "Clear"
   was a verb. After change #1 both are nouns ("History" / "Archive")
   so the toolbar reads as a balanced pair.

Out of scope for this session (filed as v-next):

- Markdown table + code-fence support. Wait until doctor mode lands
  its richer renderer and reuse it. Premature local fork would
  diverge.
- Voice trigger on the chat composer. Decision pending: do we want a
  voice path here or keep voice strictly on the notes flow?

## Plumbing notes (read-only)

The `/api/chat` route uses `getFullSystemPromptCached(userMessage,
{ userId })` from `src/lib/context/assembler.ts`. That function
returns a two-block array shaped for Anthropic prompt caching:

```
system: [
  { type: 'text', text: STATIC_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  { type: 'text', text: dynamicContext },
]
```

The static block contains identity, objectivity rules, anti-anchoring,
research-awareness, data honesty, the self-distrust principle, and
the prompt-injection directive. The dynamic block contains permanent
core, last session handoff, knowledge base, smart summaries (max 6
unless `includeAllSummaries`), and per-day vector retrieval (max 8).

I confirmed the order in `assembleDynamicContext`
(`assembler.ts:161-356`): static text is computed once and cached at
module load; the dynamic context is rebuilt on every call. The
`__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` marker survives in the
non-cached `getFullSystemPrompt` shape (line 371-375) for callers that
join into a single string; the cached path uses block separation
instead, which is the same boundary expressed differently.

No violations on the chat path. **No FOUNDATION-REQUEST needed.**
