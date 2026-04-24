"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Production-safe error boundary. In dev we surface the real message so
// engineers can debug; in production we show only a generic message plus
// Next.js's error digest, which maps back to server logs without leaking
// stack traces or internal identifiers to the browser.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Forward to Sentry so we hear about production errors without waiting
    // for a user report. The PHI scrubber strips sensitive fields before
    // events leave the process (see src/lib/observability/sentry-scrubber.ts).
    Sentry.captureException(error);
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  const shownMessage =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred."
      : error.message || "An unexpected error occurred.";

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
          {shownMessage}
        </p>
        {error.digest && (
          <p
            className="text-xs mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Reference: {error.digest}
          </p>
        )}
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
