/*
 * Articles: Cycle health
 *
 * What separates a healthy cycle from one that needs a closer look:
 * anovulatory cycles, irregular cycles, and the changes worth a doctor
 * visit. NC voice. Every clinical claim sourced.
 */
import type { LearnArticle } from '../types'

export const ANOVULATORY_CYCLES: LearnArticle = {
  slug: 'anovulatory-cycles-what-they-are',
  category: 'cycle-health',
  title: 'Anovulatory cycles: what they are and when to worry',
  subhead: 'A cycle without ovulation is more common than most people think.',
  readingMinutes: 5,
  body: [
    {
      kind: 'p',
      text: 'An anovulatory cycle is one where the ovaries do not release an egg. The bleeding can still arrive, sometimes on time, sometimes late, sometimes heavier than usual. From the outside, the cycle can look ordinary. The biology underneath is doing something different.',
    },
    {
      kind: 'p',
      text: 'In a typical cycle, estrogen builds the uterine lining, ovulation happens, and progesterone takes over. In an anovulatory cycle, no egg is released, so no progesterone rise follows. Estrogen keeps building the lining unopposed until the lining outgrows its blood supply and breaks down on its own [ACOG].',
    },
    { kind: 'h2', text: 'Why ovulation can skip a cycle' },
    {
      kind: 'p',
      text: 'Occasional anovulation is normal at the bookends of the reproductive years. Roughly half of cycles in the first year after menarche are anovulatory, and anovulation becomes common again in perimenopause [OWH].',
    },
    {
      kind: 'p',
      text: 'Outside those windows, common drivers in adults include polycystic ovary syndrome, thyroid disorders, high prolactin, low body weight or rapid weight loss, heavy training loads, severe stress, and disordered eating. Anovulatory cycles are the most common pattern in PCOS [Mayo Clinic].',
    },
    { kind: 'h2', text: 'How to spot one' },
    {
      kind: 'p',
      text: 'Anovulatory cycles often share a few quiet signals. None is a definite tell on its own; together, a pattern emerges:',
    },
    {
      kind: 'ul',
      items: [
        'Cycle length that drifts longer than usual, or a missed period that returns weeks later.',
        'No clear basal body temperature shift across the cycle, so the BBT chart stays flat.',
        'Heavier or longer bleeding than your usual period, sometimes with larger clots.',
        'Mid-cycle spotting that recurs.',
        'A negative LH surge across the days you would expect to ovulate.',
        'A mid-luteal progesterone draw that comes back low.',
      ],
    },
    { kind: 'h2', text: 'When one cycle is okay, and when a pattern is not' },
    {
      kind: 'p',
      text: 'A single anovulatory cycle after stress, illness, travel, or a sleep loss stretch is rarely a concern. The body usually self-corrects within one or two cycles. What deserves a clinician\'s attention is a pattern: anovulation that repeats across two or three cycles, or anovulatory cycles paired with other symptoms like acne, hair changes, weight changes, or fatigue [ACOG].',
    },
    {
      kind: 'callout',
      tone: 'caution',
      title: 'Worth a call',
      text: 'Three or more cycles in a row that look anovulatory. Anovulatory cycles paired with new acne, scalp hair thinning, or facial hair growth. No period for 90 days or more outside of pregnancy or breastfeeding.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'If your BBT chart stays flat across a cycle and there is no progesterone rise to be seen, your cycle page may flag the cycle as likely anovulatory. One flat chart is not a verdict. A run of them is the conversation to bring to a doctor.',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Abnormal Uterine Bleeding',
      url: 'https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'OWH',
      title: 'Period problems',
      url: 'https://www.womenshealth.gov/menstrual-cycle/period-problems',
      publisher: 'Office on Women\'s Health',
    },
    {
      label: 'Mayo Clinic',
      title: 'Polycystic ovary syndrome (PCOS)',
      url: 'https://www.mayoclinic.org/diseases-conditions/pcos/symptoms-causes/syc-20353439',
      publisher: 'Mayo Clinic',
    },
  ],
  related: [
    'irregular-cycles-causes-and-when-to-seek-help',
    'cycle-changes-that-warrant-a-doctor-visit',
    'pcos-signs-and-what-to-do',
  ],
}

export const IRREGULAR_CYCLES: LearnArticle = {
  slug: 'irregular-cycles-causes-and-when-to-seek-help',
  category: 'cycle-health',
  title: 'Irregular cycles: causes and when to seek help',
  subhead: 'Variation is normal. Persistent unpredictability is a signal.',
  readingMinutes: 6,
  body: [
    {
      kind: 'p',
      text: 'A cycle is called irregular when its length varies by more than seven to nine days from one cycle to the next, when it falls outside the typical 21 to 35 day range, or when it skips entirely. One off cycle does not make a pattern; a string of them often does [ACOG].',
    },
    { kind: 'h2', text: 'Common causes worth knowing' },
    {
      kind: 'p',
      text: 'Most irregular cycles in adults trace back to a recognizable cause. The list runs from everyday and reversible to clinical and worth a workup.',
    },
    {
      kind: 'ul',
      items: [
        'Stress and sleep loss. Cortisol shifts can suppress the brain signals that drive ovulation.',
        'Big training loads or rapid weight change. Both can push the hypothalamus into a quieter signaling pattern.',
        'Polycystic ovary syndrome (PCOS). The most common hormonal cause of irregular cycles in adults.',
        'Thyroid disorders. Both low and high thyroid function can lengthen, shorten, or skip cycles.',
        'High prolactin. Often medication-related, sometimes from a small benign pituitary tumor.',
        'Perimenopause. Cycles often shorten first, then lengthen and skip in the years before menopause.',
        'Hormonal contraception transitions. Restarting cycles after stopping the pill, IUD, or injection can take several months.',
        'Recent pregnancy or breastfeeding. Cycles can take months to settle into a stable pattern after either.',
      ],
    },
    {
      kind: 'p',
      text: 'Less common but worth a clinician\'s attention: primary ovarian insufficiency, congenital adrenal hyperplasia (a treatable cause that can mimic PCOS), pituitary disorders, and chronic illnesses that affect overall energy balance [Mayo Clinic].',
    },
    { kind: 'h2', text: 'What to bring to a clinician' },
    {
      kind: 'ul',
      items: [
        'Your last six cycle lengths, in order.',
        'When (in life or recent months) the irregularity started.',
        'Any other recent changes: weight, sleep, training, stress, medications.',
        'Other symptoms worth mentioning: acne, hair changes, hot flashes, fatigue, mood, weight.',
        'Whether you are trying to conceive, avoiding pregnancy, or neither.',
      ],
    },
    { kind: 'h2', text: 'When the workup usually starts' },
    {
      kind: 'p',
      text: 'Most clinicians evaluate irregular cycles when the pattern has held for two or more consecutive months in adults, or sooner if other symptoms point to a specific condition. The first round of labs typically includes a thyroid panel, prolactin, and (when PCOS is on the table) testosterone, DHEA-S, and 17-hydroxyprogesterone [ACOG].',
    },
    {
      kind: 'callout',
      tone: 'caution',
      title: 'Sooner-rather-than-later',
      text: 'No period for 90 days or more outside of pregnancy or breastfeeding. Cycles consistently shorter than 21 days. Heavy bleeding with the irregular cycles. Persistent pain.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'The cycle page keeps your last several cycle lengths in one view. A glance there before a visit gives your doctor the pattern in one image, which is far more useful than trying to recall it from memory.',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Abnormal Uterine Bleeding',
      url: 'https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'Mayo Clinic',
      title: 'Menstrual cycle: What is normal, what is not',
      url: 'https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/menstrual-cycle/art-20047186',
      publisher: 'Mayo Clinic',
    },
  ],
  related: [
    'anovulatory-cycles-what-they-are',
    'cycle-changes-that-warrant-a-doctor-visit',
    'pcos-signs-and-what-to-do',
  ],
}

export const CYCLE_CHANGES_WARRANT_VISIT: LearnArticle = {
  slug: 'cycle-changes-that-warrant-a-doctor-visit',
  category: 'cycle-health',
  title: 'Cycle changes that warrant a doctor visit',
  subhead: 'A short, practical list for the in-between visits.',
  readingMinutes: 5,
  body: [
    {
      kind: 'p',
      text: 'Most people see a clinician for cycle issues somewhere between "I think this might be a problem" and "this has been going on too long." Knowing which changes are worth a same-week call, a same-month appointment, or a same-day visit makes it easier to act without hesitating.',
    },
    { kind: 'h2', text: 'Same-day care' },
    {
      kind: 'ul',
      items: [
        'Sudden, severe pelvic pain, especially one-sided, with fainting, fever, or vomiting. Possible causes include ovarian torsion, ruptured cyst, ectopic pregnancy, or pelvic inflammatory disease.',
        'Bleeding heavy enough to soak through two full pads back to back in two hours.',
        'Fainting with a period or with bleeding.',
        'Severe pain with a known or possible pregnancy.',
      ],
    },
    {
      kind: 'p',
      text: 'These are emergency symptoms and warrant urgent care or the emergency department [ACOG].',
    },
    { kind: 'h2', text: 'Same-week call' },
    {
      kind: 'ul',
      items: [
        'A sudden change in your usual flow pattern that lasts two cycles in a row.',
        'Soaking through one or more pads or tampons every hour for several hours.',
        'Periods that last longer than seven days.',
        'Bleeding between periods or after sex.',
        'Pain that does not respond to over-the-counter NSAIDs taken on schedule, or that keeps you from your usual day.',
        'No period for 90 days or more, outside pregnancy or breastfeeding.',
      ],
    },
    {
      kind: 'p',
      text: 'These features make conditions like fibroids, polyps, endometriosis, adenomyosis, anovulation, and bleeding disorders more likely. Most are treatable; few are urgent in the same-day sense, but they should not be left to drift [Mayo Clinic].',
    },
    { kind: 'h2', text: 'Same-month appointment' },
    {
      kind: 'ul',
      items: [
        'Cycles that have drifted shorter or longer than your usual for two or more consecutive months.',
        'A swing of more than 7 to 9 days between cycle lengths in adults.',
        'Premenstrual symptoms that have intensified or now last more than a week before your period.',
        'New cyclical mood changes, especially if they affect work, relationships, or daily function.',
        'Other symptoms clustering around your cycle: migraine, joint flares, GI changes, autonomic symptoms, fatigue.',
      ],
    },
    {
      kind: 'p',
      text: 'These are pattern changes. They benefit from a clinical conversation but rarely need urgent action. Bringing 3 to 6 cycles of tracker data makes the visit more efficient [ACOG].',
    },
    { kind: 'h2', text: 'Worth mentioning at any visit' },
    {
      kind: 'ul',
      items: [
        'Family history of endometriosis, PCOS, fibroids, breast cancer, or ovarian cancer that has not been documented in your chart.',
        'Cycle changes that started after a new medication, vaccine, or major life event.',
        'Quality-of-life symptoms that you have stopped naming, like fatigue or pain you have learned to work around.',
      ],
    },
    {
      kind: 'callout',
      tone: 'info',
      title: 'A useful framing',
      text: 'You are not asking permission to be heard. You are bringing a pattern, naming the change, and asking what your clinician would want to rule out. That framing leads to better workups.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'The cycle page already organizes the data your clinician will ask about. Bringing it on screen, or printed, beats reciting from memory and shifts the visit from "I think it has been weird" to "here is the pattern."',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Abnormal Uterine Bleeding',
      url: 'https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'Mayo Clinic',
      title: 'Menstrual cycle: What is normal, what is not',
      url: 'https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/menstrual-cycle/art-20047186',
      publisher: 'Mayo Clinic',
    },
  ],
  related: [
    'anovulatory-cycles-what-they-are',
    'irregular-cycles-causes-and-when-to-seek-help',
    'period-pain-normal-vs-see-your-doctor',
  ],
}

export const CYCLE_HEALTH_ARTICLES = [
  ANOVULATORY_CYCLES,
  IRREGULAR_CYCLES,
  CYCLE_CHANGES_WARRANT_VISIT,
]
