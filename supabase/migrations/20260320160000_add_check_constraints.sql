-- Add CHECK constraints to ensure valid values for new columns
ALTER TABLE projects ADD CONSTRAINT check_aspect_ratio
  CHECK (aspect_ratio IN ('9:16', '16:9'));

ALTER TABLE projects ADD CONSTRAINT check_video_quality
  CHECK (video_quality IN ('720p', '1080p'));

ALTER TABLE projects ADD CONSTRAINT check_caption_style
  CHECK (caption_style IS NULL OR caption_style IN ('minimal', 'bold', 'strip', 'split'));
