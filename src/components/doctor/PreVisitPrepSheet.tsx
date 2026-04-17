import type {
  PreVisitReportPayload,
  PreVisitSection,
  PreVisitClaim,
  SpecialtyBucket,
} from "@/lib/reports/pre-visit";
import { PreVisitPrintActions } from "./PreVisitPrintActions";

/**
 * Server-safe presentation of the pre-visit prep sheet. Uses warm-modern
 * tokens only. A @media print block hides all navigation and action
 * buttons so the page is clean when printed.
 *
 * Non-diagnostic framing: every claim carries a sourceRef tag the UI
 * surfaces in small monospace text beneath the value. No content is
 * fabricated; empty sections show explicit "no data yet" notes.
 */

interface Props {
  report: PreVisitReportPayload;
  today: string; // YYYY-MM-DD
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function specialtyLabel(bucket: SpecialtyBucket): string {
  switch (bucket) {
    case "obgyn":
      return "OB/GYN focus";
    case "cardiology":
      return "Cardiology focus";
    case "neurology":
      return "Neurology focus";
    case "pcp":
      return "Primary care focus";
    case "internal_medicine":
      return "Internal medicine focus";
    default:
      return "General focus";
  }
}

function emphasisColor(e: PreVisitClaim["emphasis"]): string {
  switch (e) {
    case "discuss":
      return "var(--accent-blush)";
    case "notable":
      return "var(--accent-sage)";
    default:
      return "var(--text-secondary)";
  }
}

export default function PreVisitPrepSheet({ report, today }: Props) {
  const {
    patient,
    appointment,
    lastVisit,
    sections,
    topPriorities,
    notes,
  } = report;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <div
        className="pre-visit-sheet"
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "24px 20px 80px",
        }}
      >
        {/* Header / print actions */}
        <header
          className="no-print"
          style={{ marginBottom: 20, display: "flex", justifyContent: "space-between" }}
        >
          <a
            href="/doctor"
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            &larr; Back to Doctor Mode
          </a>
          <PreVisitPrintActions />
        </header>

        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: "28px 28px 32px",
          }}
        >
          {/* Banner: identity + visit */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              borderBottom: "1px solid var(--border)",
              paddingBottom: 16,
              marginBottom: 24,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Pre-Visit Prep Sheet
              </h1>
              <p
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                  marginTop: 4,
                  marginBottom: 0,
                }}
              >
                {patient.name}
                {patient.age != null ? `, age ${patient.age}` : ""}
                {patient.sex ? `, ${patient.sex}` : ""}
              </p>
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  marginTop: 2,
                  marginBottom: 0,
                }}
              >
                Visit: {formatDate(appointment.date)}
                {appointment.specialty ? ` (${appointment.specialty})` : ""}
                {appointment.doctorName ? ` with ${appointment.doctorName}` : ""}
                {" \u2022 "}
                {specialtyLabel(appointment.specialtyBucket)}
                {" \u2022 "}
                Generated {formatDate(today)}
              </p>
              {appointment.reason && (
                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    marginTop: 4,
                    marginBottom: 0,
                  }}
                >
                  Reason on file: {appointment.reason}
                </p>
              )}
            </div>
          </div>

          {/* Top 3 priorities banner */}
          {topPriorities.length > 0 && (
            <section
              style={{
                borderRadius: "var(--radius-md)",
                background: "var(--accent-sage-muted)",
                border: "1px solid var(--accent-sage)",
                padding: "12px 14px",
                marginBottom: 24,
              }}
            >
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: 0,
                }}
              >
                Top 3 items to discuss
              </p>
              <ol
                style={{
                  margin: "6px 0 0 20px",
                  padding: 0,
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                  lineHeight: 1.6,
                }}
              >
                {topPriorities.map((c, i) => (
                  <li key={i}>
                    <strong>{c.label}:</strong> {c.value}{" "}
                    <SourceTag sourceRef={c.sourceRef} />
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Last visit context */}
          <section
            style={{
              marginBottom: 20,
              padding: "10px 12px",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-elevated)",
            }}
          >
            <p
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                margin: 0,
                letterSpacing: "0.05em",
              }}
            >
              Last visit
            </p>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
                margin: "4px 0 0 0",
              }}
            >
              {lastVisit.date
                ? `${formatDate(lastVisit.date)}${lastVisit.specialty ? ` (${lastVisit.specialty})` : ""}`
                : "No prior visit on record for this provider."}
            </p>
            {lastVisit.followUpDate && (
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  margin: "2px 0 0 0",
                }}
              >
                Follow-up noted for {formatDate(lastVisit.followUpDate)}
              </p>
            )}
          </section>

          {/* Sections */}
          {sections.map((section, i) => (
            <SectionView key={i} section={section} />
          ))}

          {/* Disclosure footer */}
          {notes.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                  fontStyle: "italic",
                  margin: 0,
                }}
              >
                {notes.join(" ")}
              </p>
            </section>
          )}

          <section style={{ marginTop: 20 }}>
            <p
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                lineHeight: 1.5,
                fontStyle: "italic",
                margin: 0,
              }}
            >
              This sheet is a summary of the data Lanae has logged. It is not
              a diagnosis and should not replace clinical judgment.
            </p>
          </section>
        </div>
      </div>

      <style>{`
        .pv-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: var(--text-sm);
        }
        .pv-table th {
          text-align: left;
          font-weight: 600;
          color: var(--text-secondary);
          padding: 6px 8px;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .pv-table td {
          padding: 6px 8px;
          border-bottom: 1px solid var(--border-light);
          color: var(--text-primary);
          vertical-align: top;
        }
        @media print {
          @page { margin: 14mm; }
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          nav[aria-label="Main navigation"] { display: none !important; }
          .pre-visit-sheet { padding: 0 !important; max-width: none !important; }
          .pre-visit-sheet > div {
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
          }
          section, table, tr, li { page-break-inside: avoid; }
          h2 { page-break-after: avoid; }
        }
      `}</style>
    </div>
  );
}

function SectionView({ section }: { section: PreVisitSection }) {
  return (
    <section style={{ marginTop: 20 }}>
      <h2
        style={{
          fontSize: "var(--text-lg)",
          fontWeight: 700,
          color: "var(--text-primary)",
          margin: 0,
          marginBottom: 4,
        }}
      >
        {section.title}
      </h2>
      {section.subtitle && (
        <p
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            margin: 0,
            marginBottom: 10,
          }}
        >
          {section.subtitle}
        </p>
      )}
      {section.claims.length === 0 ? (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          {section.emptyNote ?? "No data for this section yet."}
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 8,
          }}
        >
          {section.claims.map((claim, idx) => (
            <ClaimRow key={idx} claim={claim} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ClaimRow({ claim }: { claim: PreVisitClaim }) {
  return (
    <li
      style={{
        borderLeft: `3px solid ${emphasisColor(claim.emphasis)}`,
        padding: "6px 10px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 2,
        }}
      >
        {claim.label}
      </div>
      <div
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--text-primary)",
          lineHeight: 1.5,
        }}
      >
        {claim.value}
      </div>
      <SourceTag sourceRef={claim.sourceRef} />
    </li>
  );
}

function SourceTag({ sourceRef }: { sourceRef: string }) {
  return (
    <div
      style={{
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        fontSize: 11,
        color: "var(--text-muted)",
        marginTop: 2,
      }}
    >
      source: {sourceRef}
    </div>
  );
}
