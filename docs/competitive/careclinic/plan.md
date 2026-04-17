# CareClinic - Implementation Plan

Ranked table of features to add to LanaeHealth. Ranking formula: `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8. Top 3 go to `implementation-notes.md`.

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Depends on | Notes |
|------|---------|----------------|--------------------|--------------------|------------|-------|
| 1 | Cover-page-first clinical PDF with per-section toggles | Pattern 1 | 5 | M | Existing `clinical-report.ts` | Doctor-visit prep is core. Rebuild PDF to open with a 1-page cover (patient ID, diagnoses, meds, allergies, reporting period, date). Add section toggles in the export modal so specialist-filtered PDFs are possible. Ranking: (5*2)/2 = 5.0 |
| 2 | Care Card (printable 1-page emergency summary + QR share) | Pattern 3 | 5 | M | Existing ExecutiveSummary + new `/api/share/` | POTS + multiple allergies make Lanae an ER-risk patient. Wallet-size card with QR that opens an expiring signed web view. Ranking: (5*2)/2 = 5.0 |
| 3 | Condition-tagging for symptoms + condition-filtered views | Pattern 2 | 5 | M | Additive migration for `symptom_conditions` junction | Extends our existing SpecialistToggle to actual data. Unblocks condition-filtered timeline (#6) and condition-filtered PDF (already in #1). Ranking: (5*2)/2 = 5.0 |
| 4 | Medication effectiveness-per-dose rating + side-effects | Pattern 4 + 7 | 4 | M | `medication-adherence.ts` | Non-blocking 2-second prompt after dose confirm. Controlled vocabulary for side effects. Ranking: (4*2)/2 = 4.0 |
| 5 | Orthostatic vitals module (lying/sitting/standing BP+HR with POTS flag) | Pattern 8 | 4 | M | `vitals-classification.ts` | Directly actionable for Cardio Aug 17. Ranking: (4*2)/2 = 4.0 |
| 6 | Per-appointment prep + post-visit notes unified on appointment row | Pattern 5 | 4 | M | Existing `appointments` table (additive `appointment_notes` sibling table since appointments is read-only) | We already have `/doctor/post-visit/`; this unifies prep + post. Ranking: (4*2)/2 = 4.0 |
| 7 | Condition-filtered timeline view | Pattern 6 | 4 | L | Depends on #3 (condition tags) | Wait until #3 ships. Ranking: (4*2)/4 = 2.0 |
| 8 | Morning/evening short check-in mode with push reminders | Pattern 9 | 3 | S | Existing Log UI + push API | Mostly UI polish. Ranking: (3*2)/1 = 6.0 but low absolute impact. |
| 9 | Side-effects controlled vocabulary (reference table + API) | Pattern 7 | 4 | S | Lookup table + simple API | Bundle with #4. Ranking: (4*2)/1 = 8.0 (but only valuable if #4 ships). |
| 10 | Photo medication import (OCR) | Pattern 10 | 2 | L | External OCR vendor | Skip for now, myAH already populates meds. Ranking: (2*2)/4 = 1.0 |
| 11 | Caregiver read-only mode | Pattern 11 | 2 | XL | Access control infra | Out of scope. Ranking: (2*2)/8 = 0.5 |

## Top 3 (to implementation-notes.md)

Using composite score weighted by absolute Lanae impact AND doctor-visit prep relevance (the core use case for this app):

1. **Cover-page-first clinical PDF with per-section toggles** (enhances the reason LanaeHealth exists)
2. **Care Card (1-page emergency summary + expiring QR share)** (safety-critical for a POTS + allergies patient)
3. **Condition-tagging for symptoms + condition-filtered views** (foundation for specialist-specific reports)

#8 (morning/evening check-in) has the best raw ratio but is mostly polish on existing Log UI; the top 3 above deliver substantially higher clinical value to Lanae for the upcoming specialist appointments.

## Deferred

- Effectiveness-per-dose + side-effects controlled vocab (#4 + #9): bundle together, schedule after the top 3.
- Orthostatic vitals module (#5): separately tracked as a Cardio-prep feature, high value for Aug 17 visit.
- Per-appointment prep + post-visit (#6): partially in progress (`/doctor/post-visit/` exists), close the loop in a follow-on task.
