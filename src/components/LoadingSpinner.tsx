/**
 * LoadingSpinner is misnamed at this point — it no longer spins. It now
 * renders a route-level shimmer + skeleton pair in the Warm Modern
 * vocabulary (see design-decisions.md §11 "Loading language").
 *
 * We keep the export name and default signature so the existing
 * app/**\/loading.tsx files keep working without touching four routes.
 */
export default function LoadingSpinner() {
  return (
    <div
      role="status"
      aria-label="Pulling your data"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        padding: "var(--space-4)",
        maxWidth: 640,
        marginLeft: "auto",
        marginRight: "auto",
        width: "100%",
      }}
    >
      {/* top-edge shimmer bar replaces the spinner */}
      <div className="shimmer-bar" aria-hidden="true" />

      {/* content skeletons in the rough shape of a typical route */}
      <div
        className="skeleton"
        style={{ height: 36, width: "60%" }}
        aria-hidden="true"
      />
      <div
        className="skeleton"
        style={{ height: 14, width: "40%", marginTop: "calc(var(--space-1) * -1)" }}
        aria-hidden="true"
      />

      <div
        className="skeleton"
        style={{ height: 88, width: "100%", borderRadius: "var(--radius-lg)" }}
        aria-hidden="true"
      />
      <div
        className="skeleton"
        style={{ height: 120, width: "100%", borderRadius: "var(--radius-lg)" }}
        aria-hidden="true"
      />
      <div
        className="skeleton"
        style={{ height: 72, width: "100%", borderRadius: "var(--radius-lg)" }}
        aria-hidden="true"
      />

      {/* screen-reader-only label so loading state is announced */}
      <span className="sr-only">One moment, pulling your data</span>
    </div>
  );
}
