/*
 * Articles: Chronic illness + cycle (Lanae-relevant)
 *
 * POTS, migraine, and the EDS-MCAS overlap. Each article cites
 * condition-specific advocacy bodies and peer-reviewed literature
 * because the cycle interaction with chronic illness is under-studied
 * and under-acknowledged in mainstream OB guidance.
 */
import type { LearnArticle } from '../types'

export const POTS_AND_CYCLE: LearnArticle = {
  slug: 'pots-and-your-cycle',
  category: 'chronic-illness-cycle',
  title: 'POTS and your cycle: hormones affect autonomic function',
  subhead: 'Symptom flares around your period are not in your head. They are in your hormones.',
  readingMinutes: 7,
  body: [
    {
      kind: 'p',
      text: 'Postural orthostatic tachycardia syndrome (POTS) is a form of dysautonomia: the autonomic nervous system, which controls heart rate, blood pressure, and blood vessel tone, does not respond properly to standing. The diagnostic feature in adults is a sustained heart rate increase of 30 or more beats per minute within 10 minutes of standing (40 or more in adolescents), in the absence of orthostatic hypotension, with chronic symptoms [Dysautonomia International].',
    },
    {
      kind: 'p',
      text: 'Roughly 80 to 85 percent of POTS patients are people who menstruate, with onset commonly in adolescence or young adulthood. The female predominance and the timing of onset have led researchers to look closely at the relationship between cycle hormones and autonomic function [PMC].',
    },
    { kind: 'h2', text: 'Why the cycle and POTS interact' },
    {
      kind: 'p',
      text: 'Estrogen and progesterone both influence the autonomic nervous system. Estrogen tends to support vasodilation and modulates norepinephrine signaling. Progesterone shifts blood volume, fluid balance, and vascular tone. The pre-menstrual hormone drop coincides with the worst-symptom window for many POTS patients [PMC].',
    },
    {
      kind: 'p',
      text: 'In a 2023 patient-reported survey of POTS symptom severity across the cycle, the late-luteal week and the menstrual phase consistently scored as the worst windows, with reports of higher heart rates, more presyncope, more brain fog, and more fatigue. The follicular phase tended to be the most symptom-light [Symptom Severity Survey].',
    },
    { kind: 'h2', text: 'What POTS-cycle flares typically look like' },
    {
      kind: 'ul',
      items: [
        'Higher resting and standing heart rates in the days before and during the period.',
        'More presyncope (lightheadedness, vision changes on standing) in the late luteal and menstrual phases.',
        'Heavier blood loss during the period worsening hypovolemia and tachycardia.',
        'Worse heat intolerance in the luteal phase, when progesterone has already raised baseline temperature.',
        'Migraine, GI symptoms, and brain fog clustering with the cycle dip.',
      ],
    },
    {
      kind: 'p',
      text: 'Heavy menstrual bleeding is also more common in POTS patients than in the general population, partly because of comorbid bleeding disorders and partly because some POTS treatments (like NSAIDs and SSRIs) can affect bleeding. Heavier flow worsens the volume status that POTS already struggles with [Dysautonomia International].',
    },
    { kind: 'h2', text: 'What clinicians can do' },
    {
      kind: 'p',
      text: 'POTS-cycle care is still under-researched, but a few approaches are being discussed in the dysautonomia community and in published case series:',
    },
    {
      kind: 'ul',
      items: [
        'Cycle-anchored fluid and electrolyte planning, with a higher target through the late luteal and menstrual days.',
        'Hormonal contraception trials (continuous combined hormonal contraception or progestin-only options) to flatten the hormone-driven symptom swings. Response is variable; some patients improve, others worsen.',
        'Treatment of heavy menstrual bleeding (tranexamic acid, hormonal options, evaluation for bleeding disorders).',
        'Iron repletion when ferritin is low, which is common with POTS and heavy periods.',
        'Avoiding cycle-induced deconditioning by adjusting (not abandoning) the standard exercise program through symptom-heavy days.',
      ],
    },
    {
      kind: 'callout',
      tone: 'info',
      title: 'A useful framing',
      text: 'POTS-cycle flares are real, well-documented in the patient community, and increasingly in the literature. If a clinician dismisses the cycle pattern, bringing prospective tracking and the published evidence is reasonable. Dysautonomia International maintains a clinician-facing summary worth sharing.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'Cycle-tagged orthostatic tests and Oura sleep, alongside symptom logs, are the picture a POTS-aware clinician will most want to see. If your worst orthostatic readings cluster in the late luteal and menstrual days, the pattern itself is the case for cycle-aware care.',
    },
  ],
  citations: [
    {
      label: 'Dysautonomia International',
      title: 'Postural Orthostatic Tachycardia Syndrome',
      url: 'http://www.dysautonomiainternational.org/page.php?ID=30',
      publisher: 'Dysautonomia International',
    },
    {
      label: 'PMC',
      title: 'Postural Orthostatic Tachycardia Syndrome, Menopause and Hormones',
      url: 'https://www.mdpi.com/2077-0383/15/4/1477',
      publisher: 'Journal of Clinical Medicine, MDPI',
    },
    {
      label: 'Symptom Severity Survey',
      title: 'Differences in Symptom Severity Reported by POTS Patients Across the Menstrual Cycle',
      url: 'https://www.journalmyhealth.com/wp-content/uploads/2023/06/POTS-White-Paper-2023.pdf',
      publisher: 'Patient-reported survey, 2023',
    },
  ],
  related: [
    'migraine-and-the-menstrual-cycle',
    'eds-mcas-and-cycle-hormones',
    'cycle-changes-that-warrant-a-doctor-visit',
  ],
}

export const MIGRAINE_AND_CYCLE: LearnArticle = {
  slug: 'migraine-and-the-menstrual-cycle',
  category: 'chronic-illness-cycle',
  title: 'Migraine and the menstrual cycle: estrogen withdrawal',
  subhead: 'A specific subtype with a specific trigger, and specific treatments.',
  readingMinutes: 6,
  body: [
    {
      kind: 'p',
      text: 'Roughly 60 percent of women with migraine notice a connection between their attacks and their cycle. The most common pattern is migraine that arrives in a window from two days before the period to three days after it starts. When attacks fall in that window, the migraine is called menstrually-related migraine. When attacks fall only in that window, the diagnosis is pure menstrual migraine [Migraine Trust].',
    },
    {
      kind: 'p',
      text: 'The trigger is the rapid drop in estrogen that happens at the end of the luteal phase as the corpus luteum dies. The mechanism appears to involve estrogen withdrawal effects on serotonin, on brain blood vessel reactivity, and on the trigeminal nervous system. Estrogen drops also happen in the pill-free week of combined oral contraception, the postpartum period, and perimenopause, all of which can trigger or worsen migraine [American Migraine Foundation].',
    },
    { kind: 'h2', text: 'How menstrual migraine differs from other migraine' },
    {
      kind: 'ul',
      items: [
        'Often longer in duration than the patient\'s usual attacks.',
        'Often more severe, more disabling, and harder to abort with standard treatment.',
        'More likely to recur after initial treatment within 24 hours.',
        'Less likely to be accompanied by aura, even in patients who get aura at other times.',
        'Predictable enough that pre-emptive treatment becomes feasible.',
      ],
    },
    { kind: 'h2', text: 'How clinicians prevent and treat it' },
    {
      kind: 'p',
      text: 'Treatment runs in two layers: aborting individual attacks, and preventing the predictable cluster around the period.',
    },
    {
      kind: 'h3',
      text: 'Acute treatment',
    },
    {
      kind: 'ul',
      items: [
        'Triptans, with frovatriptan and naratriptan having the longest half-lives and lowest 24-hour recurrence rates for menstrual attacks.',
        'NSAIDs (naproxen, ibuprofen) used early and on schedule.',
        'Anti-nausea medications when nausea is part of the picture.',
        'Newer gepants and ditans (rimegepant, ubrogepant, lasmiditan) for patients who cannot use triptans.',
      ],
    },
    {
      kind: 'h3',
      text: 'Pre-emptive (mini-prophylaxis)',
    },
    {
      kind: 'p',
      text: 'For patients with predictable menstrual attacks, "mini-prophylaxis" means starting a short course of preventive medication two days before the expected attack window and continuing for about a week. Evidence supports frovatriptan, naratriptan, and naproxen for this indication [American Headache Society].',
    },
    {
      kind: 'h3',
      text: 'Hormonal strategies',
    },
    {
      kind: 'ul',
      items: [
        'Continuous combined hormonal contraception (skipping the placebo week) to flatten the estrogen drop.',
        'Estrogen supplementation across the placebo week with combined hormonal contraceptives (a transdermal estradiol patch, for example).',
        'Progestin-only options for patients with aura or other contraindications to estrogen.',
      ],
    },
    {
      kind: 'callout',
      tone: 'caution',
      title: 'Aura matters for contraception choice',
      text: 'Migraine with aura is associated with a higher baseline stroke risk, and combined hormonal contraception adds to that risk. ACOG and the American Migraine Foundation generally advise against estrogen-containing contraception for people with migraine with aura. Progestin-only options are usually preferred.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'A migraine that lands in the same cycle window across two or three months is the pattern that opens the door to mini-prophylaxis and hormonal strategies. Cycle-tagged migraine logs make that conversation faster and more specific.',
    },
  ],
  citations: [
    {
      label: 'Migraine Trust',
      title: 'Menstrual migraine',
      url: 'https://migrainetrust.org/understand-migraine/types-of-migraine/menstrual-migraine/',
      publisher: 'The Migraine Trust',
    },
    {
      label: 'American Migraine Foundation',
      title: 'Menstrual Migraine Treatment and Prevention',
      url: 'https://americanmigrainefoundation.org/resource-library/menstrual-migraine-treatment-and-prevention/',
      publisher: 'American Migraine Foundation',
    },
    {
      label: 'American Headache Society',
      title: 'Hormonal and Menstrual Migraine: Symptoms and Treatment',
      url: 'https://americanmigrainefoundation.org/resource-library/hormonal-menstrual-migraine/',
      publisher: 'American Headache Society',
    },
  ],
  related: [
    'pots-and-your-cycle',
    'eds-mcas-and-cycle-hormones',
    'cycle-changes-that-warrant-a-doctor-visit',
  ],
}

export const EDS_MCAS_AND_CYCLE: LearnArticle = {
  slug: 'eds-mcas-and-cycle-hormones',
  category: 'chronic-illness-cycle',
  title: 'EDS, MCAS, and cycle hormones: the trifecta',
  subhead: 'How a connective tissue disorder, mast cells, and the cycle reinforce each other.',
  readingMinutes: 7,
  body: [
    {
      kind: 'p',
      text: 'Hypermobile Ehlers-Danlos syndrome (hEDS) and the broader hypermobility spectrum disorders (HSD) involve a connective tissue that is more elastic and less stable than typical. Mast cell activation syndrome (MCAS) involves mast cells (immune cells) that release histamine and other mediators inappropriately or excessively. POTS often runs in the same patient. The three conditions cluster together so often that the overlap has its own informal name in the patient and clinician community: the "trifecta" [EDS Society].',
    },
    {
      kind: 'p',
      text: 'The cycle interacts with all three. Estrogen and progesterone affect connective tissue laxity, mast cell stability, and autonomic tone. The result is symptoms that wax and wane with the cycle in a way that ordinary OB care does not always address.',
    },
    { kind: 'h2', text: 'How the cycle touches each condition' },
    {
      kind: 'h3',
      text: 'EDS and joint laxity',
    },
    {
      kind: 'p',
      text: 'Connective tissue is more lax in the second half of the cycle, especially around ovulation and again in the late luteal week. People with hEDS often notice more joint subluxations, more pain, and more clumsiness in those windows. The pattern is reproducible enough that anchoring physical therapy and exercise progression to the cycle calendar can reduce flare frequency [EDS Society].',
    },
    {
      kind: 'h3',
      text: 'MCAS and histamine',
    },
    {
      kind: 'p',
      text: 'Estrogen primes mast cells. Mast cells, in turn, have estrogen receptors. The pre-menstrual estrogen drop and the ovulatory estrogen peak are both windows when MCAS symptoms (flushing, hives, GI symptoms, headaches, anaphylaxis episodes) tend to flare. Histamine intolerance complaints often follow the same pattern [EDS Society].',
    },
    {
      kind: 'h3',
      text: 'POTS and autonomic strain',
    },
    {
      kind: 'p',
      text: 'POTS in this population responds to the cycle the same way it does in POTS-only patients: late-luteal and menstrual flares, follicular relief. The added wrinkle in the trifecta is that MCAS flares can drop blood pressure and worsen tachycardia, and joint instability can drive pain that contributes to autonomic strain. The conditions reinforce each other in a way that can feel like one big monthly episode [PMC].',
    },
    { kind: 'h2', text: 'What integrated care can look like' },
    {
      kind: 'ul',
      items: [
        'Cycle-tagged symptom logging for each of the three conditions, looking at the overlap not just the conditions individually.',
        'Cycle-anchored fluid, electrolyte, and salt planning for the POTS piece.',
        'Antihistamine timing through the late luteal and menstrual days for the MCAS piece.',
        'Joint-protective adjustments through the high-laxity windows for the EDS piece.',
        'Heavy menstrual bleeding evaluation, since EDS and MCAS both raise the risk of bleeding complications.',
        'Hormonal strategies (continuous combined hormonal contraception, progestin-only options) to flatten the cycle-driven trigger pattern, with careful follow-up because responses are variable.',
      ],
    },
    {
      kind: 'callout',
      tone: 'info',
      title: 'A note on care navigation',
      text: 'Few clinicians treat all three conditions, and even fewer manage them together with the cycle in mind. The EDS Society maintains a clinician directory; the dysautonomia community keeps a separate one. Building a small team (PCP, gynecologist, cardiology or neurology, allergist or immunologist for MCAS) usually works better than searching for a single specialist.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'Tracking joint flares, MCAS symptoms, and orthostatic readings on the same cycle calendar shows the pattern other tracker setups miss. The patterns page is built to surface these overlaps. The cycle-anchored picture is the strongest case for integrated care.',
    },
  ],
  citations: [
    {
      label: 'EDS Society',
      title: 'Mast Cell Disorders in Ehlers-Danlos Syndrome',
      url: 'https://www.ehlers-danlos.com/2017-eds-classification-non-experts/mast-cell-disorders-ehlers-danlos-syndrome-2/',
      publisher: 'The Ehlers-Danlos Society',
    },
    {
      label: 'PMC',
      title: 'Postural Orthostatic Tachycardia Syndrome, Menopause and Hormones',
      url: 'https://www.mdpi.com/2077-0383/15/4/1477',
      publisher: 'Journal of Clinical Medicine, MDPI',
    },
  ],
  related: [
    'pots-and-your-cycle',
    'migraine-and-the-menstrual-cycle',
    'cycle-changes-that-warrant-a-doctor-visit',
  ],
}

export const CHRONIC_ILLNESS_CYCLE_ARTICLES = [
  POTS_AND_CYCLE,
  MIGRAINE_AND_CYCLE,
  EDS_MCAS_AND_CYCLE,
]
