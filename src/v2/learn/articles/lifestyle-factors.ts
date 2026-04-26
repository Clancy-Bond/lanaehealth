/*
 * Articles: Lifestyle factors
 *
 * How sleep, stress, and nutrition each touch the cycle. NC voice,
 * inline citations, never preachy.
 */
import type { LearnArticle } from '../types'

export const SLEEP_AND_CYCLE: LearnArticle = {
  slug: 'how-sleep-affects-your-cycle',
  category: 'lifestyle-factors',
  title: 'How sleep affects your cycle',
  subhead: 'The hormones that run your cycle and the ones that run sleep are talking to each other.',
  readingMinutes: 5,
  body: [
    {
      kind: 'p',
      text: 'Sleep is not separate from the cycle. The brain region that times your cycle (the hypothalamus) is the same region that times your circadian rhythm. When sleep gets short, irregular, or low quality, both clocks tend to drift together [Mayo Clinic].',
    },
    { kind: 'h2', text: 'What changes through the cycle' },
    {
      kind: 'p',
      text: 'Sleep itself shifts across the cycle for many people. Estrogen tends to support deeper, more restorative sleep in the follicular phase. Progesterone, which rises in the luteal phase, raises core body temperature by roughly 0.4 to 0.8 degrees Fahrenheit. That warmer baseline can make falling and staying asleep harder, especially in the late luteal week before the period [OWH].',
    },
    {
      kind: 'p',
      text: 'A small late-luteal sleep dip is common and not a problem on its own. What matters is the trend over time and whether other symptoms cluster with it.',
    },
    { kind: 'h2', text: 'When poor sleep starts to affect the cycle' },
    {
      kind: 'p',
      text: 'Persistent short or irregular sleep can push the cycle in several directions:',
    },
    {
      kind: 'ul',
      items: [
        'Delayed or skipped ovulation, which lengthens the cycle.',
        'Heavier or longer periods, often paired with worsened cramping.',
        'More intense premenstrual symptoms, including mood, headaches, and fatigue.',
        'A flatter BBT chart in the affected cycle, sometimes with no clear ovulatory shift.',
      ],
    },
    {
      kind: 'p',
      text: 'Shift work, jet lag across multiple time zones, and chronic sleep restriction (under six hours per night for many weeks) are the most consistently studied disruptors. The link is thought to run through cortisol, melatonin, and the brain signals that drive ovulation [Mayo Clinic].',
    },
    { kind: 'h2', text: 'What helps' },
    {
      kind: 'ul',
      items: [
        'Consistent sleep and wake times, including on weekends, within about an hour.',
        'Cool bedroom in the luteal week, around 65 to 68 degrees Fahrenheit if you can manage it.',
        'Reduced screen exposure in the hour before sleep, especially in the late luteal phase.',
        'Caffeine pulled back to the morning hours when sleep starts to slip.',
        'Honest tracking of sleep alongside the cycle, not in a separate app.',
      ],
    },
    {
      kind: 'callout',
      tone: 'info',
      title: 'When sleep changes feel new',
      text: 'A sudden, persistent change in your usual sleep pattern, especially with night sweats or waking unrested, can also point to thyroid issues or perimenopause. Worth mentioning at your next visit if it lasts more than a couple of cycles.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'If you wear an Oura ring, your sleep score sits next to your cycle data on this app. Late-luteal sleep dips that follow the same pattern each cycle are useful to surface; persistent low sleep across cycles is a different conversation entirely.',
    },
  ],
  citations: [
    {
      label: 'Mayo Clinic',
      title: 'Sleep tips: 6 steps to better sleep',
      url: 'https://www.mayoclinic.org/healthy-lifestyle/adult-health/in-depth/sleep/art-20048379',
      publisher: 'Mayo Clinic',
    },
    {
      label: 'OWH',
      title: 'Insomnia',
      url: 'https://www.womenshealth.gov/a-z-topics/insomnia',
      publisher: 'Office on Women\'s Health',
    },
  ],
  related: [
    'stress-and-your-cycle-the-cortisol-connection',
    'nutrition-and-cycle-health',
    'irregular-cycles-causes-and-when-to-seek-help',
  ],
}

export const STRESS_AND_CYCLE: LearnArticle = {
  slug: 'stress-and-your-cycle-the-cortisol-connection',
  category: 'lifestyle-factors',
  title: 'Stress and your cycle: the cortisol connection',
  subhead: 'A short tour through the brain pathway that ties them together.',
  readingMinutes: 5,
  body: [
    {
      kind: 'p',
      text: 'Stress and the cycle share circuitry. The brain pathway that drives the stress response (the HPA axis) and the brain pathway that drives the cycle (the HPG axis) sit close to each other and listen to the same upstream signals. When the stress system runs hot for long enough, the cycle system tends to dial back [Mayo Clinic].',
    },
    { kind: 'h2', text: 'What cortisol does to the cycle' },
    {
      kind: 'p',
      text: 'Cortisol is the main stress hormone. In short bursts, it does its job and resets. In chronic elevations, it can suppress the gonadotropin-releasing hormone (GnRH) pulses that drive FSH and LH release. Without those signals, ovulation can be delayed, lighter, or skipped entirely [OWH].',
    },
    {
      kind: 'p',
      text: 'The clinical name for stress-driven cycle suppression is functional hypothalamic amenorrhea. It often shows up as longer cycles, lighter periods, or skipped periods in someone whose stress (psychological, physical, or both) has been high for several months.',
    },
    { kind: 'h2', text: 'How it usually shows up in tracking' },
    {
      kind: 'ul',
      items: [
        'Cycle that drifts longer than usual after a stressful stretch.',
        'A cycle that runs ovulatory but with a shorter luteal phase.',
        'Lighter than usual flow when the period does arrive.',
        'A late period after a high-stress event, with the next cycle returning to normal.',
        'Skipped period after several months of unusually high stress, training load, or sleep loss.',
      ],
    },
    {
      kind: 'p',
      text: 'A single stressed cycle is unremarkable. A pattern across two or three cycles, especially paired with weight changes or sleep disruption, is worth a clinical conversation [Mayo Clinic].',
    },
    { kind: 'h2', text: 'What helps, and what does not' },
    {
      kind: 'p',
      text: 'The evidence on stress reduction for cycle restoration is mixed and very personal. The most consistent levers in studies are:',
    },
    {
      kind: 'ul',
      items: [
        'Adequate sleep over weeks, not days.',
        'Adequate energy intake, especially for people training hard or under-eating.',
        'Reduced training load if exercise volume is part of the picture.',
        'A care plan for chronic stress sources rather than a single relaxation technique.',
      ],
    },
    {
      kind: 'p',
      text: 'Apps that promise to measure cortisol from a wearable are still imprecise; the more useful signal is the cycle pattern itself. If your cycle is running irregular through a high-stress stretch, the cycle is telling you something the wrist data only hints at.',
    },
    {
      kind: 'callout',
      tone: 'caution',
      title: 'Worth a clinical visit',
      text: 'Three or more cycles in a row that look stress-suppressed. No period for 90 days or more outside pregnancy or breastfeeding. Cycle changes paired with significant weight loss, low body weight, or restrictive eating.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'High-stress weeks rarely show up as a single bad day in a tracker. The pattern is in the run: cycle drift, lighter flow, sleep dropping. The patterns page is the easiest place to see those threads at once.',
    },
  ],
  citations: [
    {
      label: 'Mayo Clinic',
      title: 'Chronic stress puts your health at risk',
      url: 'https://www.mayoclinic.org/healthy-lifestyle/stress-management/in-depth/stress/art-20046037',
      publisher: 'Mayo Clinic',
    },
    {
      label: 'OWH',
      title: 'Period problems',
      url: 'https://www.womenshealth.gov/menstrual-cycle/period-problems',
      publisher: 'Office on Women\'s Health',
    },
  ],
  related: [
    'how-sleep-affects-your-cycle',
    'nutrition-and-cycle-health',
    'irregular-cycles-causes-and-when-to-seek-help',
  ],
}

export const NUTRITION_AND_CYCLE: LearnArticle = {
  slug: 'nutrition-and-cycle-health',
  category: 'lifestyle-factors',
  title: 'Nutrition and cycle health: micronutrients that matter',
  subhead: 'A short list of nutrients with real cycle evidence behind them.',
  readingMinutes: 6,
  body: [
    {
      kind: 'p',
      text: 'Most cycle nutrition advice on the internet is overconfident. The handful of nutrients with consistent evidence behind them is shorter than the supplement aisle suggests, and most of the work is being done by adequate calories, protein, and a varied diet, not by any single capsule [Mayo Clinic].',
    },
    { kind: 'h2', text: 'Adequate energy comes first' },
    {
      kind: 'p',
      text: 'Persistent under-eating, even without dramatic weight loss, can suppress ovulation. The pattern is called relative energy deficiency in sport (RED-S) when training load is part of the picture, but it can happen without athletic training too. The first lever for someone with a stress-suppressed or training-suppressed cycle is usually more food, not more supplements [OWH].',
    },
    { kind: 'h2', text: 'Iron' },
    {
      kind: 'p',
      text: 'People who menstruate lose iron each cycle, more if periods are heavy. Low iron (with or without full anemia) shows up as fatigue, exercise intolerance, hair shedding, restless legs, and pica. Routine ferritin checks are inexpensive and worthwhile if any of those are present [ACOG].',
    },
    {
      kind: 'ul',
      items: [
        'Heme iron sources: red meat, poultry, fish.',
        'Non-heme iron sources: lentils, beans, tofu, fortified cereals, dark leafy greens.',
        'Vitamin C alongside iron-rich plant foods improves absorption.',
        'Calcium and tea or coffee in the same meal reduce non-heme iron absorption; spacing them apart helps.',
      ],
    },
    { kind: 'h2', text: 'Magnesium' },
    {
      kind: 'p',
      text: 'Magnesium has reasonable evidence for cramp severity and premenstrual symptom intensity in small trials. The strongest food sources are pumpkin seeds, almonds, spinach, black beans, dark chocolate, and avocados. A short magnesium supplement trial in the late luteal week is a reasonable thing to discuss with a clinician if PMS or cramps are persistent [Mayo Clinic].',
    },
    { kind: 'h2', text: 'Vitamin D' },
    {
      kind: 'p',
      text: 'Vitamin D deficiency is common and is associated with more painful periods and irregular cycles in observational studies. Causality is less clear; correction of true deficiency makes sense regardless. A simple 25-hydroxyvitamin D test tells you where you stand [Mayo Clinic].',
    },
    { kind: 'h2', text: 'Omega-3 fats' },
    {
      kind: 'p',
      text: 'Omega-3 fatty acids (from fatty fish or algal oil) have small but consistent trial evidence for reduction in primary dysmenorrhea. The dose ranges studied are typical fish-oil amounts, around 1 gram per day of EPA and DHA combined.',
    },
    { kind: 'h2', text: 'Folate, B12, and B6' },
    {
      kind: 'p',
      text: 'B vitamin status matters most for people considering pregnancy (folate) and for people on long-term metformin or strict plant-based diets (B12). B6 has small-to-modest evidence for premenstrual mood symptoms in older trials [Mayo Clinic].',
    },
    {
      kind: 'callout',
      tone: 'caution',
      title: 'On supplements',
      text: 'High doses are not benign. Iron without documented low ferritin can cause GI side effects and rarely overload. B6 above 100 mg per day has been associated with neuropathy in long-term use. Vitamin D above 4000 IU per day without monitoring is not recommended for most adults. Talk to a clinician before starting anything beyond a multivitamin.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'The food log on this app captures actual intake patterns. If iron-rich days are sparse, or omega-3 sources are missing across weeks, that is a more honest starting point for a nutrition conversation than a guess from memory.',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Heavy and abnormal periods',
      url: 'https://www.acog.org/womens-health/faqs/heavy-and-abnormal-periods',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'Mayo Clinic',
      title: 'Vitamins and supplements',
      url: 'https://www.mayoclinic.org/healthy-lifestyle/nutrition-and-healthy-eating/expert-answers/vitamins/faq-20058088',
      publisher: 'Mayo Clinic',
    },
    {
      label: 'OWH',
      title: 'Healthy eating',
      url: 'https://www.womenshealth.gov/healthy-eating',
      publisher: 'Office on Women\'s Health',
    },
  ],
  related: [
    'how-sleep-affects-your-cycle',
    'stress-and-your-cycle-the-cortisol-connection',
    'pcos-signs-and-what-to-do',
  ],
}

export const LIFESTYLE_FACTORS_ARTICLES = [
  SLEEP_AND_CYCLE,
  STRESS_AND_CYCLE,
  NUTRITION_AND_CYCLE,
]
