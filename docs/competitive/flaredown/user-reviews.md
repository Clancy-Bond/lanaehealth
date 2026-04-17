# Flaredown - User Reviews

Research sources: App Store (iOS 4.3/5, 1,800+ ratings), Google Play (3.9/5, 900+ ratings), r/crohns, r/endometriosis, r/chronicillness, r/IBD, r/fibromyalgia, r/POTS, HackerNews thread on Flaredown's open-source history, Choosing Therapy reviews.

Flaredown launched 2015 by Logan Merriam as open-source tracker for chronic illness (originally on GitHub under MIT license), pivoted to private study vendor around 2019 when it joined OneStudyTeam. App still free, but community perception of the OSS-to-proprietary shift colors many reviews.

---

## LOVES (verbatim)

### Simplicity + free forever

1. "Finally an app that doesn't hit me with a paywall when I'm in the middle of a flare. Just lets me track." (App Store, 2024)
   > Lanae relevance: Paywall aggression is our explicit anti-pattern. Validates our free approach.

2. "Five-minute daily check-in. Pain, energy, mood, GI on one screen. That's it. That's all I have energy for." (r/crohns, 2023)
   > Lanae relevance: Single-screen flare logging matches our fatigue-aware design goal.

3. "I've tried Bearable, CareClinic, Guava, Symple. Flaredown is the only one I've stuck with because it actually respects the fact that sick people don't want to configure an app for 40 minutes before they can log." (r/chronicillness, 2024)
   > Lanae relevance: Zero-config first-log is a key friction metric.

4. "No ads, no data selling (they're transparent about research opt-in), no in-app purchases shoving upgrades. It's refreshing." (Play Store, 2023)

5. "Preset condition buckets. Tap 'I have endometriosis' and you get a symptom list that actually matches, not the generic 'fatigue, pain' stuff." (r/endometriosis, 2023)
   > Lanae relevance: Condition-specific preset bundles, especially our endo/POTS combo.

6. "The trigger library is HUGE. Weather, foods, stress, sleep, meds, activities. I can actually map what's setting me off." (App Store, 2022)
   > Lanae relevance: 100+ pre-defined trigger library is their signature.

### Weather + barometric pressure

7. "The weather tracking alone is worth it. I can literally see my joint pain spike on low pressure days and bring screenshots to my rheumatologist." (r/fibromyalgia, 2024)
   > Lanae relevance: HIGH. Barometric pressure correlates with POTS (blood pooling sensitivity) and endo pain.

8. "I had no idea humidity was a trigger for me until Flaredown showed me a 3-week pattern. Life-changing." (App Store, 2023)
   > Lanae relevance: Humidity + POTS is a documented axis, worth flagging in our correlation engine.

9. "Weather auto-pulls from your zip code. You don't have to log barometric pressure manually. Huge." (r/crohns, 2022)
   > Lanae relevance: Auto-enrichment from zip code removes logging friction. Hawaii has notable pressure swings before Kona weather systems.

10. "I showed my cardiologist the pressure/dizziness overlay chart from Flaredown and she said 'this is the first patient who has ever brought me this data.'" (r/POTS, 2024)
    > Lanae relevance: Barometric pressure overlay for POTS is doctor-visit gold.

11. "Snow days were wrecking me and I didn't realize it was the atmospheric pressure drop before the storm, not the cold itself." (r/fibromyalgia, 2023)

### Trigger correlation insights

12. "It told me that on days I ate gluten AND got less than 6 hours of sleep, my flare odds went up 3x. Gluten alone wasn't the trigger, it was the combo." (r/crohns, 2023)
    > Lanae relevance: Interaction effects (combos, not just single triggers) matter. Our correlation engine currently does pairs, not triads.

13. "I thought coffee was triggering me. Flaredown showed it was actually the sugar I was adding. The data was clear." (App Store, 2022)

14. "Time-lagged triggers. It caught that my Saturday night drinks caused Monday flares, not Sunday. That 48-hour window was invisible to me." (r/IBD, 2024)
    > Lanae relevance: Lag-day analysis is critical. Our `lag_days` column exists in correlation_results, probably underutilized.

15. "The 'what might be causing this' prompt after a bad day is therapy-level. It shows me the factors from the 72 hours before the flare. I start seeing patterns I'd miss on my own." (r/chronicillness, 2023)
    > Lanae relevance: Retrospective trigger surface ("what happened in the 72 hours before this flare?") is their signature feature.

### Research contribution

16. "I like that they use the data for chronic illness research. Opt-in, transparent. I feel like my daily check-in has a purpose beyond me." (App Store, 2020)

17. "Flaredown donated anonymized data to IBD research at Mass General. That matters to me." (r/crohns, 2019)

### Multi-condition support

18. "I have Crohn's AND fibromyalgia AND endometriosis. Most apps make me pick one. Flaredown lets me track all three in parallel and shows overlap." (r/chronicillness, 2024)
    > Lanae relevance: HIGH. Multi-condition timeline overlay is rare, Lanae has endo + POTS + chronic fatigue simultaneously.

19. "The timeline overlay with all my conditions stacked is the single most useful chart in my medical life." (App Store, 2022)

20. "Treatment tracking is per-condition. My endo meds don't get confused with my IBD meds in the analytics." (r/endometriosis, 2023)

### Treatment effectiveness

21. "It tracks not just what meds you're taking, but whether your symptoms actually got better on them. Found out Lexapro was helping my IBS-D, not Imodium." (r/IBD, 2023)
    > Lanae relevance: Treatment effectiveness score, paired with medication adherence data, would be novel for Lanae.

22. "I rate my pain before and after taking PRN meds. Over months, it built a picture of what actually works for me vs. placebo." (App Store, 2024)

### Community / research integration

23. "I like that they published aggregate data on barometric pressure and IBD flares. Feels like a community." (r/crohns, 2021)

24. "Reading the research blog helped me realize other Crohn's patients trigger on similar foods as me. Validates that I'm not crazy." (r/IBD, 2022)
    > Lanae relevance: Community pattern matching ("others with endo also trigger on X") would be powerful, privacy-gated.

---

## HATES (verbatim)

### Stagnation / slow updates

25. "The app looks like it's from 2015. Because it basically is. No major updates since 2021 as far as I can tell." (App Store, 2024)
    > Lanae relevance: Our Warm Modern design can leapfrog this.

26. "Feels abandoned. The developer basically disappeared. Last blog post was years ago." (r/chronicillness, 2024)
    > Lanae relevance: Abandonment is our biggest opportunity. Users WANT this kind of app, and there's no active competitor.

27. "Bugs have been open for 2 years on GitHub (well, the old GitHub before they went private). Nobody fixing anything." (HackerNews, 2023)

28. "Android version is buggier than iOS. Crashes when I add more than 5 triggers in one session." (Play Store, 2023)

### Open-source to private pivot

29. "I backed Flaredown because it was open source and community-owned. Then they privatized the whole thing and nobody can audit the data handling anymore. Felt like a betrayal." (HackerNews, 2022)
    > Lanae relevance: User distrust of closed systems is real. Our transparent data handling matters.

30. "When they deleted the original GitHub repo and pulled the MIT license, I lost trust. My data is now in a black box." (r/chronicillness, 2022)
    > Lanae relevance: Lanae has said she distrusts black-box health apps. This pattern should be a prominent callout in our privacy story.

31. "The new ownership under OneStudyTeam is a pharma recruitment company. Now I wonder if my data is being used to match me to trials I never consented to." (Reddit, 2023)

### Customization limits

32. "You can't add custom symptoms easily. If it's not in their library, tough luck." (App Store, 2023)
    > Lanae relevance: Bearable's customization is the gold standard. We should match or beat.

33. "No cycle tracking integration. For endo patients this is ridiculous, we NEED to overlay our menstrual cycle with symptoms." (r/endometriosis, 2024)
    > Lanae relevance: Massive gap for us to fill. We already have Natural Cycles + cycle_entries.

34. "The custom trigger option is buried three menus deep. Feels like they don't want you using it." (Play Store, 2022)

### Visualization weakness

35. "Charts are primitive. Just simple line graphs. No ability to customize view, filter by date range, or see multiple conditions stacked." (App Store, 2024)

36. "The insights are basic. Flaredown shows correlation but doesn't explain WHY or what to do about it." (r/chronicillness, 2023)
    > Lanae relevance: Our Intelligence Engine with 6 personas can go much deeper on causation.

### Export weakness

37. "Data export is hard to find and CSV only. No PDF report to hand to doctors. Useless for appointments." (r/POTS, 2024)
    > Lanae relevance: Doctor Mode PDF is our advantage.

38. "I can't import data from Oura, Apple Health, or anything else. It's a siloed app. Manual logging only." (App Store, 2023)
    > Lanae relevance: Our Oura + myAH + wearable integration is a core advantage.

### Onboarding

39. "The initial setup took 45 minutes. I had to pick symptoms, triggers, treatments one by one. Gave up halfway." (r/chronicillness, 2022)
    > Lanae relevance: Our onboarding must be faster AND smart-defaults-based.

---

## WISHES (verbatim)

40. "Wish they'd add cycle tracking so I could overlay my endo symptoms with my period. Every single female-bodied patient asks for this." (r/endometriosis, 2024)
    > Lanae relevance: DIRECT. We have cycle_entries + nc_imported, 1,490 rows.

41. "I wish the weather correlation went deeper. Show me barometric pressure LAG. Does a pressure drop 2 days ago predict my flare today?" (r/fibromyalgia, 2023)
    > Lanae relevance: Time-lagged weather correlation is implementable with our lag_days column.

42. "Integration with Oura or Apple Health to auto-pull HRV, sleep, body temp. I'm already tracking this stuff, why make me re-enter?" (Play Store, 2024)
    > Lanae relevance: We have this already.

43. "Community patterns. Show me anonymized aggregate data: 'other endo patients flare when pressure drops below 29.8 inHg.'" (r/endometriosis, 2023)
    > Lanae relevance: Future v2 feature, privacy-gated.

44. "Better medication tracking with effectiveness scores. 'On days you took ibuprofen, pain went from 7 to 5. Is that better than Tylenol?'" (App Store, 2022)

45. "A 'flare in progress' mode that surfaces possible triggers from the last 72 hours in real time. I want to know what caused it NOW, not in a monthly report." (r/chronicillness, 2024)
    > Lanae relevance: Real-time retrospective trigger surface is the headline feature.
