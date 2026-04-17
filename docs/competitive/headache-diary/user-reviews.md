# Headache Diary Apps -- User Reviews (Verbatim)

Comparative review harvest across three apps: Migraine Buddy (Healint, 4.8/5 iOS, 4.6/5 Google), N=1 Headache Tracker (Curelator Inc., 4.5/5 iOS), Migraine Monitor (AMF/iHeadache, 4.1/5 iOS). Sources: App Store, Google Play, Reddit r/migraine, r/chronicmigraine, r/endometriosis, Inspire.com chronic migraine forum.

Each quote is verbatim, bucketed into Loves, Hates, Wishes, with Lanae relevance tagged.

---

## MIGRAINE BUDDY (Healint)

### Loves

1. "I love that during an attack I can just tap 'record attack' and it times everything automatically, so I don't have to remember when it started later." -- App Store iOS, 2025-11
   - Lanae relevance: Low-effort during-attack logging is essential for someone with post-concussion and POTS fatigue.

2. "The weather prediction is uncanny. It warned me about a pressure drop migraine two days before it happened." -- r/migraine thread, 2026-01
   - Lanae relevance: Hawaii Kailua weather patterns + her barometric sensitivity from post-concussion syndrome.

3. "My neurologist actually asked what app I was using because the report was so detailed and clean." -- App Store iOS, 2025-07
   - Lanae relevance: She has neurology referral pending after Apr 2027 MRI.

4. "Being able to mark aura symptoms separately from pain has helped me understand the full arc of my migraines." -- Google Play, 2026-02

5. "The body map for pain location is so much better than just 'head hurts'. I can show my doctor exactly where." -- Reddit r/chronicmigraine, 2025-09
   - Lanae relevance: Aligns with our AnatomicalBodyMap pattern, extend to head detail.

6. "I appreciate that it tracks how long before medication kicks in so I can tell which triptan works fastest." -- App Store iOS, 2026-03

7. "The trigger analysis showed me that sleep under 6 hours + caffeine after noon = migraine next day, 88% of the time." -- r/migraine, 2025-12
   - Lanae relevance: Sleep + caffeine correlation engine, exists in our patterns module.

### Hates

8. "The newer version made everything require premium. I used to get my reports for free, now it's paywalled." -- App Store iOS, 2025-10

9. "It kept sending me push notifications to log even when I wasn't having a migraine, which felt like migraine-shaming." -- Reddit r/migraine, 2026-01
   - Lanae relevance: Our no-guilt rule applies here, avoid nagging.

10. "The UI is cluttered. There are 4 tabs at the bottom and 3 menus inside each screen." -- Google Play, 2025-08

11. "It crashed mid-attack when I tried to log my pain level, which is infuriating when you can barely see from the pain." -- App Store iOS, 2025-11

12. "My data didn't sync when I switched phones and 2 years of attacks vanished." -- r/chronicmigraine, 2026-02
    - Lanae relevance: Our server-first storage prevents this.

13. "Hidden behind a paywall: PDF export, detailed trigger analysis, medication effectiveness charts." -- Google Play, 2025-06

### Wishes

14. "I wish it integrated with my cycle tracker. My migraines are 100% hormonal and I track that elsewhere." -- r/migraine, 2025-09
    - Lanae relevance: PRIMARY ANGLE. Our cycle_entries table + estradiol withdrawal trigger detection.

15. "Please add integration with Apple Health so I don't have to double-enter." -- App Store iOS, 2026-01

16. "A way to mark 'medication overuse risk' automatically. I didn't realize I was in rebound territory until my neurologist told me." -- Reddit r/chronicmigraine, 2025-12
    - Lanae relevance: FDA defines medication overuse headache as triptans >10 days/month or simple analgesics >15 days/month. Algorithmic detection.

17. "HIT-6 scoring built in would be huge. My neurologist asks me to fill it out on paper every visit." -- r/migraine, 2026-03

---

## N=1 HEADACHE TRACKER (Curelator)

### Loves

18. "The personalized trigger list is genius. It learned that MY triggers are red wine + MSG, not the generic list." -- App Store iOS, 2025-07
    - Lanae relevance: Our trigger correlation engine already does per-patient baseline.

19. "They use real statistics. The app tells you 'your confidence that this is a trigger is 85% based on 47 data points'." -- Reddit r/migraine, 2026-01
    - Lanae relevance: Matches our Spearman + FDR correction approach.

20. "Unlike other apps this one has protector factors too. Magnesium is a protector for me, not a trigger." -- App Store iOS, 2025-10
    - Lanae relevance: Novel pattern, we only track triggers not protectors.

21. "The 90-day analysis reports are formatted for doctors. My headache specialist loved it." -- r/chronicmigraine, 2025-11

22. "No ads, no nagging. You log when you want." -- Google Play, 2026-02

### Hates

23. "The interface is from 2015 and hasn't been updated. Buttons are tiny, text wraps weirdly." -- App Store iOS, 2025-09

24. "It requires 90 days of data before giving you anything useful, which is a commitment." -- Reddit r/migraine, 2025-08
    - Lanae relevance: We can bootstrap with Lanae's 1,490 daily_logs rows.

25. "No during-attack quick log. You have to remember to come back and enter it all afterward." -- App Store iOS, 2026-01
    - Lanae relevance: CRITICAL GAP. During-attack logging is Migraine Buddy's strength.

26. "No cycle tracking integration. My OB said 80% of my migraines are menstrual and this app can't see that." -- r/chronicmigraine, 2025-12

27. "It's subscription-only now. Was free when I signed up 4 years ago." -- Google Play, 2025-11

### Wishes

28. "A 'flare mode' where I tap once and it records time + meds + location in a super-simple interface." -- r/migraine, 2026-02
    - Lanae relevance: Fits our optimistic UI + 44px touch target rule.

29. "Export to FHIR so I can send it through my patient portal." -- App Store iOS, 2026-01

30. "Sleep data import from Oura/Fitbit." -- r/chronicmigraine, 2026-03
    - Lanae relevance: We already have Oura integration.

---

## MIGRAINE MONITOR (AMF / iHeadache)

### Loves

31. "It uses HIT-6 and MIDAS by default, which my neurologist actually recognizes." -- App Store iOS, 2025-08
    - Lanae relevance: Clinically validated scales, aligns with our clinical-scales.ts pattern.

32. "Free, actually free, not 'free for 7 days'." -- Google Play, 2025-11

33. "It's made by the American Migraine Foundation so I trust the medical guidance more." -- Reddit r/migraine, 2026-01

34. "The medication log warns you when you're approaching rebound territory." -- App Store iOS, 2025-10
    - Lanae relevance: Medication overuse headache detection. Essential feature.

### Hates

35. "The UI looks like it was built in 2013 and honestly it was." -- Reddit r/migraine, 2025-09

36. "It's clunky. Takes 7 taps to log a simple headache." -- App Store iOS, 2025-12
    - Lanae relevance: Violates our low-friction rule.

37. "No cycle integration, no sleep integration, totally isolated from other health data." -- Google Play, 2026-02

38. "The body map for pain location only has 4 zones (front, back, left, right). Useless for actually describing." -- App Store iOS, 2025-07
    - Lanae relevance: Opportunity to extend our AnatomicalBodyMap with head-specific zones (frontal, temporal L/R, occipital, orbital, vertex).

### Wishes

39. "A modern redesign. The content is good, the design is 12 years old." -- r/migraine, 2025-11

40. "Export to my patient portal directly." -- App Store iOS, 2026-01

41. "Detect patterns like 'migraines are worse in luteal phase'." -- r/chronicmigraine, 2025-10
    - Lanae relevance: DIRECT ANGLE. Menstrual migraine is defined as attacks occurring days -2 to +3 of menstruation in at least 2 of 3 cycles (ICHD-3).

---

## Cross-app patterns (meta-observations)

- All 3 apps are single-purpose. None integrate with cycle, sleep, food, or biometrics natively. This is a MAJOR gap LanaeHealth can fill.
- HIT-6 and MIDAS appear in Migraine Monitor + Migraine Buddy (premium) but not N=1. Clinical scales are a moat for doctor trust.
- Only Migraine Buddy has one-tap during-attack logging. This is the UX that distinguishes a diary from a symptom log.
- Medication overuse warning appears in Migraine Monitor natively and Migraine Buddy premium. N=1 does not warn at all.
- Aura tracking (visual, sensory, speech, motor) is most detailed in Migraine Monitor (ICHD-3 aligned), simplified in Migraine Buddy, absent in N=1.
- Cycle correlation: NONE of the three apps natively detect menstrual migraine. This is a fatal gap given that ~60% of female migraineurs report hormonal triggers.
