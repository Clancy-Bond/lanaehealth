/**
 * FDA-style "Nutrition Facts" card - MFN Food Entry parity.
 *
 * Reference:
 * s3.amazonaws.com/img.mynetdiary.com/help/web/web_full_screen_food_entry.jpg
 *
 * Renders the canonical FDA nutrition label layout used on MyNetDiary's
 * Food Entry page - serving size, bolded Calories, macros + micros
 * with % Daily Value column, thick horizontal rules between sections,
 * and a small grade pill in the top-right corner.
 *
 * % Daily Value is computed against the 2,000 kcal FDA reference diet
 * (same default MFN uses unless the user opts into personal targets).
 */

// FDA % Daily Value targets (2,000 kcal reference diet).
const DV = {
  totalFat: 78,       // g
  satFat: 20,         // g
  cholesterol: 300,   // mg
  sodium: 2300,       // mg
  totalCarbs: 275,    // g
  fiber: 28,          // g
  protein: 50,        // g
  calcium: 1300,      // mg
  iron: 18,           // mg
  potassium: 4700,    // mg
  magnesium: 420,     // mg
  zinc: 11,           // mg
  vitaminC: 90,       // mg
  vitaminD: 20,       // mcg
  vitaminB12: 2.4,    // mcg
  folate: 400,        // mcg
};

function pctDV(value: number | null | undefined, target: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const pct = Math.round((value / target) * 100);
  return `${pct}%`;
}

function fmtG(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${Number(value.toFixed(digits))}g`;
}

function fmtMg(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${Math.round(value)}mg`;
}

export interface FdaNutritionFactsProps {
  servingLabel: string;
  calories: number | null;
  totalFat: number | null;
  satFat: number | null;
  transFat: number | null;
  sodium: number | null;
  totalCarbs: number | null;
  fiber: number | null;
  sugar: number | null;
  protein: number | null;
  iron: number | null;
  calcium: number | null;
  vitaminC: number | null;
  vitaminD: number | null;
  potassium: number | null;
  gradeLetter?: string;
}

export function FdaNutritionFacts(props: FdaNutritionFactsProps) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid var(--text-primary)",
        borderRadius: 4,
        padding: "10px 14px",
        fontFamily:
          "'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', sans-serif",
        color: "var(--text-primary)",
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "8px solid var(--text-primary)",
          paddingBottom: 4,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>
          Nutrition Facts
        </span>
        {props.gradeLetter && (
          <span
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              marginLeft: 8,
            }}
            title="Food Grade"
          >
            <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              grade
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "var(--accent-blush)",
                lineHeight: 1,
              }}
            >
              {props.gradeLetter}
            </span>
          </span>
        )}
      </div>

      <Row label="Serving Size" value={props.servingLabel} rightBold />
      <Divider />
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>
        Amount per serving
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderBottom: "4px solid var(--text-primary)",
          paddingBottom: 4,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 900 }}>Calories</span>
        <span style={{ fontSize: 28, fontWeight: 900 }}>
          {props.calories !== null ? Math.round(props.calories) : "-"}
        </span>
      </div>

      <div
        style={{
          textAlign: "right",
          fontSize: 10,
          color: "var(--text-secondary)",
          marginBottom: 4,
        }}
      >
        % Daily Value*
      </div>

      <FactRow label={<><b>Total Fat</b> {fmtG(props.totalFat, 1)}</>} pct={pctDV(props.totalFat, DV.totalFat)} />
      <FactRow
        label={<>&nbsp;&nbsp;&nbsp;Saturated Fat {fmtG(props.satFat, 1)}</>}
        pct={pctDV(props.satFat, DV.satFat)}
      />
      {props.transFat !== null && (
        <FactRow
          label={<>&nbsp;&nbsp;&nbsp;Trans Fat {fmtG(props.transFat, 2)}</>}
          pct=""
        />
      )}
      <FactRow label={<><b>Sodium</b> {fmtMg(props.sodium)}</>} pct={pctDV(props.sodium, DV.sodium)} />
      <FactRow
        label={<><b>Total Carbohydrate</b> {fmtG(props.totalCarbs, 1)}</>}
        pct={pctDV(props.totalCarbs, DV.totalCarbs)}
      />
      <FactRow
        label={<>&nbsp;&nbsp;&nbsp;Dietary Fiber {fmtG(props.fiber, 1)}</>}
        pct={pctDV(props.fiber, DV.fiber)}
      />
      {props.sugar !== null && (
        <FactRow
          label={<>&nbsp;&nbsp;&nbsp;Total Sugars {fmtG(props.sugar, 1)}</>}
          pct=""
        />
      )}
      <FactRow label={<><b>Protein</b> {fmtG(props.protein, 1)}</>} pct={pctDV(props.protein, DV.protein)} />

      <div style={{ borderTop: "4px solid var(--text-primary)", margin: "4px 0" }} />

      {props.vitaminD !== null && (
        <FactRow label={<>Vitamin D {Number(props.vitaminD.toFixed(1))}mcg</>} pct={pctDV(props.vitaminD, DV.vitaminD)} />
      )}
      {props.calcium !== null && (
        <FactRow label={<>Calcium {fmtMg(props.calcium)}</>} pct={pctDV(props.calcium, DV.calcium)} />
      )}
      {props.iron !== null && (
        <FactRow label={<>Iron {Number(props.iron.toFixed(1))}mg</>} pct={pctDV(props.iron, DV.iron)} />
      )}
      {props.potassium !== null && (
        <FactRow label={<>Potassium {fmtMg(props.potassium)}</>} pct={pctDV(props.potassium, DV.potassium)} />
      )}
      {props.vitaminC !== null && (
        <FactRow label={<>Vitamin C {Number(props.vitaminC.toFixed(1))}mg</>} pct={pctDV(props.vitaminC, DV.vitaminC)} />
      )}

      <p style={{ fontSize: 10, color: "var(--text-secondary)", margin: "10px 0 0", lineHeight: 1.4 }}>
        * The % Daily Value tells you how much a nutrient in a serving
        of food contributes to a daily diet. 2,000 calories a day is
        used for general nutrition advice.
      </p>
    </div>
  );
}

function FactRow({ label, pct }: { label: React.ReactNode; pct: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--text-primary)",
        padding: "4px 0",
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 700 }}>{pct}</span>
    </div>
  );
}

function Row({
  label,
  value,
  rightBold = false,
}: {
  label: string;
  value: string;
  rightBold?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
      <span>{label}</span>
      <span style={{ fontWeight: rightBold ? 700 : 400 }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid var(--text-primary)", margin: "4px 0" }} />;
}
