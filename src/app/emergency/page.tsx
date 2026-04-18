/**
 * Emergency wallet card (Guava-pattern).
 *
 * Prints at credit-card size (3.375" x 2.125") with the most
 * critical info EMS or ER staff need when Lanae can't communicate:
 *   - Name, age, sex, blood type
 *   - POTS + active diagnoses (top 3)
 *   - Current medications (top 5)
 *   - Severe allergies
 *   - Emergency contacts
 *   - "If found" note
 *
 * Screen view shows the same card at 2x scale with a Print button
 * and instructions for folding.
 */

import { loadCareCardData } from "@/lib/care-card/load";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CARD_WIDTH_IN = 3.375;
const CARD_HEIGHT_IN = 2.125;

export default async function EmergencyPage() {
  const data = await loadCareCardData();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 16,
        maxWidth: 820,
        margin: "0 auto",
        paddingBottom: 96,
      }}
      className="emergency-screen"
    >
      <Link
        href="/"
        className="no-print"
        style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
      >
        &lsaquo; Home
      </Link>

      <div className="no-print">
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Emergency card
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, marginTop: 4 }}>
          Wallet card for EMS / ER
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, marginTop: 6, lineHeight: 1.5 }}>
          Print this at credit-card size (3.375" x 2.125"). Tip: on most
          browsers, select the card area, then Print -&gt; Selection only
          -&gt; scale to fit one page. Or print the whole page and cut
          out the card.
        </p>
        <button
          onClick={undefined}
          style={{
            display: "none",
          }}
        />
      </div>

      {/* Print trigger - form-button avoids needing client JS */}
      <div className="no-print" style={{ display: "flex", gap: 10 }}>
        <a
          href="javascript:window.print()"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            borderRadius: 10,
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          Print card
        </a>
        <Link
          href="/doctor/care-card"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            borderRadius: 10,
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            border: "1px solid var(--border-light)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          Full care card
        </Link>
      </div>

      {/* The wallet card */}
      <div className="wallet-card-container">
        <WalletCard data={data} />
      </div>

      <style>{`
        .wallet-card-container {
          display: flex;
          justify-content: center;
        }
        @media print {
          body {
            background: white !important;
          }
          .no-print,
          nav,
          header,
          footer {
            display: none !important;
          }
          .emergency-screen {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
          .wallet-card-container {
            width: ${CARD_WIDTH_IN}in !important;
            height: ${CARD_HEIGHT_IN}in !important;
            page-break-inside: avoid;
          }
          .wallet-card {
            transform: none !important;
            box-shadow: none !important;
            outline: 1px solid #333 !important;
          }
        }
        @page {
          size: letter;
          margin: 0.5in;
        }
      `}</style>
    </div>
  );
}

function WalletCard({ data }: { data: Awaited<ReturnType<typeof loadCareCardData>> }) {
  // Sort diagnoses so POTS is always first if present.
  const sortedDiagnoses = [...data.diagnoses].sort((a, b) => {
    const aIsPots = /POTS|postural/i.test(a) ? 0 : 1;
    const bIsPots = /POTS|postural/i.test(b) ? 0 : 1;
    return aIsPots - bIsPots;
  });

  return (
    <div
      className="wallet-card"
      style={{
        width: `${CARD_WIDTH_IN * 2}in`,
        height: `${CARD_HEIGHT_IN * 2}in`,
        padding: "0.12in",
        background: "linear-gradient(135deg, #FAFAF7 0%, #F5F1E8 100%)",
        border: "1.5px solid var(--accent-sage)",
        borderRadius: 8,
        boxShadow: "var(--shadow-md)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "auto 1fr auto",
        gap: "0.06in",
        fontSize: 9,
        lineHeight: 1.2,
        color: "var(--text-primary)",
      }}
    >
      {/* Header spanning both columns */}
      <div
        style={{
          gridColumn: "1 / 3",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderBottom: "1px solid var(--accent-sage)",
          paddingBottom: 4,
        }}
      >
        <div>
          <div style={{ fontSize: 7, fontWeight: 700, color: "var(--accent-sage)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Emergency medical card
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 1 }}>{data.patient.name}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 8 }}>
          {data.patient.age !== null && (
            <div>
              <strong>{data.patient.age}</strong> yo
              {data.patient.sex ? ` ${data.patient.sex.slice(0, 1)}` : ""}
            </div>
          )}
          {data.patient.bloodType && (
            <div>
              Blood <strong>{data.patient.bloodType}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Left column: diagnoses + allergies */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Section label="Diagnoses">
          {sortedDiagnoses.slice(0, 3).map((d, i) => (
            <div key={i} style={{ fontWeight: /POTS|postural/i.test(d) ? 700 : 500 }}>
              {d}
            </div>
          ))}
        </Section>
        {data.allergies.length > 0 && (
          <Section label="Allergies" accent="var(--accent-blush)">
            {data.allergies.slice(0, 5).map((a, i) => (
              <div key={i} style={{ fontWeight: 600 }}>
                {a}
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* Right column: meds + emergency notes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Section label="Current meds">
          {data.medications.slice(0, 5).map((m, i) => (
            <div key={i} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong>{m.name}</strong>
              {m.dose ? ` ${m.dose}` : ""}
            </div>
          ))}
        </Section>
        {data.emergencyNotes.length > 0 && (
          <Section label="Emergency notes" accent="var(--accent-blush)">
            {data.emergencyNotes.slice(0, 2).map((n, i) => (
              <div key={i}>{n}</div>
            ))}
          </Section>
        )}
      </div>

      {/* Footer spanning both columns */}
      <div
        style={{
          gridColumn: "1 / 3",
          borderTop: "1px solid var(--border-light)",
          paddingTop: 3,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 7,
          color: "var(--text-muted)",
        }}
      >
        <span>If found: return to owner.</span>
        <span>LanaeHealth emergency card</span>
      </div>
    </div>
  );
}

function Section({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 6.5,
          fontWeight: 800,
          color: accent ?? "var(--accent-sage)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 1,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 8.5, lineHeight: 1.25 }}>{children}</div>
    </div>
  );
}
