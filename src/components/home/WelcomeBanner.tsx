import Link from "next/link";

export function WelcomeBanner() {
  return (
    <div
      style={{
        margin: "0 16px",
        padding: 20,
        borderRadius: 16,
        background: "var(--bg-card)",
        border: "1px solid var(--accent-sage-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "var(--text-primary)",
          margin: "0 0 8px",
          lineHeight: 1.3,
        }}
      >
        Welcome to LanaeHealth!
      </h2>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Start by tapping the{" "}
        <Link
          href="/log"
          style={{
            fontWeight: 600,
            color: "var(--accent-sage)",
            textDecoration: "none",
          }}
        >
          + button
        </Link>
        {" "}to log how you are feeling today. Your health data from Oura Ring and Natural Cycles is
        already here.
      </p>
    </div>
  );
}
