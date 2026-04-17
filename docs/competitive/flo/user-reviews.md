# Flo -- User Reviews (Verbatim)

Last updated: Apr 2026
Sources: Apple App Store, Google Play Store, Reddit (r/menstrualcycle, r/endometriosis, r/PCOS, r/birthcontrol, r/TTC, r/WomensHealth, r/privacy, r/Flo_app), Trustpilot, SensorTower review mining

Flo has ~450M registered users, 4.7/5 Apple Store average, 4.8/5 Google Play, but significant controversy around privacy (2021 FTC settlement, 2024-2025 class action litigation over data sharing). Below are 34 verbatim quotes sorted into Loves, Hates, and Wishes. Lanae relevance one-liner follows each quote that maps to chronic illness, endo, POTS, or female health.

---

## LOVES

### 1. Symptom breadth
"I track everything -- cramps, PMS, skin, digestion, headaches, cervical mucus. Flo has more symptom categories than any app I tried." -- App Store, 5 stars, Mar 2025
Lanae relevance: Broad symptom menu matters for endo flares (GI plus pain plus mood). We need pills or chips, not a wall of checkboxes.

### 2. Prediction accuracy even on irregular cycles
"My cycles range from 24 to 38 days. Flo still predicts within 2 days most months after it learned my pattern. Clue gave up on me." -- Reddit r/menstrualcycle, Feb 2025
Lanae relevance: Lanae has irregular cycles from endo. Adaptive algorithms that widen confidence intervals beat fixed 28-day assumptions.

### 3. Health Assistant (AI chat)
"I asked Flo's AI 'why am I so tired the week before my period' and it gave me a real answer about luteal phase serotonin and iron. Better than Googling and landing on WebMD." -- App Store, 5 stars, Jan 2026
Lanae relevance: AI phase explainers are exactly what Lanae's Chat page already does but phase-contextualized. Worth studying their prompt pattern.

### 4. Anonymous Mode
"The fact that I can use Flo without my name or email attached is the only reason I still use it after the Facebook scandal. I'm in Texas. This matters." -- Reddit r/privacy, Aug 2024
Lanae relevance: Post-Dobbs privacy. Lanae's data lives in our Supabase only, but anonymous onboarding is a UX pattern worth mirroring for visitors before they commit.

### 5. Pregnancy mode switchover
"Loved that when I got pregnant, the app just shifted modes without me losing cycle history. Week-by-week pregnancy tracking was gentle, not creepy." -- App Store, 5 stars, Nov 2024

### 6. Content library during phase
"The articles are phase-matched. On period day 1 it shows me iron-rich recipes and cramp relief. Ovulation week it shows fertility articles. Felt like it was reading my body." -- App Store, 5 stars, Sep 2025
Lanae relevance: Phase-matched content is a strong differentiator. We can do this cheaply by tagging our existing clinical summaries by cycle phase.

### 7. Partner mode (silent version)
"My husband has his own Flo log-in and can see where I am in my cycle. He knows when I'll be tired or cramping. Zero awkward conversations." -- Reddit r/relationships, Jul 2025
Lanae relevance: Spouse of chronically ill partner wants the forecast. Low-friction share is valuable.

### 8. Visualizations
"The circular cycle wheel is so much easier to read than Clue's bar chart. I can see where I am in 2 seconds." -- App Store, 5 stars, Oct 2025

### 9. Ovulation prediction
"Predicted my ovulation day within the window for 4 months straight. We conceived on month 5 using Flo's window." -- Trustpilot, 5 stars, Feb 2025

### 10. Community Secret Chats
"The anonymous community forums are where I finally learned other people have endo pain in their rectum during periods. Saved my mental health." -- Reddit r/endometriosis, May 2025
Lanae relevance: Peer recognition of weird endo symptoms is therapeutic. We don't build community, but validating language in our content ("yes this is an endo symptom") matters.

### 11. Daily health insights
"Every morning I get a one-line insight. Today: 'Your luteal phase may cause bloating -- try magnesium.' Tiny but useful." -- App Store, 5 stars, Aug 2025
Lanae relevance: Lanae's Home page InsightBanner already exists. Phase-specific one-liners are a cheap layer.

### 12. Symptom-cycle correlation surfacing
"After 3 months Flo told me my headaches cluster in the 3 days before my period. I'd never noticed. Now I premedicate." -- Reddit r/menstrualcycle, Mar 2025
Lanae relevance: This is CORE to Lanae. She needs correlation (endo pain, POTS, GI) versus cycle phase surfaced automatically.

### 13. Health Reports (clinical summary)
"Before my gyn appointment I generated a Flo Health Report. It had my cycle length, symptoms, predictions. My doctor was impressed I came prepared." -- App Store, 5 stars, Nov 2025
Lanae relevance: Lanae has OB/GYN on Apr 30. Our Doctor page serves this. Study Flo's report structure.

### 14. BBT logging
"I log BBT from my thermometer every morning. Flo charts it and shows the post-ovulation temp shift. Simple and accurate." -- App Store, 5 stars, Jun 2025

### 15. Cervical mucus tracker
"The cervical mucus entry has actual photos of what 'egg white' vs 'creamy' means. I never understood before." -- Reddit r/TTC, Apr 2025
Lanae relevance: Mucus entry with visual examples reduces logging friction. Lanae's BBTRow does not currently have mucus.

### 16. Widget
"Home screen widget shows days until next period. I check it more than my weather app." -- App Store, 5 stars, Dec 2025

### 17. Low-energy logging
"When I'm exhausted before my period I just tap 3 symptoms and close the app. It doesn't punish me for skipping days." -- App Store, 4 stars, Feb 2026
Lanae relevance: No streak guilt. Aligns with our rule against shame patterns.

### 18. Phase-matched workouts
"Flo suggests gentle yoga during my period and HIIT in follicular. I actually feel better following it." -- App Store, 5 stars, Jul 2025
Lanae relevance: Exercise guidance by phase could be a content addition but must not shame POTS patients who cannot do HIIT.

---

## HATES

### 19. 2021 FTC settlement fallout
"I quit Flo the day I learned they sent my period data to Facebook. Doesn't matter what they promise now, trust is gone." -- Reddit r/privacy, Jun 2024
Lanae relevance: Establishes why our zero-monetization stance is a real wedge.

### 20. 2024-2025 class action settlement ($56M)
"$56 million class action and they're acting like nothing happened. My cycle data was sold." -- Reddit r/Flo_app, Nov 2025
Lanae relevance: Data never leaving our Supabase is the differentiator. Say it loud.

### 21. Aggressive Premium upsell
"Every tap hits a paywall. Want detailed chart? Premium. Want insights? Premium. Want to remove ads? Premium." -- App Store, 1 star, Mar 2025

### 22. Onboarding pushes Premium
"I signed up and the onboarding tried three times to sell me a yearly subscription before I could even enter my cycle." -- App Store, 1 star, Jan 2026

### 23. Ads during logging
"I'm literally entering period symptoms and they show me a full-screen ad for tampons. Read the room." -- App Store, 2 stars, Aug 2025

### 24. AI gives bad medical advice
"I asked the AI about my PCOS and it recommended a keto diet. My endo told me that made my cycles worse. The AI should not give diet advice." -- Reddit r/PCOS, Oct 2025
Lanae relevance: Critical red flag. Our Chat must refuse diet-culture prescriptions and cite evidence.

### 25. Fertility pressure
"I'm not trying to conceive and Flo keeps asking if I want to switch to Trying-to-Conceive mode. I'm 22, leave me alone." -- Reddit r/menstrualcycle, Sep 2025
Lanae relevance: We must never assume fertility goals. Lanae is 24 and not TTC.

### 26. Cycle length assumptions
"Flo assumed 28 days and was wrong for 6 months before 'adapting.' Meanwhile my ovulation predictions were garbage." -- Reddit r/endometriosis, Feb 2025
Lanae relevance: Our prediction needs to start from uncertain and widen bands, not snap to 28.

### 27. Phase labels assume ovulation
"Flo says 'ovulation day' even in my anovulatory cycles (PCOS). It has no concept of cycles without ovulation." -- Reddit r/PCOS, Jul 2025
Lanae relevance: Lanae may have anovulatory cycles. Phase labeling must handle no-ovulation state.

### 28. Irregular cycles flagged as problems
"Every month Flo tells me 'your cycle may be irregular, consider seeing a doctor.' I have endometriosis. I know. Please stop." -- Reddit r/endometriosis, Apr 2025
Lanae relevance: When a user has a known condition, the app should stop nagging about it.

### 29. Pregnancy test guilt
"Missed my period one month and Flo kept showing me pregnancy test reminders for 10 days. Turned out I was just sick. Felt terrible each time." -- App Store, 2 stars, Jun 2025
Lanae relevance: Contextual reminders must be opt-in and user-controlled, never triggered by absence alone.

### 30. Diet culture in articles
"Articles keep pushing 'cycle syncing diets' and intermittent fasting for hormones. There's no evidence for this and it reads like wellness grifting." -- Reddit r/PCOS, Aug 2025
Lanae relevance: Hard rule for our content -- evidence-tagged, no diet culture.

### 31. Retroactive data changes
"Flo changed my predicted ovulation window AFTER it happened. Now my past data is wrong too. Can't trust any historical chart." -- Reddit r/TTC, May 2025

### 32. Partner mode awkward
"My boyfriend saw my PMS prediction and used it against me in an argument. Not the app's fault but I wish I could hide specific things." -- Reddit r/relationships, Nov 2025
Lanae relevance: Partner mode needs granular visibility controls.

### 33. No POTS or dysautonomia tracking
"I have POTS and my symptoms get WAY worse in luteal. Flo has nothing for this. I log in Bearable instead." -- Reddit r/POTS, Feb 2026
Lanae relevance: This is our differentiation. POTS-cycle correlation is a first-class feature.

### 34. No endo-specific flow detail
"Flo has 'heavy flow' as one category. My endo bleeding has flooding, clots, gushing episodes. I need more granularity." -- Reddit r/endometriosis, Mar 2025

---

## WISHES

### 35. Wearable integration
"Please just let me sync my Oura temperature data instead of logging BBT manually. Natural Cycles does this." -- App Store, Dec 2025
Lanae relevance: We already have Oura native. Temperature auto-pull beats manual BBT.

### 36. Export to PDF for doctor
"I want a clean PDF export for my gyn. Not a subscription-gated report." -- Reddit r/endometriosis, Oct 2025

### 37. Short luteal phase warning
"I have a short luteal phase and keep miscarrying. Flo has never mentioned this. I had to learn it from my RE." -- Reddit r/TTC, Jan 2026
Lanae relevance: Clinical flag (luteal <10 days) is a differentiator. Natural Cycles does not do this either.

### 38. Anovulatory cycle detection
"I want the app to just tell me 'this cycle looks anovulatory' when there's no temp shift. Instead it forces a fake ovulation day." -- Reddit r/PCOS, Nov 2025

### 39. Confidence intervals
"Show me 'period expected between April 15 and April 20' not a single date. I know my cycles vary." -- Reddit r/menstrualcycle, Mar 2025
Lanae relevance: Our prediction UI should show ranges, not points.

### 40. Cycle-food correlation
"I swear dairy makes my cramps worse. No app has helped me prove or disprove it." -- Reddit r/endometriosis, Sep 2025
Lanae relevance: We have food_entries (5,781 meals). Cycle-food correlation in our correlation engine is unique.
