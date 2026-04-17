export default function Loading() {
  return (
    <div
      className="px-4 pt-6 pb-safe route-desktop-wide"
      style={{ maxWidth: 640, margin: "0 auto" }}
    >
      <h1 className="page-title">Settings</h1>
      <p
        className="mt-1 mb-4 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        Connections, data, and app info
      </p>
      <div className="shimmer-bar" style={{ height: 1, marginBottom: 12 }} />
      <div className="space-y-4">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 140, borderRadius: 16 }}
          />
        ))}
      </div>
    </div>
  );
}
