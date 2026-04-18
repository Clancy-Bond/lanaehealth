/**
 * Cycle-phase guidance card for Home.
 *
 * Stardust / Flo both lean on phase-specific life recommendations.
 * Ours is clinical-adjacent: what to expect in this phase given
 * Lanae's conditions (POTS + migraine + endo overlap), and what to
 * actually do about it in nutrition / movement terms.
 *
 * No AI call; static copy keyed by phase. If phase is null (unknown
 * cycle state), the card doesn't render so it can't mislead.
 */

type Phase = "menstrual" | "follicular" | "ovulatory" | "luteal";

interface Props {
  phase: Phase | null;
  cycleDay: number | null;
}

const GUIDANCE: Record<Phase, { summary: string; nutrition: string; movement: string; symptomsToWatch: string[] }> = {
  menstrual: {
    summary:
      "Day 1-5. Estrogen and progesterone are at their lowest. POTS symptoms and migraines often peak here.",
    nutrition:
      "Iron-rich meals with vitamin C (spinach + citrus, red meat + peppers). Extra sodium still matters; do not skip electrolytes.",
    movement:
      "Gentle. Walks, stretching, restorative yoga. Save heavy-output days for later in the cycle.",
    symptomsToWatch: ["cramps", "migraine", "fatigue"],
  },
  follicular: {
    summary:
      "Day 6-13. Estrogen climbs. Energy and mood typically lift. Often the best window for pushing physical and cognitive load.",
    nutrition:
      "Balance of protein + complex carbs. Estrogen helps with iron absorption here; pair plants with vitamin C still.",
    movement:
      "Green light for strength, cardio, new routines. Your body is most adaptive to training load in this phase.",
    symptomsToWatch: ["sleep disruption", "breast tenderness"],
  },
  ovulatory: {
    summary:
      "Day 14-16. A short 2-3 day window. BBT rises 0.3-0.7 C. LH peaks.",
    nutrition:
      "Lots of vegetables for fiber (B-vitamins help estrogen clearance). Hydration up; higher core temp means more fluid need.",
    movement:
      "Peak output window. If you are going to PR a workout, it is this week.",
    symptomsToWatch: ["ovulation pain (mittelschmerz)", "cervical mucus changes"],
  },
  luteal: {
    summary:
      "Day 17-28. Progesterone-dominant. PMS signs cluster in the last 5-2 days. Salt retention and mood dips are common.",
    nutrition:
      "Up magnesium (dark chocolate, pumpkin seeds, greens). Complex carbs at dinner improve serotonin conversion and sleep. Keep sodium for POTS but watch sweet cravings spike.",
    movement:
      "Moderate. Strength still fine early; taper intensity in the last week. Listen to fatigue cues.",
    symptomsToWatch: ["bloating", "migraine (hormonal)", "mood lows", "breast tenderness"],
  },
};

export function PhaseGuidanceCard({ phase, cycleDay }: Props) {
  if (!phase) return null;
  const g = GUIDANCE[phase];
  const phaseLabel = phase.charAt(0).toUpperCase() + phase.slice(1);

  return (
    <div style={{ padding: "0 16px" }}>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          borderLeftWidth: 3,
          borderLeftStyle: "solid",
          borderLeftColor: phaseColor(phase),
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: phaseColor(phase),
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {phaseLabel} phase guidance
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {cycleDay !== null ? `Cycle day ${cycleDay}` : "Cycle day unknown"}
            </div>
          </div>
          <a
            href="/topics/cycle"
            style={{
              fontSize: 11,
              color: "var(--accent-sage)",
              textDecoration: "none",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            More &rarr;
          </a>
        </div>

        <p style={{ fontSize: 13, margin: 0, color: "var(--text-primary)", lineHeight: 1.5 }}>
          {g.summary}
        </p>

        <Row icon="\u{1F958}" label="Nutrition" body={g.nutrition} />
        <Row icon="\u{1F3C3}" label="Movement" body={g.movement} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            paddingTop: 4,
            borderTop: "1px solid var(--border-light)",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Watch for
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {g.symptomsToWatch.map((s) => (
              <span
                key={s}
                style={{
                  padding: "2px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 999,
                  background: "var(--bg-primary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-light)",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, body }: { icon: string; label: string; body: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 14, lineHeight: 1.4 }} aria-hidden>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function phaseColor(phase: Phase): string {
  switch (phase) {
    case "menstrual":
      return "var(--phase-menstrual)";
    case "follicular":
      return "var(--phase-follicular)";
    case "ovulatory":
      return "var(--phase-ovulatory)";
    case "luteal":
      return "var(--phase-luteal)";
  }
}
