# Current state: AI chat surface

**Recording:** `docs/current-state/recordings/2026-04-29-app-tour.mp4`
**Frames:** `docs/current-state/frames/2026-04-29-app-tour/frame_0001.png` through `frame_0004.png` for the input sheet. The doctor mode output (frames 0057-0113) is also AI-generated content but is owned by the **doctors** brief, not this one. Notifications at frame 0010 deliver insights; treat that as Home's responsibility.

## What is on screen today

- **Composer sheet.** A bottom sheet slides up over Home. Header reads "Cancel" / "Save". The prompt rotates: one frame says "How are you feeling?" and another says "Anything to remember?". Body is a freeform textarea: "Type or hold the mic to speak". Below the textarea, a pill labeled "Hold to speak" sits left, and "Wed, Apr 29 at 4:01 PM" sits right as a passive timestamp.
- **Input modes.** Both keyboard input and a hold-to-speak voice mode are exposed. The keyboard appears with predictive-text suggestions ("I" / "The" / "I'm").
- **No conversation thread visible.** The recording does not show the chat history surface or any assistant response inside this sheet. Submission flow ("Save" button click -> response delivery) is not captured.

## Known gaps in this recording

- No assistant reply UI inside the chat sheet (markdown rendering, citations, follow-up affordances).
- No long-form chat thread / scrollback.
- No tool call surfacing (retrieval results, summary cards) within the chat.
- No "Ask AI" entry point captured in isolation; only the result of having tapped it.

## Routes that own this surface

The chat input sheet appears tied to the Home route (`/v2`) rather than a dedicated chat URL. The downstream session should grep for the sheet's strings ("How are you feeling?", "Anything to remember?", "Hold to speak") to locate the component:

```
grep -rn "Hold to speak" src/app/v2 src/v2 src/components 2>/dev/null
grep -rn "How are you feeling" src/app/v2 src/v2 src/components 2>/dev/null
```

If the chat surface needs its own route in v2, propose it via FOUNDATION-REQUEST before adding.

## Architecture pointers

- All Claude API calls flow through the Context Assembler (`src/lib/context/assembler.ts`). Static instructions FIRST, dynamic state LAST. Do not bypass this.
- 9-section compaction template applies to chat history, never free-form summaries.
- Memory is HINTS, not GROUND TRUTH. Live DB queries always override recalled state.
