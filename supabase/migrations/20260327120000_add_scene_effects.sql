-- Epic 22: Scene Transitions & Animation Effects
-- Adds 3 new columns for user-configurable transitions and effects.
-- Defaults match existing hardcoded behavior (fade + zoom-in + slide-up).

ALTER TABLE projects
  ADD COLUMN scene_transition text NOT NULL DEFAULT 'fade'
    CHECK (scene_transition IN ('fade','slide','wipe','flip','clock-wipe','random')),
  ADD COLUMN image_motion text NOT NULL DEFAULT 'zoom-in'
    CHECK (image_motion IN ('zoom-in','zoom-out','pan-left','pan-right','pan-up','pan-down','pan-horizontal','pan-vertical','none','random')),
  ADD COLUMN text_animation text NOT NULL DEFAULT 'slide-up'
    CHECK (text_animation IN ('slide-up','slide-left','typewriter','pop','fade-in','random'));
