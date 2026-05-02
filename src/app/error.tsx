"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  // Prod responses must NOT show the underlying error message; Postgres /
  // Supabase errors leak schema details (column / constraint / table names)
  // and Next.js stack frames leak source paths. In dev, surface the message
  // for debugging.
  const isDev = process.env.NODE_ENV !== "production";
  const message = isDev && error.message
    ? error.message
    : "An unexpected error occurred.";

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="card p-6 max-w-md text-center">
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Something went wrong
        </h2>
        <p
          className="text-sm mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          {message}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: "var(--accent-sage)" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
