-- Extend caption_style CHECK with 'glowing'; add comparison_overlay_mode for comparison template text visibility.

ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_caption_style;

ALTER TABLE projects ADD CONSTRAINT check_caption_style
  CHECK (caption_style IS NULL OR caption_style IN ('minimal', 'bold', 'strip', 'split', 'glowing'));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS comparison_overlay_mode text NOT NULL DEFAULT 'both';

ALTER TABLE projects DROP CONSTRAINT IF EXISTS check_comparison_overlay_mode;

ALTER TABLE projects ADD CONSTRAINT check_comparison_overlay_mode
  CHECK (comparison_overlay_mode IN ('labels', 'caption', 'both'));
