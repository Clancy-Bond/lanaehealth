-- Migration 037: Body composition expansion on health_profile
--
-- Adds a section='body_metrics_log' jsonb document on health_profile
-- so the v2 weight tracker can capture every "studied weight metric"
-- (per user direction 2026-04-24) without forking the existing
-- weight log dataset.
--
-- Design choice: re-use health_profile rather than adding a brand new
-- table. The existing weight log already lives there
-- (section='weight_log'); the body_metrics_log section sits alongside
-- it as a separate document so the legacy weight log API remains
-- untouched. We can split into a dedicated table later when volume
-- justifies it (same plan as the existing weight log).
--
-- Shape (TypeScript: BodyMetricsLog):
--   {
--     entries: [
--       {
--         id: 'bm_<ts>_<rand>',
--         date: 'YYYY-MM-DD',
--         weight_kg?: number,
--         body_fat_pct?: number,        -- 2 to 70
--         waist_cm?: number,             -- 30 to 200
--         hip_cm?: number,               -- 40 to 200
--         neck_cm?: number,              -- 20 to 70
--         visceral_fat_rating?: number,  -- BIA scale, 1 to 30
--         bone_mass_kg?: number,         -- BIA scale
--         muscle_mass_kg?: number,       -- BIA scale or DEXA
--         bmd_t_score?: number,          -- DEXA, -5 to 5
--         body_fat_method?: 'navy' | 'bia' | 'dexa' | 'skinfold' | 'manual',
--         notes?: string,
--         loggedAt: ISO timestamp
--       }
--     ]
--   }
--
-- Zero data loss: the migration only inserts a single empty
-- placeholder row if the section is missing. Existing weight_log,
-- personal, and other sections are not touched.
--
-- Idempotent: ON CONFLICT DO NOTHING ensures rerun safety.

INSERT INTO health_profile (section, content, updated_at)
SELECT 'body_metrics_log', '{"entries": []}'::jsonb, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM health_profile WHERE section = 'body_metrics_log'
);

-- Documentation row for /docs/operations.md crawlers.
COMMENT ON TABLE health_profile IS
  'Per-section JSONB documents for patient profile. Sections include: '
  'personal, weight_log, blood_pressure_log, body_metrics_log, conditions, '
  'medications, supplements, etc. Migration 037 added body_metrics_log.';
