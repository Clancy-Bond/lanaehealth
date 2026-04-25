# Natural Cycles Methodology Research

Research compiled 2026-04-23 via Firecrawl over Natural Cycles' official help center, peer-reviewed publications (PubMed / ScienceDirect / Taylor & Francis), and their Cycle Matters blog. Every factual claim below is sourced; URLs and short excerpts are listed in the Sources section.

---

## The Core Algorithm

NC classifies every calendar day into one of two states for the birth-control product (and a third "more data needed" state for the plan-pregnancy product):

| State | Color | Meaning | Default? |
|---|---|---|---|
| Fertile | Red | "Use protection or abstain." May be fertile. | Yes — default state when uncertain. |
| Not fertile | Green | Algorithm has positive evidence the user is not fertile this day. | No — earned only with sufficient data. |
| More data needed | Brown | Plan Pregnancy mode only. Algorithm cannot decide. | n/a for Birth Control. |

The conservative default is structural: "**The algorithm defaults to giving Red Days if there is not enough information to confirm that you're not fertile.**" (How NC Works). A Green Day is only assigned when the algorithm can affirmatively prove one of two things:

1. **You have already ovulated this cycle** (confirmed via sustained BBT rise), so the egg is no longer viable, OR
2. **You are unlikely to ovulate within the next 5 days**, accounting for the 5-day sperm survival window (How NC Works; Trust Green Days).

The biological "fertile window" the algorithm covers is 6 days per cycle (5 days before ovulation + ovulation day, since sperm survive up to 5 days and the egg survives ≤24 hours). However, NC° Birth Control users typically receive **more than 6 Red Days** to absorb day-to-day ovulation variance — example given in NC's docs is 9 Red Days for a typical cycle (How NC Works).

Each daily status is **valid only midnight-to-midnight** and can change retroactively within the same day if new data is logged. Users are explicitly told not to rely on yesterday's color or on the prediction calendar — only the live status on the Today screen (Red/Green Days; Trust Green Days).

The "yellow day" some other FAB methods use is **not part of NC**. NC is binary (Red/Green) for Birth Control. The third color (Brown) only exists in NC° Plan Pregnancy and means "more data needed."

---

## BBT Cover Line Detection

NC's "cover line" is a single horizontal line drawn on the user's temperature graph; it represents the **average of all the user's temperature points across cycles, weighted by phase averages and variance** within the follicular and luteal phases (Cover Line). It is not a fixed clinical threshold like the older Marquette / WHO methods — it is a personal, continuously-updated baseline.

Key mechanics from NC's docs:

- **It can take "a few days up to a full cycle" to appear** when a new user starts logging temperatures (Cover Line).
- **It resets when a user changes measuring devices** (e.g., switching from oral thermometer to Oura Ring) because absolute values differ between devices. The algorithm rebuilds it (Cover Line).
- The follicular-phase average across NC's user base is **36.23 °C / 97.21 °F**, and the luteal-phase average is **36.58 °C / 97.84 °F** — a population-average shift of ~0.35 °C, but each user has their own baseline (How NC Works).
- The expected post-ovulation BBT rise is **0.25–0.45 °C (0.4–0.8 °F)** per the How-it-Works page, summarized as "on average, a rise of 0.3 °C or 0.5 °F" per the Ovulation Detection page (How NC Works; Ovulation Detection).
- For ovulation **confirmation**, NC says it "usually requires **2-4 higher values** before ovulation can be confirmed" — looser than the textbook three-over-six rule (Ovulation Detection).

Crucially, NC does NOT make the decision off any single temperature value: "It will **not look at individual temperature values** since a single data point can fluctuate for many reasons … Many factors, weights, and parameters are used in this statistical analysis" (Ovulation Detection). The algorithm also has temperature-exclusion logic that can drop outliers automatically.

NC asks for temperature on **at least 5 of 7 days per week (~70%)**. Missing a day "does not impact effectiveness" but does increase the number of Red Days (How NC Works).

---

## LH Test Integration

LH (luteinizing hormone) tests are **optional but boost performance**. Concretely:

- **Logging a positive LH test "may result in roughly 5% more Green Days"** for Birth Control users (LH Tests).
- LH peaks **roughly 48 hours before ovulation**; a positive test means ovulation may be imminent but is not confirmation (Fertility Indicators; LH Tests).
- A positive LH test alone is **never sufficient for confirmation** — it must be followed by elevated temperatures (LH Tests; LH Influence).
- Negative LH tests do not influence ovulation detection at all (LH Influence).
- **Temperature always wins conflicts.** "If you logged a positive ovulation test on CD10 and your temperature only increased from CD18, the algorithm might place ovulation around CD18, even if that was more than two days after the logged positive ovulation test" (LH Influence).
- LH can override temperature in only one narrow case: when temperature data is missing or fluctuating around the suspected ovulation day, the algorithm "will give more importance to the ovulation test results as long as an overall temperature shift is detected" (LH Influence).
- **PCOS exception:** LH testing is NOT recommended for users with PCOS because false LH peaks (LH rises that don't actually trigger egg release) are common and would mislead the algorithm (LH Influence).

This is asymmetric integration: LH tightens the prediction window before ovulation and helps pinpoint the exact ovulation day, but it never substitutes for the BBT confirmation that the fertile window has closed.

---

## Learning Period

NC publishes a clear, modest learning period: **"1-3 cycles"** for the algorithm to get to know the user (Learning Period).

- The product is **"effective from day one"** — there is no minimum monitoring period before users can rely on Green Days (Learning Period; Research Compare).
- During the learning period the user receives **more Red Days, not Yellow / "use caution" days**. The conservative default never relaxes — it just gives more Green Days as it learns.
- The very first Green Day a user ever sees is "trustable, as long as you see it on the Today view" (Trust Green Days).
- Predictions (the calendar view) are explicitly **not trustable** until ovulation in the current cycle is confirmed; users must re-check Today every day (Predictions).

What slows the learning period:

- Recently quitting hormonal birth control (first ovulation may not happen for "a couple of months") (Learning Period; Many Red Days)
- Irregular cycles (defined by NC as <21 days or >35 days, or large cycle-to-cycle variance) (Learning Period)
- PCOS, endometriosis, hypothyroidism (Learning Period)
- Inconsistent temperature logging or device switching

Predictions become "increasingly personalized" with each cycle but the binary fertility status logic does not change with tenure — the same proof requirement applies on day one and on day 1,000.

---

## Cycle Length Variance Handling

NC adapts to variance in three ways:

1. **Buffer of Red Days before predicted ovulation.** Size of the buffer scales with (a) how many cycles of data the algorithm has and (b) cycle-to-cycle ovulation-day variance for that user. Newer or more-variable users get larger buffers (Ovulation Detection; Many Red Days).

2. **Period prediction is recomputed mid-cycle.** Initially the algorithm uses average ovulation day + average luteal phase length. Once ovulation is detected in the current cycle, it switches to detected_ovulation_date + average_luteal_phase_length. The luteal phase is "rather stable from cycle to cycle" so this mid-cycle update is meaningful (Period Prediction).

3. **Retroactive ovulation-day adjustment.** When the next period actually starts, the algorithm can move the prior cycle's ovulation day back by `actual_period_start - average_luteal_phase`. This means past Red/Green Days can change retroactively (Ovulation Detection: "Can the algorithm move my ovulation?").

NC defines "irregular" as cycles <21 or >35 days, or large variance between consecutive cycles. Irregular users **can use the app**, but get more Red Days (Learning Period; Many Red Days). Their published research data was collected from real users including those with cycle variance.

---

## Anovulatory Cycle Detection

Definition NC uses: an anovulatory cycle is one where temperature stays below the cover line for the entire cycle (Anovulatory).

Detection rules:

- **Anovulation can only be confirmed in retrospect** — once the cycle has ended (period entry logged) (Anovulatory).
- Until the cycle ends, the user receives Red Days continuously, because ovulation could still occur late.
- NC distinguishes two failure states:
  - **"No ovulation"** = positive determination that the cycle was anovulatory (temp never rose).
  - **"Ovulation not confirmed"** = algorithm ran out of data (e.g., user logged <5 temps/week or temperatures were too noisy). This does NOT mean anovulation occurred (Anovulatory).
- After an anovulatory cycle, the next cycle starts with Red Days from CD1 until ovulation is confirmed or the cycle ends, because timing of next ovulation becomes less predictable (Anovulatory).
- Users get an in-app message when an anovulatory cycle is detected, plus a graph icon "(i) No ovulation" (Anovulatory).
- Bleeding at the end of an anovulatory cycle (technically estrogen-withdrawal bleeding, not a true period) should still be logged as Period to mark the new cycle start (Anovulatory).

Causes flagged in copy: recent hormonal contraception, stress, travel, medication, lifestyle changes, perimenopause, PCOS (Anovulatory).

---

## Published Effectiveness Numbers

For credibility framing rather than algorithm behavior:

- **NC° Birth Control: 93% effective with typical use, 98% effective with perfect use** (How NC Works; Effectiveness page).
- Pearl Index (typical use): **6.9 pregnancies per 100 woman-years** in the original 4,054-user retrospective study (Berglund Scherwitzl et al., 2016; PMID 27003381). Update study found 7.0 (Berglund Scherwitzl et al., 2017; PMID 28882680).
- Pearl Index (perfect use): **0.5** (PMID 27003381).
- Wrong-Green-Day rate (a Green Day given inside the actual fertile window): **0.12% with BBT only, 0.07% with BBT + LH** averaged over 12 cycles. By comparison, Standard Days Method has a 13.01% wrong-green-day rate on the day of ovulation (PMID 31738859 / Research Compare).
- Total Green Days delivered: **44% in cycle 1 (BBT only), rising to 57% by cycle 12; 49% in cycle 1 with LH, rising to 61% by cycle 12** (Research Compare).
- Cleared by FDA in 2018 as the first FDA-cleared software-only contraceptive (per Forbes profile; secondary source).

These numbers anchor scope: NC is presenting a binary classifier with explicit precision/recall trade-offs, and they publish both.

---

## NC Voice & Tone Patterns

Reading across help-center articles and Cycle Matters blog posts, NC's writing has consistent patterns worth mirroring:

**Tone characteristics:**
- Calm, second-person, declarative. Few hedges in core algorithm explanations; many hedges around the user's own variability ("every cycle is unique").
- Honest about uncertainty without being alarming. Default disclosures: "predictions may change," "your fertility status can change at any time if you add new data," "check the Today screen each day."
- Reframes negative framing as positive ownership: "you'll get more Red Days at first" is paired with "this is because the algorithm doesn't know your cycle yet — you can speed this up by logging consistently."
- Almost never blames the user for missing data. Phrases like "it's okay if you miss a day here and there" reduce anxiety.
- **Education before action.** Each algorithm-related help page begins with a definition of the underlying biology before describing what NC does with it.

**Structural patterns:**
- Opens with a "Key takeaways" bullet block (3 bullets, ~15 words each) on most explainer pages.
- Plain-language section headers phrased as user questions ("Why do I get so many Red Days?", "Can I trust my Green Days?")
- Always defines the difference between similar concepts ("anovulatory" vs. "ovulation not confirmed"; "period" vs. "spotting"; "Red Day" vs. "fertile window"; "prediction" vs. "today's status").
- Uses inline citations with [bracketed numbers] in blog posts (Cycle Matters), and links the underlying Cycle Matters article from the help center for deeper dives.
- Author byline + fact-checker byline (often a data scientist) on blog posts. Mathematical/scientific content is co-signed.
- Footer disclaimer on every clinical article: "This information is provided for educational purposes only and is not intended to replace the advice of your healthcare professional."

**Word choices that recur:**
- "Cyclers" (their term for users)
- "Get to know your cycle" (always personifies the algorithm as a learner)
- "Let the algorithm do the work" / "takes the guesswork out"
- "Hormone-free" (strong brand value)
- "Backed by science"
- "Fertile window" (never "danger days" or similar)
- Cycle Day abbreviated as "CD18" in technical contexts

---

## What NC Does NOT Do

Useful for scope discipline:

- **Does NOT use cervical mucus in the algorithm.** Users can log it as a tracker for self-knowledge, but the algorithm ignores it. Reasoning: "subjective and may lead to user error" (Cervical Mucus; Fertility Indicators).
- **Does NOT use cervix position, sex drive, mood, skin, sleep, lifestyle, pain, or any other tracker** in the fertility algorithm. These are all logged for personal pattern-finding only (Data Logged).
- **Does NOT predict the period ahead of detected ovulation in the current cycle** with high confidence. The first prediction is generic averages; it sharpens once ovulation is detected (Period Prediction).
- **Does NOT predict periods or ovulation as a "calendar method."** They explicitly contrast themselves with the Rhythm Method and Standard Days Method, which assume fixed timing (Research Compare).
- **Does integrate with Oura Ring, Apple Watch, NC° Band** (proprietary continuous wearable) and basal thermometers (How NC Works; Data Logged). Apple Watch and Oura use overnight skin temperature trends, not classical BBT, but NC processes them through device-specific calibration.
- **Does predict period flow if the user tracks it, predict PMS if logged, recommend optimal LH-test days, recommend optimal pregnancy-test days** (Plan Pregnancy mode) (Predictions).
- **Does NOT diagnose conditions.** Anovulation detection is informational; "if you notice that a lot of your cycles are detected as anovulatory … reach out to your healthcare professional" (Anovulatory).
- **Does NOT do any social / community features in the algorithm.** Doctor sharing exists in some markets but is downstream.

The algorithmic surface is narrow on purpose: temperature + period + (optional) LH + (optional) sex/contraception/pregnancy-test results. Everything else is journaling.

---

## Sources

Each source URL is followed by a brief excerpt or note about what specifically was cited.

### Natural Cycles official help center

- **How NC Works:** https://help.naturalcycles.com/hc/en-us/articles/360003306893-How-Natural-Cycles-works
  > "The algorithm defaults to giving Red Days if there is not enough information to confirm that you're not fertile." Population averages: follicular 36.23°C, luteal 36.58°C, ovulation CD18.

- **Red and Green Days:** https://help.naturalcycles.com/hc/en-us/articles/360003339574-What-are-Red-and-Green-Days
  > "Red Days will be displayed by a red circle, and the words Use Protection on the Today view." "Six days per cycle … plus some additional days to account for possible variation."

- **Trust Green Days:** https://help.naturalcycles.com/hc/en-us/articles/360019626298-Can-I-trust-my-Green-Days
  > "You can trust the very first Green Day you are given as long as you see it on the Today view."

- **Cover Line:** https://help.naturalcycles.com/hc/en-us/articles/4409027575185-What-is-the-cover-line
  > "The cover line represents the average of all your temperature points throughout your cycles. It also takes into account the average temperature and variations in the two phases of your cycle."

- **Ovulation Detection:** https://help.naturalcycles.com/hc/en-us/articles/360003335494-How-Natural-Cycles-detects-ovulation
  > "Usually, the algorithm requires 2-4 higher values before ovulation can be confirmed." "It will not look at individual temperature values since a single data point can fluctuate for many reasons."

- **Anovulatory Cycles:** https://help.naturalcycles.com/hc/en-us/articles/360003362933-How-Natural-Cycles-detects-anovulatory-cycles
  > "The NC° algorithm will only be able to confirm that a cycle was anovulatory once the cycle has ended (with a period entry)."

- **Fertility Indicators:** https://help.naturalcycles.com/hc/en-us/articles/360003287314-Which-fertility-indicators-does-Natural-Cycles-use
  > "Natural Cycles uses primarily body temperature, supported by optional ovulation test results … cervical mucus … not used by the NC° algorithm."

- **Predictions:** https://help.naturalcycles.com/hc/en-us/articles/360003330054-What-are-predictions
  > "You can't use your predictions as a definitive result because predictions are subject to change."

- **Period Prediction:** https://help.naturalcycles.com/hc/en-us/articles/11832827233565-How-Natural-Cycles-predicts-your-next-period
  > "Once ovulation has been detected … the algorithm will consider your ovulation date and your average luteal phase length."

- **LH Tests (overview):** https://help.naturalcycles.com/hc/en-us/articles/360003363273-Why-should-I-take-ovulation-tests
  > "NC° Birth Control users get roughly 5% more Green Days in cycles with positive ovulation tests recorded."

- **LH Influence on Detection:** https://help.naturalcycles.com/hc/en-us/articles/11833294713501-How-do-ovulation-test-results-influence-ovulation-detection
  > "The algorithm will always prioritize temperature data over ovulation test data, particularly if these give conflicting information." PCOS warning: false LH peaks.

- **Learning Period:** https://help.naturalcycles.com/hc/en-us/articles/360003313193-How-long-will-it-take-for-the-algorithm-to-get-to-know-my-cycle
  > "Generally speaking, it takes the algorithm 1-3 cycles to get to know your cycle."

- **Why So Many Red Days:** https://help.naturalcycles.com/hc/en-us/articles/360003363813-Why-do-I-get-so-many-Red-Days
  > "For your own safety, Red Days are given if there is a chance — however small — that you may be fertile that day." Defines irregular cycles.

- **Cervical Mucus:** https://help.naturalcycles.com/hc/en-us/articles/360003742618-What-is-cervical-mucus-and-how-can-I-track-it
  > "Even if cervical mucus can be a fertility indicator, the Natural Cycles algorithm doesn't take it into account when calculating your fertility."

- **Data Logged:** https://help.naturalcycles.com/hc/en-us/articles/11916528483741-What-data-can-I-log-using-NC-Birth-Control
  > Algorithm-considered data: temperature, period, LH tests, EC pill, pregnancy tests. Other trackers (sex drive, skin, pain, sleep, lifestyle, mood, notes) are NOT used by the algorithm.

- **Effectiveness:** https://help.naturalcycles.com/hc/en-us/articles/360003339534-How-effective-is-Natural-Cycles-as-birth-control
  > "NC° Birth Control is 93% effective with typical use and 98% effective with perfect use."

### Peer-reviewed publications (primary sources)

- **Berglund Scherwitzl et al., 2016 — Original fertility-awareness app paper:** https://pubmed.ncbi.nlm.nih.gov/27003381/
  > "Pearl Index of 7.0 for typical use … perfect-use Pearl Index of 0.5 … 4054 women … 2085 woman-years."

- **Berglund Scherwitzl et al., 2017 — Pearl Index update:** https://pubmed.ncbi.nlm.nih.gov/28882680/ and https://www.sciencedirect.com/science/article/pii/S0010782417304298
  > "Typical-use Pearl Index 7.0 pregnancies per 100 woman-years."

- **Favaro et al., 2019 — Fertile-window comparison vs. Rhythm and Standard Days Methods:** https://pubmed.ncbi.nlm.nih.gov/31738859/
  > "Natural Cycles' algorithms allocated 59% Green Days (LH, BBT) in cycle 12, while the fraction of wrong Green Days averaged 0.08%." "The probabilities of WGDs on the day before ovulation … 0.31% (BBT) and 0% (LH, BBT)."

- **Bull et al., 2019 (PMC):** https://pmc.ncbi.nlm.nih.gov/articles/PMC6475236/ (linked but content was thin in scrape; cited via the search snippet for the "shifting usage from less effective methods" framing.)

### NC Research Library (their own summary of peer-reviewed work)

- **NC vs. calendar-based methods:** https://www.naturalcycles.com/research-library/how-does-natural-cycles-compare-to-calendar-based-methods
  > Published-research summary in NC's own voice — useful both as a fact source (sample sizes, percentages) and as a tone reference. Author byline: Freya Eriksson, Customer Support.

### NC Cycle Matters blog (tone reference)

- **Basal Body Temperature:** https://www.naturalcycles.com/cyclematters/what-is-basal-body-temperature
  > Long-form blog: "Key takeaways" intro, expert-written, fact-checked by data scientist Agathe van Lamsweerde. 13-min read. Inline numbered citations [1] through [10].

### Secondary sources

- **Forbes profile:** https://www.forbes.com/sites/geristengel/2025/08/18/natural-cycles-and-the-rise-of-hormone-free-birth-control/
  > FDA clearance context, founder background. Used as secondary source only.

- **SOGC position statement (Society of Obstetricians and Gynaecologists of Canada):** https://www.sogc.org/common/Uploaded%20files/Position%20Statements/SRH%20Committee%20Opinion%20on%20the%20Natural%20Cycles%20App%20as%20a%20Method%20of%20Contraception_240515_EN.pdf
  > Independent perspective on classification of NC as a fertility-awareness method; useful for outside-view scoping.
