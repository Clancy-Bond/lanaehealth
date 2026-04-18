/**
 * Explainer dictionary
 *
 * One source of truth for the InfoTip component. Each entry has:
 *   - what:     plain-English definition (one sentence)
 *   - matters:  why it matters for Lanae specifically
 *   - yours?:   optional pointer to her own context (kept generic so we
 *               can deep-link without loading data here)
 *
 * Voice: warm, second-person, no jargon stack-up. Treat each entry like
 * you're explaining to a friend who is tired and needs the why fast.
 */

export interface ExplainerEntry {
  what: string;
  matters: string;
  yours?: string;
  more?: { label: string; href: string };
}

export const EXPLAINERS: Record<string, ExplainerEntry> = {
  // === Lab values ===
  ferritin: {
    what: "How much iron your body has stored away for later use.",
    matters: "Low ferritin is the earliest sign of iron deficiency, often before red blood cells look abnormal. With your fatigue, hair shedding, and exercise intolerance, this is one of the most important numbers to watch.",
    yours: "Yours has been low (under 30 ng/mL) for a while. Above 50 is the sweet spot for symptom relief in your situation.",
  },
  hemoglobin: {
    what: "The protein in red blood cells that carries oxygen from your lungs to the rest of your body.",
    matters: "When this drops, you feel tired, short of breath, and your heart races to compensate. It is the classic anemia number.",
  },
  hematocrit: {
    what: "The percentage of your blood made up of red blood cells.",
    matters: "Pairs with hemoglobin to confirm anemia. A low hematocrit usually means low hemoglobin.",
  },
  tsh: {
    what: "Thyroid Stimulating Hormone, made by your pituitary gland to tell your thyroid how hard to work.",
    matters: "When your thyroid is sluggish (hypothyroid), TSH goes up to push it harder. High TSH explains fatigue, hair loss, cold intolerance, and stubborn weight.",
    yours: "Yours has been borderline high (~5.1). The lab range says under 4.5 is normal but most endocrinologists treat above 4.0 in symptomatic women.",
  },
  "free t4": {
    what: "The active thyroid hormone circulating in your blood right now.",
    matters: "Free T4 is what is actually doing the work. TSH tells you the gland's marching orders, free T4 tells you whether the gland is delivering.",
  },
  "vitamin d": {
    what: "A hormone (often called a vitamin) your body makes from sunlight, critical for bones, mood, and immune function.",
    matters: "Low vitamin D worsens fatigue, muscle pain, and immune dysregulation. Common in chronic illness and easy to fix.",
    yours: "Yours has been low. Living in Hawaii does not protect you if you are mostly indoors during peak sun.",
  },
  cholesterol: {
    what: "A fatty substance your body needs to build cells and hormones, but too much in the wrong form raises heart risk over time.",
    matters: "A snapshot. Trends matter more than any single reading, and your overall picture (HDL, LDL, triglycerides, lifestyle) matters more than total cholesterol alone.",
  },
  hdl: {
    what: "The 'good' cholesterol that helps clear other cholesterol out of your arteries.",
    matters: "Higher is better. Exercise, healthy fats, and not smoking all push this up.",
  },
  ldl: {
    what: "The 'bad' cholesterol that can build up in artery walls.",
    matters: "Lower is better, but context matters. A high LDL with high HDL and low inflammation is very different from a high LDL with metabolic disease.",
  },
  triglycerides: {
    what: "Fat in your blood that comes mostly from sugar, alcohol, and refined carbs.",
    matters: "More responsive to diet than cholesterol. High triglycerides often mean too many fast carbs or too much alcohol.",
  },

  // === Vitals & biometrics ===
  hrv: {
    what: "Heart Rate Variability, the tiny variation between heartbeats that reflects how well your nervous system is recovering.",
    matters: "When you are well-rested and not under stress, HRV is high. When you are sick, sleep-deprived, or stressed, HRV drops. It is one of the best early-warning signs that your body is taxed.",
    yours: "Your baseline is around 35 ms. Days under 25 ms tend to correlate with your migraine and pain flares.",
  },
  rhr: {
    what: "Resting Heart Rate, your beats per minute when you are calm and still.",
    matters: "A lower RHR usually means a stronger, more efficient cardiovascular system. A sudden jump above your baseline often signals illness, dehydration, or an oncoming flare.",
    yours: "Your baseline runs low-60s when you are well. Days above 75 are worth watching.",
  },
  spo2: {
    what: "Blood oxygen saturation, the percentage of red blood cells carrying oxygen.",
    matters: "Above 95% is normal. Persistent dips below 92% during sleep can suggest sleep apnea or other airway issues.",
  },
  "body temp": {
    what: "Your skin temperature deviation from your personal baseline.",
    matters: "Subtle elevation often shows up before you feel sick, and the cyclical rise after ovulation can confirm cycle phase.",
  },
  steps: {
    what: "How many steps you took today.",
    matters: "Not the goal in itself. The point is gentle, regular movement. With your POTS-like symptoms, hitting an arbitrary number can backfire if you push past your envelope.",
  },
  "respiratory rate": {
    what: "How many breaths you take per minute while you sleep, measured by your Oura ring.",
    matters: "A steady jump above your usual range is one of the earliest signals of an oncoming illness or flare, often before you feel sick.",
  },
  "sleep score": {
    what: "Oura's overall rating of last night's sleep, from 0 to 100, blending duration, efficiency, restfulness, and timing.",
    matters: "A useful single number to scan, but the underlying contributors (deep, REM, restlessness) tell you more about why a night was good or bad.",
  },
  readiness: {
    what: "Oura's daily score for how recovered your body is, from 0 to 100, based on sleep, HRV, RHR, body temperature, and recent activity.",
    matters: "A good proxy for capacity. With POTS-like symptoms, training or pushing on a low-readiness day tends to backfire, so this card scales movement to fit.",
  },
  pain: {
    what: "How much overall pain you logged today on a 0 to 10 scale.",
    matters: "Tracking pain over time turns a vague 'how was the week' answer into a clear pattern your doctor can act on.",
  },
  energy: {
    what: "How much energy you have today, shown as 10 minus your logged fatigue score.",
    matters: "Higher is better. Pairing energy with sleep, HRV, and cycle phase often surfaces the things that drain you most.",
  },
  fatigue: {
    what: "How tired you feel today on a 0 to 10 scale, with 10 being the most exhausted.",
    matters: "Fatigue is one of your most consistent symptoms, and tracking it daily is the only way to spot what tends to make it better or worse.",
  },
  "wrist temp deviation": {
    what: "How far your overnight skin temperature drifted from your personal baseline, measured by Oura.",
    matters: "A subtle rise often shows up before you feel sick, and the cyclical bump after ovulation can confirm what phase of your cycle you are in.",
  },
  "resting heart rate": {
    what: "Your heart rate while you are calm and still, usually measured overnight by Oura.",
    matters: "A lower RHR usually means a stronger, more efficient cardiovascular system. A sudden jump above your baseline often signals illness, dehydration, or an oncoming flare.",
    yours: "Your baseline runs low-60s when you are well. Days above 75 are worth watching.",
  },
  "heart rate variability": {
    what: "The tiny variation between heartbeats, measured by Oura overnight, that reflects how well your nervous system is recovering.",
    matters: "When you are well-rested and not under stress, HRV is high. When you are sick, sleep-deprived, or stressed, HRV drops. It is one of the best early-warning signs that your body is taxed.",
    yours: "Your baseline is around 35 ms. Days under 25 ms tend to correlate with your migraine and pain flares.",
  },

  // === Cycle & reproductive ===
  "cycle phase": {
    what: "Where you are in your menstrual cycle: menstrual, follicular, ovulatory, or luteal.",
    matters: "Hormones shift dramatically across these phases and they often change how you feel. Tracking phase alongside symptoms reveals patterns you would miss otherwise.",
  },
  "cycle day": {
    what: "Which day of your current menstrual cycle you are on, counted from the first day of your last period.",
    matters: "Hormones swing across the cycle and they often change how you feel. Knowing your cycle day makes it easier to anticipate symptom patterns.",
  },
  ovulation: {
    what: "When your ovary releases an egg, usually around day 14 of a 28-day cycle but variable.",
    matters: "Estrogen peaks just before, then progesterone takes over. The shift can affect mood, sleep, body temperature, and migraine risk.",
  },
  "luteal phase": {
    what: "The second half of your cycle, after ovulation and before your next period.",
    matters: "Progesterone-dominant. For many women with chronic illness, symptoms worsen here. PMS, migraines, and pain often cluster in the late luteal phase.",
  },
  "follicular phase": {
    what: "The first half of your cycle, from period start through ovulation.",
    matters: "Estrogen rising. Often the phase where energy, mood, and exercise tolerance feel best.",
  },

  // === Orthostatic / POTS ===
  "orthostatic delta": {
    what: "How much your heart rate jumps when you stand up from lying down.",
    matters: "A sustained increase of 30+ bpm within 10 minutes of standing is the hallmark of POTS. It explains the dizziness, racing heart, and fatigue that follow positional changes.",
    yours: "Your last orthostatic test showed standing 106 / supine 91, a delta of 15 bpm. Borderline but worth re-testing.",
  },
  pots: {
    what: "Postural Orthostatic Tachycardia Syndrome, where your heart rate jumps abnormally high when you stand up.",
    matters: "Causes dizziness, fatigue, brain fog, racing heart, and exercise intolerance. Common in women, often appears after illness or hormonal shifts.",
  },
  "supine pulse": {
    what: "Your heart rate while lying flat on your back.",
    matters: "The baseline you compare against your standing pulse. A normal supine pulse with a high standing pulse is the POTS pattern.",
  },
  "standing pulse": {
    what: "Your heart rate after standing up for 10 minutes.",
    matters: "If this is more than 30 bpm above your supine pulse and you have symptoms, it points to POTS or related dysautonomia.",
  },

  // === App features ===
  baseline: {
    what: "Your personal normal range for a metric, calculated from your own data over the last 28 days.",
    matters: "Population averages do not apply to chronic illness. Your baseline is what is normal for you, so we can flag what is actually different.",
  },
  iqr: {
    what: "Interquartile range, the middle 50% of your readings (the 25th to 75th percentile).",
    matters: "More robust than 'average' because it ignores outliers. If today is outside your IQR, it is genuinely unusual for you.",
  },
  correlation: {
    what: "A statistical measure of how strongly two things move together.",
    matters: "A correlation is not proof of cause. But if your sleep score and next-day pain consistently move together over 100+ days, that is a real signal worth investigating.",
  },
  "r value": {
    what: "The Pearson or Spearman correlation coefficient, ranging from -1 to +1.",
    matters: "Closer to +1 means strong positive correlation, -1 means strong inverse, near 0 means no relationship. We label anything above 0.4 (in absolute value) as worth noticing.",
  },
  "p value": {
    what: "The probability that the pattern we see could happen by random chance.",
    matters: "Smaller is better. Under 0.05 is the standard threshold for 'unlikely to be coincidence', under 0.01 is stronger.",
  },
  "cohens d": {
    what: "A standardized effect size, used when we compare two groups (like 'days you slept well' vs 'days you didn't').",
    matters: "Tells you how big the difference is, in plain terms. 0.2 is small, 0.5 is moderate, 0.8 is large.",
  },
  "mann whitney": {
    what: "A statistical test that compares two groups without assuming the data is bell-curved.",
    matters: "More robust than a t-test for messy real-world health data. We use it when we are comparing ranks, not raw numbers.",
  },
  "year in pixels": {
    what: "A grid where each square is one day, colored by how that day went on a chosen metric.",
    matters: "Lets you see months of trend at a glance, including patterns that align with seasons, cycle, or life events.",
  },
  "top insight": {
    what: "The single highest-confidence pattern we found in your data this week.",
    matters: "We rank patterns by combined strength (effect size) and reliability (sample size and p-value). The top insight is the one most worth showing your doctor.",
  },
  "doctor mode": {
    what: "A clinical summary built from your data, formatted for a doctor's appointment.",
    matters: "Saves you from having to remember and explain everything. Print it, hand it over, and let the data do the talking.",
  },
  "intelligence engine": {
    what: "The system that reads all your data, finds patterns, generates hypotheses, and surfaces what changed.",
    matters: "Rather than dump every chart on you, it does the work to figure out which 3 things this week are worth your attention.",
  },
  "stale tests": {
    what: "Tests that were ordered but never resulted, or that are due for repeat based on their typical interval.",
    matters: "Things fall through the cracks in healthcare all the time. We flag them so you can chase down what is missing.",
  },
  "wrong modality": {
    what: "When the type of imaging or test ordered probably won't answer the clinical question.",
    matters: "We compare the hypothesis (what your doctor was trying to learn) against what the test actually measures. If there is a mismatch, we flag it.",
  },
  "active problem": {
    what: "A health issue you currently live with, as opposed to past or resolved ones.",
    matters: "Helps doctors and the AI focus on what is relevant right now, not what was a problem five years ago.",
  },
  "session handoff": {
    what: "A short summary written at the end of each conversation, used to brief the next one.",
    matters: "So the AI does not lose the thread between sessions, and you do not have to re-explain context every time.",
  },
  favorites: {
    what: "The metrics you pinned to your home screen so you can see them at a glance.",
    matters: "You decide what is important to track. Edit your favorites in Settings any time your priorities shift.",
  },
  "pattern found": {
    what: "A statistically meaningful relationship the engine spotted between two things in your data, like sleep score and next-day pain.",
    matters: "A pattern is not proof of cause, but a strong, repeatable signal is worth a closer look and worth bringing to your doctor.",
  },
  "barometric pressure": {
    what: "The weight of the air around you, measured in hectopascals (hPa). Falls before storms, rises in clear weather.",
    matters: "Drops in pressure are a known migraine and joint-pain trigger for many people, and POTS symptoms can shift with weather too.",
  },

  // === Conditions / diagnoses ===
  mcas: {
    what: "Mast Cell Activation Syndrome, where mast cells (part of your immune system) release too many inflammatory chemicals at the wrong times.",
    matters: "Causes flushing, hives, GI upset, food and chemical reactions, and unexplained fatigue. Often co-occurs with POTS and connective tissue issues.",
  },
  endometriosis: {
    what: "When tissue similar to the uterus lining grows outside the uterus, causing pain, scarring, and inflammation.",
    matters: "Affects ~1 in 10 women, often takes 7+ years to diagnose. Pain can be cyclical or constant, and severity does not predict severity.",
  },
  "telogen effluvium": {
    what: "A diffuse hair shedding triggered by a physical or emotional stressor 2 to 4 months earlier.",
    matters: "Recovers on its own once the trigger is resolved (illness, anemia, thyroid, surgery, big life event), but takes 6 to 12 months.",
  },
  syncope: {
    what: "A temporary loss of consciousness, often called fainting, caused by a sudden drop in blood flow to the brain.",
    matters: "True syncope is different from feeling lightheaded. It needs a workup to rule out cardiac causes before assuming it is orthostatic.",
  },
  "iron deficiency": {
    what: "Low body iron stores, usually measured by serum ferritin. Can occur with or without anemia.",
    matters: "Even before red blood cells look abnormal, low iron drives fatigue, hair shedding, brain fog, and exercise intolerance. Treatable, but the dose and route matter.",
    yours: "Yours has been low for a while. Above 50 ng/mL ferritin is the sweet spot for symptom relief in your case.",
  },
  "vitamin d deficiency": {
    what: "Below-normal levels of 25-hydroxy vitamin D in the blood.",
    matters: "Low vitamin D worsens fatigue, muscle pain, mood, and immune dysregulation. Common in chronic illness and easy to fix once it is on the radar.",
    yours: "Yours has been low. Living in Hawaii does not protect you if you are mostly indoors during peak sun.",
  },
  "borderline tsh": {
    what: "A thyroid stimulating hormone result sitting just above the normal lab range, suggesting your thyroid is being pushed harder than it should.",
    matters: "An early hint of subclinical hypothyroidism. It earns a repeat TSH plus free T4, sometimes thyroid antibodies, before treatment is decided.",
    yours: "Yours came back ~5.1. The lab cutoff is 4.5 but most endocrinologists treat above 4.0 in symptomatic women.",
  },
  "borderline cholesterol": {
    what: "Total or LDL cholesterol that is above the optimal range but not yet at a level requiring medication.",
    matters: "Tracked over time so changes in diet, sleep, hormones, and inflammation can be tied to the trend before any drug decision.",
    yours: "Your latest total cholesterol came back 286 (high). Worth re-checking with a full panel and seeing the trend.",
  },
  migraines: {
    what: "Recurring headaches, often one-sided and throbbing, that can include nausea, light or sound sensitivity, and visual aura.",
    matters: "Migraine patterns frequently track with menstrual cycle phase, sleep, dehydration, and weather. All of which you log.",
  },
  hypothesis: {
    what: "A possible explanation for a cluster of symptoms, scored by how well current evidence supports or contradicts it.",
    matters: "Naming each hypothesis (and what would change it) is how diagnostic anchoring gets caught. The brief lists supporting data, contradicting data, and the single test that would shift it most.",
  },

  // === Additional lab values surfaced from your record ===
  "free t3": {
    what: "The most metabolically active form of thyroid hormone, converted from T4 in your tissues.",
    matters: "T3 is what actually drives energy, mood, and metabolism at the cellular level. A normal TSH with low free T3 can still leave you symptomatic.",
  },
  "vitamin b12": {
    what: "A vitamin your body needs to make red blood cells, support nerves, and produce energy.",
    matters: "Low B12 looks a lot like iron deficiency: fatigue, brain fog, tingling, and hair shedding. Worth checking alongside ferritin since the symptoms overlap.",
  },
  folate: {
    what: "A B-vitamin your body uses to build new cells, including red blood cells and DNA.",
    matters: "Low folate causes a similar anemia to B12 deficiency. Often paired with B12 testing to sort out which one is the problem.",
  },
  iron: {
    what: "Serum iron, the amount of iron actively circulating in your blood right now.",
    matters: "A snapshot that swings hour to hour with food. On its own it is not enough. It needs ferritin and transferrin saturation for the full picture.",
  },
  tibc: {
    what: "Total Iron Binding Capacity, how much room your blood has to carry iron.",
    matters: "When your body senses low iron, it makes more transferrin to grab whatever it can find, so TIBC goes up. High TIBC is a clue that iron stores are running thin.",
  },
  transferrin: {
    what: "The protein that ferries iron from your gut and liver to the rest of your body.",
    matters: "Goes up when iron stores are low because your body is trying harder to capture every available molecule. A useful companion to ferritin.",
  },
  "transferrin saturation": {
    what: "The percentage of your iron transport protein that is currently carrying iron.",
    matters: "Below 20% is a strong signal of iron deficiency, even if hemoglobin still looks fine. One of the more reliable early flags for your iron picture.",
  },
  rbc: {
    what: "Red Blood Cell count, how many oxygen-carrying cells you have per volume of blood.",
    matters: "Pairs with hemoglobin and hematocrit to confirm anemia. Low RBC plus low hemoglobin is the classic pattern.",
  },
  wbc: {
    what: "White Blood Cell count, your immune system's foot soldiers.",
    matters: "High suggests infection or inflammation, low can suggest immune suppression or bone marrow stress. Worth watching across flares.",
  },
  platelets: {
    what: "Tiny cell fragments that help your blood clot.",
    matters: "Usually stable, but low platelets can cause easy bruising and bleeding, while high can occur with inflammation.",
  },
  mcv: {
    what: "Mean Corpuscular Volume, the average size of your red blood cells.",
    matters: "Low MCV (small cells) points toward iron deficiency. High MCV (large cells) points toward B12 or folate deficiency. A useful first sort when figuring out the type of anemia.",
  },
  mch: {
    what: "Mean Corpuscular Hemoglobin, the average amount of hemoglobin in each red blood cell.",
    matters: "Low MCH usually tracks with iron deficiency. Pairs with MCV to characterize the type of anemia.",
  },
  mchc: {
    what: "Mean Corpuscular Hemoglobin Concentration, the density of hemoglobin within each red blood cell.",
    matters: "Low MCHC suggests cells are pale and underfilled, classic for iron deficiency anemia.",
  },
  rdw: {
    what: "Red cell Distribution Width, how much your red blood cells vary in size.",
    matters: "High RDW often precedes a clear iron or B12 deficiency by months. An early hint that something is shifting in your red cell production.",
  },
  mpv: {
    what: "Mean Platelet Volume, the average size of your platelets.",
    matters: "Larger platelets are usually younger ones. Out-of-range values can be a clue when platelet count itself looks normal.",
  },
  "total cholesterol": {
    what: "The sum of all cholesterol particles in your blood, including LDL, HDL, and a portion of triglycerides.",
    matters: "A useful headline number, but the breakdown into HDL and LDL tells you far more about actual heart risk than the total alone.",
  },
  "hdl cholesterol": {
    what: "The 'good' cholesterol that helps clear other cholesterol out of your arteries.",
    matters: "Higher is better. Exercise, healthy fats, and not smoking all push this up.",
  },
  "ldl cholesterol": {
    what: "The 'bad' cholesterol that can build up in artery walls.",
    matters: "Lower is better, but context matters. A high LDL with high HDL and low inflammation is very different from a high LDL with metabolic disease.",
  },
  glucose: {
    what: "The amount of sugar in your blood at the moment of the draw.",
    matters: "A fasting glucose snapshot. Useful but limited without context. HbA1c gives the bigger picture of how blood sugar has been running.",
  },
  hba1c: {
    what: "Average blood sugar over the last 2 to 3 months, measured by how much sugar has stuck to your red blood cells.",
    matters: "More reliable than a single glucose reading because it smooths out daily swings. The standard screening for prediabetes and diabetes.",
  },
  "hs-crp": {
    what: "High-sensitivity C-Reactive Protein, a marker of inflammation in your body.",
    matters: "Elevated CRP signals systemic inflammation, which connects to autoimmune flares, infection, and heart disease risk. Useful for tracking flare activity.",
  },
  crp: {
    what: "C-Reactive Protein, a general marker of inflammation made by your liver.",
    matters: "Goes up with infection, autoimmune flares, and tissue damage. A blunt but useful tool for asking 'is something inflamed right now?'",
  },
  esr: {
    what: "Erythrocyte Sedimentation Rate, how fast red blood cells settle to the bottom of a tube.",
    matters: "An old-school inflammation marker that moves more slowly than CRP. Often paired with CRP to confirm inflammation is real and tracking over time.",
  },
  creatinine: {
    what: "A waste product your kidneys filter out of your blood.",
    matters: "A standard measure of kidney function. Drift up over time can be the first sign your kidneys are working harder than they should.",
  },
  bun: {
    what: "Blood Urea Nitrogen, another waste product cleared by the kidneys.",
    matters: "Paired with creatinine to assess kidney function and hydration status. High BUN alone often just means you are dehydrated.",
  },
  egfr: {
    what: "Estimated Glomerular Filtration Rate, a calculated measure of how well your kidneys are filtering.",
    matters: "Above 90 is normal, below 60 is a flag. The single best number for tracking kidney health over time.",
  },
  alt: {
    what: "Alanine Aminotransferase, a liver enzyme that leaks into the blood when liver cells are stressed.",
    matters: "The most sensitive marker of liver irritation. Goes up with fatty liver, alcohol, certain medications, and viral infections.",
  },
  ast: {
    what: "Aspartate Aminotransferase, another liver enzyme that also lives in muscle and heart tissue.",
    matters: "Paired with ALT to gauge liver health. AST much higher than ALT can suggest alcohol or muscle damage rather than liver disease.",
  },
  alp: {
    what: "Alkaline Phosphatase, an enzyme found in liver, bone, and bile ducts.",
    matters: "High ALP can come from bile duct issues or active bone turnover (which is normal in young adults). Context matters.",
  },
  bilirubin: {
    what: "A yellow pigment your liver processes from broken-down red blood cells.",
    matters: "High bilirubin is what causes jaundice. Mild elevations are common in Gilbert syndrome and usually harmless.",
  },
  albumin: {
    what: "The most abundant protein in your blood, made by your liver.",
    matters: "A general marker of nutrition and liver function. Low albumin can suggest poor absorption, chronic inflammation, or liver issues.",
  },
  globulin: {
    what: "A group of blood proteins that includes antibodies and transport proteins.",
    matters: "High globulin can hint at chronic inflammation or autoimmune activity. Low can hint at immune deficiency.",
  },
  "total protein": {
    what: "The sum of albumin and globulin, the two main protein groups in your blood.",
    matters: "A general health snapshot. Out-of-range values usually point you to look more carefully at the albumin and globulin breakdown.",
  },
  "a/g ratio": {
    what: "The ratio of albumin to globulin in your blood.",
    matters: "A low ratio can hint at chronic inflammation, autoimmune activity, or liver issues. Most useful in context with the actual albumin and globulin values.",
  },
  sodium: {
    what: "An electrolyte critical for fluid balance, nerve signals, and blood pressure.",
    matters: "Low sodium can come from over-hydration or hormone issues and can worsen lightheadedness. Especially relevant if you are increasing salt for POTS.",
  },
  potassium: {
    what: "An electrolyte that keeps your heart, muscles, and nerves firing correctly.",
    matters: "Both high and low potassium can affect heart rhythm. Worth keeping an eye on if you are on certain medications or restricting food.",
  },
  chloride: {
    what: "An electrolyte that pairs with sodium to maintain fluid balance and blood pH.",
    matters: "Tracks closely with sodium. Out-of-range values usually point to hydration, kidney, or breathing issues.",
  },
  "chloride level": {
    what: "An electrolyte that pairs with sodium to maintain fluid balance and blood pH.",
    matters: "Tracks closely with sodium. Out-of-range values usually point to hydration, kidney, or breathing issues.",
  },
  co2: {
    what: "Bicarbonate, a measure of acid-base balance in your blood.",
    matters: "Low CO2 can suggest the body is more acidic than it should be (kidney, breathing, or metabolic causes). Usually tracked with the rest of your basic metabolic panel.",
  },
  calcium: {
    what: "A mineral essential for bones, nerves, muscle contraction, and clotting.",
    matters: "Tightly regulated by your parathyroid glands and vitamin D. Out-of-range values often point you toward checking those next.",
  },
  "calcium level": {
    what: "A mineral essential for bones, nerves, muscle contraction, and clotting.",
    matters: "Tightly regulated by your parathyroid glands and vitamin D. Out-of-range values often point you toward checking those next.",
  },
  magnesium: {
    what: "A mineral involved in over 300 reactions, including muscle relaxation, sleep, and migraine prevention.",
    matters: "Low magnesium can worsen muscle cramps, anxiety, sleep quality, and migraines. Often low in chronic illness and easy to supplement.",
  },
  "anion gap": {
    what: "A calculated value from your electrolytes that helps spot acid-base imbalances.",
    matters: "Usually flagged only when it is very high, which can suggest a metabolic acidosis worth investigating. Often normal.",
  },
  "d-dimer": {
    what: "A breakdown product of clots, used to screen for active clotting.",
    matters: "A negative D-dimer is reassuring. A positive one is non-specific and usually leads to imaging or more tests rather than a diagnosis on its own.",
  },
  "c4 complement": {
    what: "A protein in your immune system that helps mark invaders for destruction.",
    matters: "Low C4 can suggest autoimmune activity (especially lupus). Often part of an autoimmune workup.",
  },
  "reticulocyte count": {
    what: "How many young, freshly made red blood cells are circulating in your blood.",
    matters: "A high count means your bone marrow is responding to anemia. A low count in the face of anemia suggests the marrow is not keeping up, which changes the workup.",
  },
  "retic pct": {
    what: "Reticulocyte percentage, the fraction of your red blood cells that are young and freshly made.",
    matters: "Tracks how actively your bone marrow is replacing red blood cells. Low retic with low hemoglobin suggests the marrow is under-producing.",
  },

  // === Hormones / reproductive labs ===
  estradiol: {
    what: "The main form of estrogen circulating in your body, made primarily by your ovaries.",
    matters: "Levels swing dramatically across your cycle. Low estradiol can drive fatigue, mood shifts, and migraines. High can show up with PCOS or estrogen dominance. Cycle day matters when interpreting.",
  },
  "estradiol (e2)": {
    what: "The main form of estrogen circulating in your body, made primarily by your ovaries.",
    matters: "Levels swing dramatically across your cycle. Low estradiol can drive fatigue, mood shifts, and migraines. High can show up with PCOS or estrogen dominance. Cycle day matters when interpreting.",
  },
  progesterone: {
    what: "The hormone that rises after ovulation and prepares the body for pregnancy.",
    matters: "Low progesterone in the luteal phase can cause spotting, anxiety, poor sleep, and worsened PMS. Often linked to fatigue and migraine patterns.",
  },
  prolactin: {
    what: "A pituitary hormone best known for milk production, but it also affects cycles, mood, and fertility.",
    matters: "High prolactin can cause irregular cycles, missed periods, and headaches. Worth checking when periods are unpredictable or when PCOS is on the table.",
  },
  lh: {
    what: "Luteinizing Hormone, the pituitary signal that triggers ovulation mid-cycle.",
    matters: "A high LH-to-FSH ratio (often 2 or 3 to 1) is one of the classic patterns in PCOS. Cycle day matters since LH spikes around ovulation.",
  },
  fsh: {
    what: "Follicle Stimulating Hormone, the pituitary signal that tells your ovaries to mature an egg.",
    matters: "Helps interpret cycle health, ovarian reserve, and menopausal status. Paired with LH to reveal patterns like PCOS.",
  },
  amh: {
    what: "Anti-Mullerian Hormone, made by small follicles in your ovaries.",
    matters: "A snapshot of your ovarian reserve. High AMH is common in PCOS, low AMH suggests diminished reserve. Useful when fertility is on your mind.",
  },
  testosterone: {
    what: "An androgen hormone women make in small amounts in the ovaries and adrenal glands.",
    matters: "High testosterone (or its free, active form) is one of the markers in PCOS and can cause acne, hair growth, and irregular cycles.",
  },
  cortisol: {
    what: "Your main stress hormone, made by the adrenal glands on a daily rhythm.",
    matters: "Should be highest in the morning and lowest at night. A flattened or reversed pattern can show up in chronic stress, fatigue states, and HPA axis dysfunction.",
  },
  shbg: {
    what: "Sex Hormone Binding Globulin, the protein that carries sex hormones in the blood.",
    matters: "High SHBG locks up free testosterone and estrogen. Low SHBG (common in PCOS and insulin resistance) leaves more free androgens to cause symptoms.",
  },
  "bhcg/pregnancy": {
    what: "Beta-hCG, the hormone made during pregnancy and used as a pregnancy test.",
    matters: "Standard before imaging or certain medications in women of reproductive age. A negative result is what is expected here.",
  },

  // === Autoimmune / inflammatory ===
  ana: {
    what: "Antinuclear Antibody, a screening test for autoimmune disease.",
    matters: "A positive ANA does not diagnose anything on its own. It is a flag that your immune system might be making antibodies against your own tissues, prompting more specific testing.",
  },
  tryptase: {
    what: "An enzyme released by mast cells, sometimes elevated in mast cell disorders.",
    matters: "A baseline tryptase and one drawn during a reaction can help confirm mast cell activation. Relevant given your suspected MCAS picture.",
  },

  // === Vitals captured as labs ===
  "blood pressure systolic": {
    what: "The top number in your blood pressure, measuring the pressure when your heart contracts.",
    matters: "With your POTS-like symptoms, a low or rapidly dropping systolic pressure when you stand can explain dizziness and fatigue.",
  },
  "blood pressure diastolic": {
    what: "The bottom number in your blood pressure, measuring the pressure when your heart rests between beats.",
    matters: "A consistently low diastolic with symptoms can hint at dysautonomia. A consistently high one signals cardiovascular strain over time.",
  },
  "systolic bp": {
    what: "The top number in your blood pressure, measuring the pressure when your heart contracts.",
    matters: "With your POTS-like symptoms, a low or rapidly dropping systolic pressure when you stand can explain dizziness and fatigue.",
  },
  "diastolic bp": {
    what: "The bottom number in your blood pressure, measuring the pressure when your heart rests between beats.",
    matters: "A consistently low diastolic with symptoms can hint at dysautonomia. A consistently high one signals cardiovascular strain over time.",
  },
  "map non-invasive": {
    what: "Mean Arterial Pressure, the average pressure in your arteries during one heartbeat.",
    matters: "A more stable summary than systolic alone. Low MAP can leave organs and your brain underperfused, which fits with brain fog and lightheadedness.",
  },
  pulse: {
    what: "Your heart rate at the moment of measurement, in beats per minute.",
    matters: "Useful as a single snapshot, but standing-versus-supine pulse is what matters most for sorting out POTS-like symptoms.",
  },
  "peripheral pulse rate": {
    what: "Your heart rate measured at a peripheral artery (usually wrist or finger).",
    matters: "Useful as a single snapshot, but standing-versus-supine pulse is what matters most for sorting out POTS-like symptoms.",
  },
  "heart rate monitored": {
    what: "Your heart rate as recorded by a clinic monitor during a visit.",
    matters: "A single in-clinic reading does not capture the orthostatic pattern that drives your symptoms. Standing and supine pulses tell a fuller story.",
  },
  "standing pulse rate": {
    what: "Your heart rate after standing up for several minutes.",
    matters: "If this is more than 30 bpm above your supine pulse and you have symptoms, it points to POTS or related dysautonomia.",
  },
  "pulse oximetry": {
    what: "Blood oxygen saturation, the percentage of red blood cells carrying oxygen.",
    matters: "Above 95% is normal. Persistent dips below 92% during sleep can suggest sleep apnea or other airway issues.",
  },
  temperature: {
    what: "Your body temperature at the moment of measurement.",
    matters: "Useful for spotting infection. Subtle elevation also tracks with cycle phase after ovulation.",
  },
  bmi: {
    what: "Body Mass Index, weight in kilograms divided by height in meters squared.",
    matters: "A blunt screening tool that misses muscle mass and body composition. Useful only as one data point among many.",
  },

  // === STI / infection screens ===
  candida: {
    what: "A common yeast that lives in the body and can overgrow when the local environment shifts.",
    matters: "Recurrent yeast can hint at hormone shifts, antibiotic use, or immune changes. Worth tracking if it keeps coming back.",
  },
  gardnerella: {
    what: "A bacterium associated with bacterial vaginosis when the vaginal microbiome is out of balance.",
    matters: "Often treated even when symptoms are mild because untreated BV can raise the risk of other infections.",
  },
  trichomonas: {
    what: "A protozoan that causes a common sexually transmitted infection.",
    matters: "Easily treated once identified. Routine to screen for during reproductive health visits.",
  },
};

/**
 * Map a raw lab test name from the database to a dictionary slug.
 * Handles common variants and parenthetical suffixes like
 * "Hemoglobin (HGB)", "Vitamin D (25-OH)", and abbreviation-only names
 * like "HGB" or "PLT".
 */
export function normalizeLabTermSlug(testName: string): string {
  if (!testName) return "";
  const raw = testName.toLowerCase().trim();

  // Strip parenthetical suffixes for matching, then test both forms.
  const noParen = raw.replace(/\s*\([^)]*\)\s*/g, "").trim();

  // Common abbreviation aliases that don't match the dictionary keys directly.
  const aliasMap: Record<string, string> = {
    "hgb": "hemoglobin",
    "hct": "hematocrit",
    "plt": "platelets",
    "vitamin d (25-oh)": "vitamin d",
    "vitamin d 25-oh": "vitamin d",
    "vitamin b12 level": "vitamin b12",
    "iron level": "iron",
    "iron total": "iron",
    "transferrin level": "transferrin",
    "folate level": "folate",
    "folate serum": "folate",
    "co2/carbon dioxide": "co2",
    "bilirubin total": "bilirubin",
    "bilirubin, total": "bilirubin",
    "alkaline phosphatase": "alp",
    "glucose, random": "glucose",
  };

  if (aliasMap[raw]) return aliasMap[raw];
  if (aliasMap[noParen]) return aliasMap[noParen];

  // Try direct match on either the raw or paren-stripped form.
  if (EXPLAINERS[raw]) return raw;
  if (EXPLAINERS[noParen]) return noParen;

  return raw;
}

export function getExplainer(term: string): ExplainerEntry | undefined {
  if (!term) return undefined;
  const key = term.toLowerCase().trim();
  return EXPLAINERS[key];
}
