/*
 * Articles: Conditions
 *
 * PCOS, endometriosis, and PMDD vs PMS. Each article is a plain
 * English explainer with diagnostic guidance and a "what to do" close.
 */
import type { LearnArticle } from '../types'

export const PCOS_SIGNS: LearnArticle = {
  slug: 'pcos-signs-and-what-to-do',
  category: 'conditions',
  title: 'Polycystic Ovary Syndrome (PCOS): signs and what to do',
  subhead: 'The most common hormonal disorder of the reproductive years.',
  readingMinutes: 6,
  body: [
    {
      kind: 'p',
      text: 'Polycystic ovary syndrome, or PCOS, affects roughly 6 to 12 percent of people of reproductive age. The name is misleading: not everyone with PCOS has cysts on their ovaries, and not everyone with ovarian cysts has PCOS. The condition is really about a hormonal pattern that disrupts ovulation [ACOG].',
    },
    { kind: 'h2', text: 'How PCOS is diagnosed' },
    {
      kind: 'p',
      text: 'PCOS is diagnosed by the Rotterdam criteria. A clinician makes the diagnosis when at least two of these three are present, and other causes have been ruled out:',
    },
    {
      kind: 'ol',
      items: [
        'Irregular or absent ovulation, which usually shows up as irregular cycles or absent periods.',
        'Clinical or laboratory signs of high androgens, like acne, scalp hair thinning, facial or body hair growth, or elevated testosterone or DHEA-S on labs.',
        'Polycystic-appearing ovaries on ultrasound, meaning many small follicles arranged around the edge.',
      ],
    },
    {
      kind: 'p',
      text: 'Other conditions that can mimic PCOS, including thyroid disorders, high prolactin, congenital adrenal hyperplasia, and Cushing syndrome, need to be ruled out before the diagnosis is final [Mayo Clinic].',
    },
    { kind: 'h2', text: 'Common signs that prompt a workup' },
    {
      kind: 'ul',
      items: [
        'Irregular cycles, especially cycles longer than 35 days or skipped periods.',
        'Anovulatory cycles confirmed by flat BBT or low mid-luteal progesterone.',
        'Acne, especially along the jaw, chin, and upper neck, in adult years.',
        'Scalp hair thinning at the crown, or new hair growth on the face, chest, or abdomen.',
        'Difficulty losing weight, central weight gain, or insulin resistance signs (skin tags, dark velvety patches at the neck or underarms).',
        'Difficulty conceiving after 6 to 12 months of trying.',
      ],
    },
    { kind: 'h2', text: 'Why PCOS is worth treating' },
    {
      kind: 'p',
      text: 'PCOS is more than a cycle issue. The hormonal pattern raises the long-term risk of type 2 diabetes, dyslipidemia, sleep apnea, endometrial hyperplasia (and rarely endometrial cancer), and mood disorders. Most of those risks are modifiable with appropriate care [ACOG].',
    },
    { kind: 'h2', text: 'What treatment usually looks like' },
    {
      kind: 'p',
      text: 'Treatment is tailored to the goals of the moment. The same person often moves between different treatment plans across life:',
    },
    {
      kind: 'ul',
      items: [
        'Cycle regulation when not trying to conceive: combined hormonal contraception is the most common first-line option, with cyclic progestin as an alternative.',
        'Symptom-targeted care: anti-androgens (like spironolactone) for acne and hair, topical minoxidil for hair regrowth, hair removal for cosmetic concerns.',
        'Insulin sensitization: metformin can help with cycle regularity, weight, and metabolic markers in some patients.',
        'Fertility care: letrozole is first-line for ovulation induction in PCOS-related infertility, with clomiphene as an alternative.',
        'Lifestyle: even a 5 to 10 percent body weight change in patients with overweight or obesity can restore ovulation and improve metabolic markers [Mayo Clinic].',
      ],
    },
    {
      kind: 'callout',
      tone: 'info',
      title: 'A useful framing',
      text: 'PCOS is a chronic condition, not a single fix. Cycle changes, skin changes, and metabolic changes can all need different care at different times. The diagnosis is the starting point of a longer conversation with a clinician you trust.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'If your cycle pattern looks like the PCOS picture (long cycles, irregular ovulation, signs of high androgens), the cycle page already has the timeline a clinician would want to see. Bringing your last six cycle lengths and any androgen-related signs to a visit is a strong start.',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Polycystic Ovary Syndrome (PCOS)',
      url: 'https://www.acog.org/womens-health/faqs/polycystic-ovary-syndrome-pcos',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'Mayo Clinic',
      title: 'Polycystic ovary syndrome (PCOS)',
      url: 'https://www.mayoclinic.org/diseases-conditions/pcos/symptoms-causes/syc-20353439',
      publisher: 'Mayo Clinic',
    },
  ],
  related: [
    'endometriosis-when-period-pain-isnt-normal',
    'pmdd-vs-pms-how-to-tell-the-difference',
    'irregular-cycles-causes-and-when-to-seek-help',
  ],
}

export const ENDOMETRIOSIS: LearnArticle = {
  slug: 'endometriosis-when-period-pain-isnt-normal',
  category: 'conditions',
  title: 'Endometriosis: when period pain isn\'t normal',
  subhead: 'Most patients wait years for the diagnosis. The pattern is recognizable.',
  readingMinutes: 6,
  body: [
    {
      kind: 'p',
      text: 'Endometriosis is a condition where tissue similar to the uterine lining grows outside the uterus, most often on the pelvic peritoneum, ovaries, fallopian tubes, and bowel. That tissue responds to cycle hormones the way the lining does, but the inflammation and bleeding it triggers cannot drain through the cervix. The result is pain that follows the cycle and often spreads beyond the period [ACOG].',
    },
    {
      kind: 'p',
      text: 'Roughly 1 in 10 people of reproductive age have endometriosis. The average time from first symptom to diagnosis is still measured in years. Patient-reported delays of seven or more years are common, partly because the pain is often dismissed as just a difficult period [Mayo Clinic].',
    },
    { kind: 'h2', text: 'The pattern that should raise the question' },
    {
      kind: 'ul',
      items: [
        'Pain that does not respond to over-the-counter NSAIDs taken on schedule.',
        'Pain that keeps you home from school, work, or your usual activities.',
        'Pain that has gotten worse over the past several years rather than steady.',
        'Pain outside your period: ovulation, mid-cycle, or random days.',
        'Pain with sex (dyspareunia), especially deep pelvic pain.',
        'Pain with bowel movements, urination, or bowel changes during your period.',
        'Difficulty conceiving after 6 to 12 months of trying.',
        'Heavy or prolonged bleeding alongside the pain.',
      ],
    },
    {
      kind: 'p',
      text: 'No one feature is diagnostic on its own. The combination, especially when it has been present for years and has become harder to manage, is the signal worth investigating.',
    },
    { kind: 'h2', text: 'How endometriosis is evaluated' },
    {
      kind: 'p',
      text: 'There is no blood test for endometriosis. The clinical evaluation usually starts with a careful history and physical exam, often followed by pelvic ultrasound. Ultrasound can detect endometriomas (chocolate cysts on the ovaries) and deep infiltrating disease in expert hands, but most superficial endometriosis is invisible to imaging. The historical gold standard is laparoscopy with biopsy, but recent guidelines favor empiric treatment based on clinical suspicion when imaging is reassuring [ACOG].',
    },
    { kind: 'h2', text: 'What treatment usually looks like' },
    {
      kind: 'p',
      text: 'Endometriosis treatment is tailored to symptoms, family-building goals, and treatment response. Common pieces:',
    },
    {
      kind: 'ul',
      items: [
        'Scheduled NSAIDs starting before pain peaks.',
        'Hormonal suppression: combined hormonal contraception used continuously (skipping the placebo week), progestin-only options, GnRH agonists or antagonists for refractory disease.',
        'Surgical excision or ablation of visible disease, ideally by a surgeon experienced in endometriosis.',
        'Pelvic floor physical therapy for the muscle guarding and dysfunction that often accompany the disease.',
        'Multidisciplinary pain care, especially for central sensitization, which is common after years of poorly controlled pain.',
      ],
    },
    {
      kind: 'callout',
      tone: 'caution',
      title: 'When to push for the conversation',
      text: 'Period pain that limits your life is not normal. Pain that has been written off as "just bad cramps" for years deserves a fresh evaluation, ideally with a clinician who treats endometriosis regularly.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'Logging pain by day across cycles builds the picture endometriosis specialists most want to see. Cycle-anchored pain that escalates over months, or that spreads outside the period, is exactly the pattern they look for.',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Endometriosis',
      url: 'https://www.acog.org/womens-health/faqs/endometriosis',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'Mayo Clinic',
      title: 'Endometriosis',
      url: 'https://www.mayoclinic.org/diseases-conditions/endometriosis/symptoms-causes/syc-20354656',
      publisher: 'Mayo Clinic',
    },
  ],
  related: [
    'pcos-signs-and-what-to-do',
    'pmdd-vs-pms-how-to-tell-the-difference',
    'period-pain-normal-vs-see-your-doctor',
  ],
}

export const PMDD_VS_PMS: LearnArticle = {
  slug: 'pmdd-vs-pms-how-to-tell-the-difference',
  category: 'conditions',
  title: 'PMDD vs PMS: how to tell the difference',
  subhead: 'Most people have some PMS. PMDD is a specific, treatable condition.',
  readingMinutes: 6,
  body: [
    {
      kind: 'p',
      text: 'Premenstrual syndrome (PMS) covers the cluster of physical and emotional symptoms many people notice in the week or so before their period: bloating, breast tenderness, headache, food cravings, mood swings, irritability, fatigue. PMS is common, often manageable, and usually does not derail daily life.',
    },
    {
      kind: 'p',
      text: 'Premenstrual dysphoric disorder (PMDD) is a more severe and specific condition. The mood symptoms (depression, anxiety, irritability, anger, sense of being overwhelmed) are intense enough to interfere with work, relationships, or daily function. PMDD affects roughly 3 to 8 percent of menstruating people [ACOG].',
    },
    { kind: 'h2', text: 'How clinicians distinguish them' },
    {
      kind: 'p',
      text: 'The most important clinical tool is prospective tracking across two cycles. Symptoms that line up with the late luteal week (roughly the 7 days before the period) and resolve within a few days of bleeding are cycle-driven. Symptoms that persist outside that window point to something else, like depression or anxiety with cyclical worsening [Mayo Clinic].',
    },
    {
      kind: 'p',
      text: 'PMDD is diagnosed by the DSM-5 criteria, which require at least 5 specific symptoms in most cycles, with at least one being a mood symptom (depressed mood, anxiety, irritability, or affective lability). The symptoms must impair function, must be confirmed by prospective tracking, and must not be better explained by another psychiatric condition [ACOG].',
    },
    { kind: 'h2', text: 'A side-by-side feel' },
    {
      kind: 'h3',
      text: 'PMS',
    },
    {
      kind: 'ul',
      items: [
        'Mild to moderate symptoms in the week before the period.',
        'Mostly physical, with some mood changes.',
        'Annoying but rarely disabling.',
        'Improves with general lifestyle adjustments and OTC support.',
      ],
    },
    {
      kind: 'h3',
      text: 'PMDD',
    },
    {
      kind: 'ul',
      items: [
        'Severe symptoms in the late luteal week.',
        'Mood symptoms dominate: depression, anxiety, irritability, anger, sense of overwhelm.',
        'Functional impact: work, relationships, parenting, or daily care suffer.',
        'Often requires targeted medical treatment.',
      ],
    },
    { kind: 'h2', text: 'What treatment usually looks like' },
    {
      kind: 'p',
      text: 'PMDD has good evidence for several first-line treatments. The choice depends on goals (symptom control, contraception, pregnancy plans) and response to prior care:',
    },
    {
      kind: 'ul',
      items: [
        'SSRIs (selective serotonin reuptake inhibitors). Can be taken continuously or only in the luteal phase, with similar efficacy. Effects can be felt within days for PMDD, faster than for major depression.',
        'Combined hormonal contraceptives, especially drospirenone-containing pills, dosed continuously to suppress the hormone cycle.',
        'GnRH analogues with hormonal add-back for severe, treatment-resistant cases.',
        'Cognitive behavioral therapy and lifestyle support as adjuncts, not standalone treatment for severe PMDD [ACOG].',
      ],
    },
    {
      kind: 'callout',
      tone: 'caution',
      title: 'When to be seen sooner',
      text: 'Suicidal thoughts, even cyclical ones, deserve same-day care. PMDD can include passive suicidal ideation in the late luteal week; this is a known feature of the condition and a reason to start treatment, not a reason to wait.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'Prospective tracking across two cycles is the strongest tool a clinician has for separating PMS, PMDD, and a non-cyclical mood condition. Logging mood (or just rating the day) alongside the cycle gives that picture in two cycles, instead of two years of guessing.',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Management of Premenstrual Disorders',
      url: 'https://www.acog.org/clinical/clinical-guidance/clinical-practice-guideline/articles/2023/12/management-of-premenstrual-disorders',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'Mayo Clinic',
      title: 'Premenstrual syndrome (PMS)',
      url: 'https://www.mayoclinic.org/diseases-conditions/premenstrual-syndrome/symptoms-causes/syc-20376780',
      publisher: 'Mayo Clinic',
    },
  ],
  related: [
    'pcos-signs-and-what-to-do',
    'endometriosis-when-period-pain-isnt-normal',
    'signs-your-hormones-are-off',
  ],
}

export const CONDITIONS_ARTICLES = [
  PCOS_SIGNS,
  ENDOMETRIOSIS,
  PMDD_VS_PMS,
]
