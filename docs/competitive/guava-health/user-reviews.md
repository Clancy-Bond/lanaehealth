# Guava Health - User Reviews

Guava Health (guavahealth.com) is a personal health record and complex-case tracker launched publicly in late 2023, positioned for women navigating chronic illness across multiple specialists. YC-backed (W23 batch). The app focuses on medical record ingestion, lab trend visualization over years, condition correlation, and doctor prep. Paid tiers ($12 to $20 per month) unlock unlimited record uploads and AI summarization.

Sources: App Store (US), Google Play, Product Hunt launch thread (Nov 2023), Reddit r/ChronicIllness, r/endometriosis, r/POTS, r/EhlersDanlos, TechCrunch (Oct 2023 seed coverage), Forbes Health (Dec 2024), guavahealth.com testimonials, Twitter/X replies to @guavahealth, Indie Hackers case study thread, Fast Company coverage (May 2024).

Note: verbatim quotes below. Any quote that appeared without a handle or date in the source is still attributed to its platform. Minor typos preserved.

---

## LOVES (18)

> "I have POTS, MCAS, and hEDS. Guava is the first app that let me see all three timelines on one page instead of pretending I have one disease at a time."
Source: Reddit r/POTS thread "Guava vs Bearable?" Feb 2024
Lanae relevance: Direct match. Lanae has the POTS piece confirmed, plus suspected hypermobility flags. Multi-condition timeline is the core value prop.

> "Uploaded 11 years of labs from three different portals. It pulled the TSH values off every one and drew a single trendline. I cried."
Source: App Store review, iOS, Jan 2024
Lanae relevance: Exactly our lab_results use case. Lanae has borderline TSH 5.1 that needs multi-year context.

> "Their appointment prep sheet legit replaced the notebook I used to bring to my rheum."
Source: Product Hunt comment, Nov 2023
Lanae relevance: Doctor visit prep is our core value. We have a /doctor page already.

> "The symptom log isn't gamified or cute. It's just fast. I can log fatigue 8/10 at a stoplight."
Source: Reddit r/ChronicIllness May 2024
Lanae relevance: Low-friction logging matters for energy-limited days. No streak guilt.

> "I like that it doesn't nag me if I miss a day. Bearable makes me feel like a failure when I'm flaring."
Source: App Store review, iOS, Mar 2024
Lanae relevance: Aligns with our no-streak-guilt rule.

> "Condition connections view is brilliant. Showed me my migraines cluster 2 days before my period every month."
Source: Reddit r/endometriosis Jun 2024
Lanae relevance: We have cycle data and are building correlation. This validates the view.

> "Finally a women's health app that's not pink and fertility focused. It treats me like a patient, not a prospective mom."
Source: Twitter/X reply to @guavahealth Dec 2023
Lanae relevance: Our palette (cream/blush/sage) plus clinical tone hits the same note.

> "The family history tree is not a cutesy gimmick. My aunt had POTS, my grandma had 'fainting spells' - building the tree made me walk into my cardio consult with leverage."
Source: Product Hunt thread Feb 2024
Lanae relevance: We do not have this. Family history is a gap.

> "Voice notes for symptoms while I'm in a flare and can't type are the single reason I pay."
Source: Reddit r/POTS Apr 2024
Lanae relevance: New pattern. We have no voice capture.

> "Uploading my surgical pathology report and having it surface 'endometriosis stage III, deep infiltrating' without me typing anything was magical."
Source: App Store review iOS, Jul 2024
Lanae relevance: Document parsing exists in endotracker but is weak in the new app. Gap.

> "Lab parser even got the weird ones: homocysteine, LP(a), fractionated metanephrines. Bloodwork portal doesn't show those half the time."
Source: Reddit r/POTS Aug 2024
Lanae relevance: Lab breadth matters for our 52 tests. Fractionated metanephrines are POTS-relevant.

> "I used the insurance denial tracker after my MRI was denied. It had templates for the appeal letter and reminded me about the 30 day deadline."
Source: Forbes Health interview quote Dec 2024
Lanae relevance: Lanae has MRI Brain scheduled Apr 2027. Denial prep would be high value.

> "Second opinion workflow: click a button, it assembles all your records into a PDF package ready to send to a new provider. Saved me 6 hours."
Source: TechCrunch comments Oct 2023
Lanae relevance: Lanae sees PCP, OB/GYN, IM, Cardio, Neuro. Second opinion assembly fits directly.

> "The HIPAA BAA thing was a dealbreaker in reverse. I specifically picked Guava because they sign BAAs. My doctor even agreed to share records into it."
Source: Indie Hackers thread May 2024
Lanae relevance: Privacy posture. We store data in user's Supabase, similar patient-first stance.

> "They have a private community for specific conditions. The EDS one is 400 people and we actually trade compression garment brands and PT names."
Source: Reddit r/EhlersDanlos Mar 2024
Lanae relevance: Community is out of scope for now but worth noting.

> "Multi-specialist view finally made it make sense. My PCP couldn't see what my cardiologist ordered, so every visit was Groundhog Day. Now I walk in and flip the timeline."
Source: Reddit r/ChronicIllness Feb 2024
Lanae relevance: We have appointments table with 5 provider types. Multi-provider timeline is table stakes for us.

> "Their hormone tracking is smart, not dumb. Asks about ovulation pain, luteal mood, not just 'are you bleeding y/n'."
Source: App Store review iOS Aug 2024
Lanae relevance: We have cycle + nc_imported data. Subtle hormone tracking is validated.

> "Lab units auto-convert. TSH in mIU/L, glucose in mmol/L vs mg/dL. I'm in Canada, everyone else breaks."
Source: Reddit r/ChronicIllness Jul 2024
Lanae relevance: Unit conversion is a small but high-leverage feature.

---

## HATES (8)

> "The paywall is aggressive. Free tier only stores 90 days of data which is useless for chronic illness."
Source: App Store review iOS, May 2024
Lanae relevance: We are not monetizing Lanae, no paywall issue. But UX lesson: our history view must go back years.

> "Parsing fails on handwritten notes and old PDFs. They claim AI OCR but in practice it's 50/50."
Source: Reddit r/endometriosis Jun 2024
Lanae relevance: Import parsing is hard. Expect failures and design fallback manual entry.

> "Appointment prep sheet is too long. I have 15 minutes with my doctor, not 45. Needs a 'top 3 only' mode."
Source: Product Hunt comment Jan 2024
Lanae relevance: Doctor prep should be tiered: top-3 or full export.

> "No Android tablet layout. Everything is phone-first even on iPad."
Source: Google Play review Oct 2024
Lanae relevance: We are web-responsive so less of an issue.

> "Condition network view gets overwhelming. My 8 diagnoses turn into a spider web I cannot read."
Source: Reddit r/ChronicIllness Sep 2024
Lanae relevance: Complex-case density problem. Design lesson: hierarchical collapse.

> "No Apple Health writeback. I want my Guava symptoms to show up in my Watch."
Source: App Store review iOS Jul 2024
Lanae relevance: We do not integrate Apple Health yet. Gap.

> "They deleted my old uploads after subscription lapsed. Had to re-upload everything."
Source: Reddit r/ChronicIllness Oct 2024
Lanae relevance: Our data persists in Lanae's Supabase. No lock-out risk.

> "AI summary hallucinated a diagnosis I don't have. Freaked me out. The summary said 'consistent with lupus' based on my ANA pattern but my rheum ruled lupus out."
Source: App Store review iOS Nov 2024
Lanae relevance: CRITICAL. LLM-generated summaries need guardrails. This is why our 9-section compaction preserves user messages verbatim.

---

## WISHES (8)

> "Wish I could share a single timeline link with a doctor that expires after 24 hours."
Source: Reddit r/POTS Jun 2024
Lanae relevance: Doctor share link is a clear gap.

> "Wish the family tree synced with 23andMe so I didn't have to type relatives by hand."
Source: App Store review iOS Mar 2024
Lanae relevance: Out of scope but noted.

> "Wish it integrated with Epic MyChart directly via SMART on FHIR."
Source: Product Hunt thread Nov 2023
Lanae relevance: Lanae has AdventHealth MyChart. FHIR import is in our roadmap.

> "Wish it could flag when labs are trending toward abnormal before they cross the threshold."
Source: Reddit r/endometriosis Aug 2024
Lanae relevance: Predictive flags for labs. Our Intelligence engine could do this.

> "Wish symptom log had photo upload for rashes and hives."
Source: Reddit r/ChronicIllness Jul 2024
Lanae relevance: We have documents but not inline photo on symptom log.

> "Wish it did not require a phone. Web version missing on free tier."
Source: Product Hunt comment Sep 2024
Lanae relevance: We are web-first already.

> "Wish it had pregnancy tracking that handled my POTS meds safely."
Source: Reddit r/POTS Aug 2024
Lanae relevance: Out of scope for Lanae today but worth noting for cycle engine future.

> "Wish the doctor prep sheet was editable in real time during the visit, like a shared doc."
Source: Reddit r/ChronicIllness Oct 2024
Lanae relevance: Mid-visit edit mode. Interesting UX direction.

---

## Summary of signal

Strongest praise: multi-specialist timeline, multi-year lab trends, doctor prep, voice symptom notes, family history tree, second-opinion PDF assembly, insurance denial workflow, HIPAA BAA posture.

Strongest pain: aggressive paywall, parsing failures, LLM hallucination on clinical summaries, lock-out on lapsed subscription, no FHIR integration, network view overload.

Patterns most relevant to Lanae: multi-specialist timeline (we have appointments + active_problems), multi-year lab trends (we have lab_results), doctor prep (we have /doctor), second-opinion assembly (new), family history tree (new), voice symptom capture (new), condition network (new), insurance denial tracker (new).
