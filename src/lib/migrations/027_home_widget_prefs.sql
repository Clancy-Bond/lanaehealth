-- ── Home widget preferences ────────────────────────────────────────
-- Two additive columns so the home page widget grid can be customized
-- per user: order and hidden set. Nullable/defaults mean existing rows
-- keep their current behavior (default widget set in defaultOrder).
--
-- Source of truth for the widget list itself lives in
-- src/lib/home/widgets.ts (registerWidget()), not in the database.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS home_widget_order text[] DEFAULT '{}';

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS hidden_home_widgets text[] DEFAULT '{}';
