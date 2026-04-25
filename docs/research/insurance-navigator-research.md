# Insurance Navigator Research

Source notes for the v0 insurance navigator. Every factual claim about HMSA QUEST Integration in the v2 navigator code references one of these citations by number in a code comment.

## Why this exists

User direction: "we need a system to understand insurance and how to work with insurance, the best strategies how not to be gaslit. You can find a lot of stuff like this on bearable on their website. Renee right now is on HMSA Quest on Oahu, Hawaii. Users need to be able to navigate their insurances. We need to have a page for every insurance in the book. Specifically, people need to know what the PCP really is. How they're just someone to refer you places, and more. How to run the system and navigate the doctor world."

The v0 deliverable is a hub plus four content surfaces:

1. `/v2/insurance` hub
2. `/v2/insurance/setup` first-run picker
3. `/v2/insurance/hmsa-quest` Lanae's plan baseline
4. `/v2/insurance/pcp-explainer` what a PCP actually does
5. `/v2/insurance/strategies` anti-gaslighting + advocacy

The structure is designed to add other insurance plans as `/v2/insurance/<slug>` without redesign.

## Sources cited in code

### S1. HMSA QUEST Integration overview

URL: https://hmsa.com/health-plans/quest/
Captured: 2026-04-24 via firecrawl

HMSA QUEST is HMSA's Medicaid managed care plan covering Hawaii residents who qualify for Medicaid. Network includes a large pool of Hawaii physicians, comprehensive services, and exclusive benefits. Member services number for Oahu: 948-6486 (referenced in S2). Provider directory is searchable at hmsa.com/search/providers/.

### S2. HMSA QUEST Referrals

URL: https://prc.hmsa.com/s/article/QUEST-Integration-Referrals-1
Captured: 2026-04-24 via firecrawl (with --wait-for 5000)

Verbatim relevant policy text:

> PCPs must manage their patients' care including making referrals to specialists. A PCP referral is required for most services provided by specialists. PCPs and specialists should keep records of referrals in patient records.
>
> Referrals for specialty care should be made to providers in HMSA's QUEST Integration network. If referral to a provider outside the HMSA QUEST Integration network is necessary, prior authorization (precertification) must first be obtained.

Phone: QUEST Integration Provider Service at 948-6486 on Oahu, toll-free 1 (800) 440-0640 from neighbor islands.

> Emergency care does not require PCP referral, even if the services are performed by a non-participating provider.

### S3. HMSA QUEST Member Grievances and Appeals

URL: https://hmsa.com/help-center/quest-integration-member-grievances-and-appeals/
Captured: 2026-04-24 via firecrawl

Key timing facts:

- Grievances: no time limit to submit. HMSA acknowledges receipt within 5 business days. Decision within 30 calendar days.
- Standard appeals: must file within 60 days of the action. Appeals called in must be followed by a written, signed request.
- Expedited appeals: must file within 60 calendar days of denial letter. Oral request alone is sufficient.
- A medical director (not the original decision-maker) reviews any appeal involving clinical issues, lack of medical necessity, or partial approvals.

If unhappy with HMSA's grievance decision, members can request a state-level review from the DHS Med-QUEST Division at 808-692-8094 on Oahu. Hearing-impaired TTY: 1-877-447-5990.

The grievance must include name, address, phone, HMSA membership number, date of grievance, account of facts, and copies of related records.

### S4. HMSA QUEST Benefit Listing (covered services)

URL: https://medquest.hawaii.gov/content/medquest/en/members-applicants/quest-integration-coverage/medical-benefits.html
Captured: 2026-04-24 via firecrawl

Covered "Primary and Acute Care Services" relevant to chronic illness workup:

- Diagnostic tests: laboratory, imaging, "or other diagnostic tests" (this language covers tilt-table testing, autonomic testing, gynecological imaging when medically necessary)
- Outpatient hospital procedures including sleep laboratory services
- Outpatient medical visits including nutrition counseling, podiatry, vision, hearing
- Prescription drugs
- Rehabilitation services (inpatient and outpatient) including cognitive rehab
- Behavioral health: outpatient mental health, medication management, psychiatric evaluation, substance abuse treatment

Note: do NOT reproduce the QUEST formulary in the app per copyright. Link out to https://prc.hmsa.com/s/article/HMSA-s-QUEST-Drug-Formulary instead.

### S5. HMSA Telehealth coverage

URL: https://hmsa.com/well-being/telehealth/
Captured: 2026-04-24 via firecrawl

> A telehealth visit costs about the same or less than a doctor's office visit. Telehealth services are a benefit of most HMSA plans. You may be charged a copayment, so check your plan benefits.

HMSA's Online Care offers 24/7 access to Hawaii-licensed providers via video. Telehealth covers general health (allergies, cold/flu, sore throat), behavioral health (psychotherapy, family counseling), dermatology, and nutrition counseling.

### S6. HMSA QUEST Quick Reference Guide

URL: https://prc.hmsa.com/s/article/QUEST-Integration-Quick-Reference-Guide
Captured: 2026-04-24 via firecrawl (with --wait-for 5000)

Provider services tasks: ask HMSA to reconsider a claim, verify benefits, register a referral, authorize an agent.

### S7. HMSA Appeals & Grievances landing

URL: https://hmsa.com/help-center/appeals-grievances/
Captured: 2026-04-24 via firecrawl

Includes link to "Request for Insurance Commissioner External Review" (https://hmsa.com/help-center/request-for-ic-external-review/) which is the second-level escalation if HMSA's internal appeal denies the claim. This is independent third-party review.

### S8. POTS Patient Support: Navigating Medical Gaslighting

URL: https://www.pots.support/how-to-navigate-medical-gaslighting
Captured: 2026-04-24 via firecrawl
Author cited: Dr. Melissa Geraghty, Psy.D., Clinical Health Psychologist

Six action items they list:

1. Change providers if possible.
2. Bring an advocate to appointments.
3. Keep a written record of what occurred in appointments.
4. Talk to a trusted friend or therapist about experiences.
5. When a provider refuses a test, ask for the reason to be noted in your chart.
6. Practice assertive replies.

13 specific assertive responses they list (sample, not all reproduced):

- "I know my body very well and something is definitely wrong."
- "Can you please document why you are refusing to order more testing."
- "I see that you have a different perspective than me. I'm not imagining things."
- "My experience is valid."

### S9. NormaLyte: How to Avoid Medical Gaslighting (POTS edition)

URL: https://normalyte.com/blogs/news/avoid-medical-gaslighting
Captured: 2026-04-24 via firecrawl

Confirms the "ask for the test by name" strategy and the value of bringing typed symptom logs to appointments.

### S10. Bearable Chronic Illness Tracker

URL: https://bearable.app/chronic-illness-symptom-tracker-app/
Captured: 2026-04-24 via firecrawl

Bearable's pitch: track symptoms, identify triggers, and "go prepared to chronic illness appointments." Their symptom report features: frequency and severity, impact of lifestyle changes, treatment response, dates and times of changes. We do not copy their voice or content; we mirror the structural insight that a written symptom log shifts the visit dynamic.

### S11. Dysautonomia International (advocacy resource link only)

URL: https://www.dysautonomiainternational.org
We link out to it from `/v2/insurance/strategies` as a condition-specific advocacy resource. Lanae has POTS-like presentation (per her health profile), so this is directly applicable. We do not republish their content.

## Bearable approach summary

Bearable's content model is task-oriented, not condition-oriented. Their core value prop is "track triggers, find correlations, share at appointments." We borrow the structural pattern (symptom data + appointment-ready output) but the navigator content is original. Every advocacy/strategy paragraph we write is paraphrased from sources S8 and S9 with our own NC voice (gentle, never aggressive).

## What we deliberately do NOT include in v0

- Verbatim formulary content (S4) - link out only
- Other insurance plans (Kaiser, Aloha Care, Ohana Health Plan, AlohaCare, plus mainland plans) - extensible structure ready, content TBD
- AI-powered Q&A about insurance - PR backlog
- Doctor-mode talking-points integration - documented as follow-up only
