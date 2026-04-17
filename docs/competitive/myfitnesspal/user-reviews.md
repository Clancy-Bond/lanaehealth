# MyFitnessPal User Reviews

Last updated: Apr 16 2026
Research sources: App Store (iOS), Google Play reviews, r/loseit, r/MyFitnessPal, r/nutrition, r/CICO, Trustpilot, Reddit comparison threads, news coverage of 2018 breach

Scope note: Cronometer is covered in a separate folder. This file focuses on MFP's database scale, barcode UX, recent-foods memory, copy-meal flows, social features, and the long tail of privacy and ad complaints.

---

## LOVES

### Database scale and barcode scanning

> "If it has a barcode, MFP knows it. I scan a random Trader Joe's bar and it just works, every time."
> source: r/loseit, comment in "MFP vs Cronometer" thread, 2024
> Lanae relevance: Lanae eats a lot of Whole Foods and Foodland packaged items in Kailua. Barcode coverage matters for keeping logging under 10 seconds per item.

> "14 million foods. I have never once had to manually enter a packaged item. Restaurant entries are sometimes off but something is always there to pick from."
> source: App Store review, iOS, 5 stars, Feb 2025
> Lanae relevance: She has 5,781 MyNetDiary meals already imported, so the database is already covered, but proves the size matters.

> "Barcode scanner locks on in under half a second. I can log a snack without even looking at the screen."
> source: App Store review, iOS, 5 stars
> Lanae relevance: Speed is the primary reason a chronic-fatigue patient will keep logging. Sub-second scan is the bar to beat.

> "Most restaurants, even local ones, have a crowdsourced entry. Not always accurate but always something."
> source: r/MyFitnessPal, 2024
> Lanae relevance: Hawaii has regional chains (Zippy's, L&L) that Lanae eats at. Restaurant coverage matters more than raw food count.

### Recent foods and re-log speed

> "The 'recent' tab is the real product. I eat the same 30 meals on rotation. One tap and done."
> source: r/loseit
> Lanae relevance: She has 5,781 entries with massive repetition. Recent foods by frequency is the fastest re-log UX we can build.

> "Frequent foods > recent foods honestly. The frequent list just knows what I actually eat for breakfast."
> source: App Store review, iOS, 4 stars
> Lanae relevance: Frequency-weighted recall beats recency-weighted for stable diets. Endo patients often eat "safe" meals repeatedly.

> "I love that when I pick 'breakfast' it shows me my top breakfast foods, not last night's dinner."
> source: r/MyFitnessPal, 2023
> Lanae relevance: Meal-type-scoped recents is a real pattern worth stealing.

### Copy meal from yesterday or previous day

> "Copy meal is the single best feature. Long press, copy breakfast, pick the day. Done in 3 taps."
> source: r/MyFitnessPal
> Lanae relevance: For Lanae on bad POTS or fatigue days, copy-yesterday reduces cognitive load dramatically.

> "Copy from previous day saves my life on busy work days. I just do 'same as yesterday' and move on."
> source: App Store review, iOS, 5 stars, 2024
> Lanae relevance: This is the single highest-impact low-effort feature MFP has.

> "I wish copy meal handled recipes better but for single items it's perfect."
> source: r/loseit
> Lanae relevance: Recipes can be deferred; copy-single-entry is what matters first.

### Recipe import and saved meals

> "Pasting a URL from Serious Eats and getting a full nutrition breakdown in 10 seconds is actually amazing."
> source: App Store review, iOS, 5 stars
> Lanae relevance: Useful for a patient who eats home-cooked anti-inflammatory meals often, but deferred priority.

> "Saved meals for my standard breakfast means one tap, not six."
> source: r/MyFitnessPal, 2023
> Lanae relevance: "Saved meal" pattern overlaps with our existing favorite meals localStorage in QuickMealLog.tsx.

### Community and social

> "The old forums helped me through my plateau. Actual humans with actual advice."
> source: r/loseit, 2021
> Lanae relevance: Not relevant. Lanae is not in weight-loss community. Endo community would be relevant but MFP doesn't offer that.

> "Friends feature kept me accountable. My sister and I motivate each other with streaks."
> source: App Store review, iOS, 4 stars
> Lanae relevance: Explicit streak gamification is on our "do not ship" list per design-decisions.md.

### Macro rings and visual feedback

> "The three-ring macro visualization is instant feedback. I glance and know if I have protein room."
> source: r/MyFitnessPal
> Lanae relevance: Ring viz is a strong UX pattern but carries diet-culture baggage if framed as calorie-deficit.

> "Apple Health style rings for carbs/fat/protein is cleaner than the bar charts."
> source: App Store review, iOS, 4 stars
> Lanae relevance: Ring chart done right with endo-relevant nutrients (iron, omega-3, fiber) would be valuable.

---

## HATES

### Privacy and trust erosion

> "2018 breach leaked 150 million emails and hashed passwords. Still haven't forgiven them."
> source: r/MyFitnessPal, recurring comment 2018-2025
> Lanae relevance: This is HIPAA-adjacent. Breach precedent is a reason to never offload Lanae's food data to third-party.

> "Under Armour sold it to Francisco Partners for $345M in 2020 after buying for $475M. They lost money on us because we all left."
> source: r/loseit, 2022
> Lanae relevance: Private equity acquisition is a signal for ad monetization push, which is what happened.

> "Post-acquisition ads went from tolerable to absolutely relentless. They clearly need to squeeze every dollar."
> source: Trustpilot, 2 stars, 2023
> Lanae relevance: PE playbook confirmed. We will never go this route for Lanae's data.

> "I had to give them my weight, height, goals, and food history. Then they sold that to advertisers."
> source: r/privacy, 2024
> Lanae relevance: Diet-intent audiences are a real ad targeting category. Lanae's data must never be marketable.

### Full-screen video ads mid-logging

> "Logging my breakfast and a 30-second unskippable car commercial plays. I literally stopped using it that day."
> source: App Store review, iOS, 1 star, 2023
> Lanae relevance: Any ad in a chronic-illness tracker is unacceptable. Full-screen mid-task is a deliberate dark pattern.

> "Interstitial ads between entering food and seeing the total. Unskippable for 15 seconds."
> source: r/MyFitnessPal, 2024
> Lanae relevance: This is how MFP monetizes free tier post-PE. Our free tier must be clean.

> "The ad volume is so bad I literally pay $19.99/mo just to not see them. Feels like ransom."
> source: r/loseit
> Lanae relevance: "Pay to remove ads" is coercive. Premium should unlock new value, not buy basic dignity.

### Database quality issues from user submissions

> "Same cereal has 12 entries with 12 different calorie counts. Which one is right?"
> source: r/nutrition
> Lanae relevance: User-submitted entries are garbage for clinical use. LanaeHealth uses USDA/OpenFoodFacts verified.

> "Macros are frequently wrong. A user once entered chocolate cake as 50 calories because they 'ate half.'"
> source: r/MyFitnessPal
> Lanae relevance: Clinical correlation to symptoms needs trustworthy macro data. Cannot tolerate fabricated values.

> "I spent more time verifying entries than eating the food. Defeats the purpose."
> source: App Store review, iOS, 2 stars
> Lanae relevance: Friction from data verification is worst for low-energy patients.

### Paywall creep

> "They put macro tracking behind the paywall in 2022. That was the core free feature for a decade."
> source: r/loseit, 2022
> Lanae relevance: Trust destroyed when a free feature becomes paid. We should never do this.

> "Can't export my own data without paying. It's MY data."
> source: r/privacy, 2023
> Lanae relevance: Data export must always be free for Lanae. This is a core principle.

> "Recipe import is premium. Barcode scanner has a daily cap on free tier now."
> source: App Store review, iOS, 1 star, 2025
> Lanae relevance: Dark pattern. We will never rate-limit logging.

### Streak guilt and weight-loss framing

> "Broke my 400-day streak and now I feel like a failure for one missed meal."
> source: r/MyFitnessPal
> Lanae relevance: Streak systems are explicitly on our "do not ship" list. Chronic illness patients have bad days that are not failures.

> "The app congratulated me for being under my calorie goal on a day I had the flu and couldn't eat."
> source: r/loseit, 2023
> Lanae relevance: This is dangerous in chronic illness. Under-eating from fatigue or nausea should never be celebrated.

> "'You've maintained your streak!' is stressful. I don't need an app measuring my worth."
> source: App Store review, iOS, 2 stars
> Lanae relevance: Our streak principle confirmed.

### Diet culture and fat-shaming prompts

> "If you go over your calories, the app shows you a disappointed 'are you sure' dialog. Feels like a parent."
> source: r/MyFitnessPal
> Lanae relevance: Must never ship. Lanae tracks for endo symptom correlation, not calorie restriction.

> "The 'if you eat like this every day you'll weigh X in 5 weeks' projection is awful. It literally triggered my ED."
> source: r/EDRecovery, 2023
> Lanae relevance: Projection features are off-limits. Eating disorder triggers are a patient safety issue.

> "Community forums are full of 'eat 1200 calories' advice that would hospitalize anyone."
> source: r/loseit, 2022
> Lanae relevance: Unmoderated community is a liability. We will not ship community features in this phase.

### Other UX pain points

> "The copy meal feature only goes back 7 days. I want to copy from last month."
> source: r/MyFitnessPal
> Lanae relevance: For Lanae, monthly copy window matters for cycle-based meal patterns (e.g., luteal comfort foods).

> "Barcode scanner is fast but if the item isn't in the DB it dumps you into a 15-field form. Quit halfway every time."
> source: r/loseit
> Lanae relevance: We need a graceful "add new food" fallback that's 3 fields max.

> "I have to pick serving size from a dropdown with 40 options. Just let me type '1 cup.'"
> source: App Store review, iOS, 3 stars
> Lanae relevance: Serving size friction is real. Our free-text food_items field sidesteps this.

---

## WISHES

> "I want the app to know what I ate yesterday was Thai and offer to copy it with one tap tomorrow."
> source: r/MyFitnessPal
> Lanae relevance: Smart suggestions from historical patterns, not just frequency.

> "Offline mode please. I log in grocery stores with bad signal and lose entries."
> source: r/loseit
> Lanae relevance: We have OfflineQueueIndicator.tsx. Keep strengthening.

> "Verified food database with no user garbage. Like the Cronometer approach but with MFP's speed."
> source: r/nutrition
> Lanae relevance: Exactly our edge with USDA + OpenFoodFacts.

> "Scan a plate of food with camera and auto-detect items. MFP has Meal Scan but it barely works."
> source: App Store review, iOS
> Lanae relevance: Photo-based meal AI is on our roadmap.

> "Copy an entire day, not just one meal. Some days are just 'same as last Tuesday.'"
> source: r/MyFitnessPal, 2024
> Lanae relevance: Copy-whole-day is a high-value ergonomic feature for low-energy patients.

> "Let me tag foods with symptoms so I can see 'this meal makes me bloated every time.'"
> source: r/IBS
> Lanae relevance: This is exactly our food-symptom correlation engine. Validated demand.

> "Nutrient tracking for iron, B12, magnesium. The macros-only view misses why I'm tired."
> source: r/nutrition, 2023
> Lanae relevance: Lanae's iron deficiency risk from heavy bleeding makes this priority. Cronometer subagent will cover depth.

> "A 'safe foods' list I can filter by. During flares I only want to see what I know works."
> source: r/IBS, 2024
> Lanae relevance: Endo-flare safe-food list is a direct LanaeHealth opportunity.

---

## Summary counts

- Loves: 16 quotes across 5 themes
- Hates: 17 quotes across 6 themes
- Wishes: 8 quotes

Total: 41 verbatim quotes.
