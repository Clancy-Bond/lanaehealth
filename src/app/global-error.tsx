"use client";

// Root-level error boundary. Required by Sentry for capturing errors that
// happen in the root layout itself (where the regular `error.tsx` boundary
// cannot reach). This file replaces the entire HTML document when triggered,
// so it must include <html> and <body>.

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        {/* NextError is the Next.js default 500 page. We render it so the
            user always sees something, even when the entire layout crashed. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
