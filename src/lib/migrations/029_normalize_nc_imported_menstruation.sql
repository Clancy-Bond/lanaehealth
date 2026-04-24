-- 029_normalize_nc_imported_menstruation.sql
--
-- Backfill nc_imported.menstruation for rows where Natural Cycles populated
-- flow_quantity (HEAVY / MEDIUM / LIGHT) but left menstruation NULL. Without
-- this fix, any caller filtering on menstruation = 'MENSTRUATION' silently
-- drops those periods. The shared cycle-day helper had a tactical patch
-- (current-day.ts:140-144) to fall back to flow_quantity, but other readers
-- (correlations, intelligence engine, exports) still see the gap.
--
-- Safety: this UPDATE is intentionally narrow and idempotent.
--   * Only rows where the menstruation column is NULL or empty are touched.
--   * Only rows where flow_quantity is non-null and matches a real-flow
--     value are touched. SPOTTING / NONE / UNCATEGORIZED stay untagged
--     because they are NOT menstruation, and a previously stored explicit
--     SPOTTING tag is preserved.
--   * No data is overwritten; the WHERE clause guarantees we only ever
--     fill in NULLs.
--
-- Authorized by user as a data-correctness critical fix
-- (CLAUDE.md, 2026-04-23).

UPDATE nc_imported
SET menstruation = 'MENSTRUATION'
WHERE flow_quantity IS NOT NULL
  AND UPPER(TRIM(flow_quantity)) IN ('HEAVY', 'MEDIUM', 'LIGHT')
  AND (menstruation IS NULL OR TRIM(menstruation) = '');
