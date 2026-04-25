// ARCHIVED: This legacy route is now redirected to /v2/today via next.config.ts.
// Kept in source for fast revert. To revive: remove the redirect in next.config.ts.
// Cutover landed: 2026-04-25 (legacy → v2 unified merge).

/**
 * /today is the canonical daily-log route. It renders the same page as /log
 * until the deeper section-consolidation refactor lands. Re-exporting from
 * /log keeps us on one source of truth; the rename is a surface change
 * that lets the Quick-add sheet and in-app nav use the name that matches
 * how users think about it ("log today's check-in"). /log continues to
 * resolve so older bookmarks and deep links do not 404.
 *
 * Next.js does not allow re-exporting route segment config fields like
 * `dynamic`, so we declare it inline and re-export the page component.
 */
import LogPage from "../log/page";

export const dynamic = "force-dynamic";

export default LogPage;
