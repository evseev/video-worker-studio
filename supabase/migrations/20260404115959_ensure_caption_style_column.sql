-- caption_style was introduced in 20260320140000_add_caption_style.sql.
-- If only later migrations were applied manually, ensure the column exists before
-- 20260404120000_glowing_caption_comparison_overlay.sql references it in CHECK constraints.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS caption_style text DEFAULT NULL;
