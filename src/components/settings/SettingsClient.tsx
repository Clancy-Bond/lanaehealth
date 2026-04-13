"use client";

interface OuraTokenInfo {
  connected: boolean;
  expiresAt: string | null;
  updatedAt: string | null;
}

export function SettingsClient({ oura }: { oura: OuraTokenInfo }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Oura Connection Status */}
      <div className="card" style={{ padding: 16 }}>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "0 0 8px 0",
          }}
        >
          Oura Ring
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: oura.connected
                ? "var(--accent-sage)"
                : "var(--text-muted)",
            }}
          />
          <span
            style={{
              fontSize: 13,
              color: oura.connected
                ? "var(--accent-sage)"
                : "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            {oura.connected ? "Connected" : "Not connected"}
          </span>
        </div>
        {oura.updatedAt && (
          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              margin: "6px 0 0 0",
            }}
          >
            Last synced:{" "}
            {new Date(oura.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
