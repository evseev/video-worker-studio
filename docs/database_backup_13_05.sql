-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  status text NOT NULL DEFAULT 'processing'::text CHECK (status = ANY (ARRAY['draft'::text, 'processing'::text, 'rendering'::text, 'completed'::text, 'failed_ai'::text, 'failed_render'::text])),
  video_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  wizard_step text DEFAULT 'idea'::text,
  trend_validation_data jsonb,
  selected_template text,
  draft_scenes jsonb,
  render_error_context jsonb,
  aspect_ratio text DEFAULT '16:9'::text CHECK (aspect_ratio = ANY (ARRAY['9:16'::text, '16:9'::text])),
  video_quality text DEFAULT '1080p'::text CHECK (video_quality = ANY (ARRAY['720p'::text, '1080p'::text, '4k'::text])),
  video_description text,
  video_tags text,
  caption_style text CHECK (caption_style IS NULL OR (caption_style = ANY (ARRAY['minimal'::text, 'bold'::text, 'strip'::text, 'split'::text, 'glowing'::text]))),
  comparison_overlay_mode text NOT NULL DEFAULT 'both'::text CHECK (comparison_overlay_mode = ANY (ARRAY['labels'::text, 'caption'::text, 'both'::text])),
  background_music text,
  scene_transition text NOT NULL DEFAULT 'fade'::text CHECK (scene_transition = ANY (ARRAY['fade'::text, 'slide'::text, 'wipe'::text, 'flip'::text, 'clock-wipe'::text, 'random'::text])),
  image_motion text NOT NULL DEFAULT 'zoom-in'::text CHECK (image_motion = ANY (ARRAY['zoom-in'::text, 'zoom-out'::text, 'pan-left'::text, 'pan-right'::text, 'pan-up'::text, 'pan-down'::text, 'pan-horizontal'::text, 'pan-vertical'::text, 'none'::text, 'random'::text])),
  text_animation text NOT NULL DEFAULT 'slide-up'::text CHECK (text_animation = ANY (ARRAY['slide-up'::text, 'slide-left'::text, 'typewriter'::text, 'pop'::text, 'fade-in'::text, 'random'::text])),
  voiceover_url text,
  video_title text,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.scenes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL,
  sequence_order integer NOT NULL,
  script_text text NOT NULL,
  search_keywords text NOT NULL,
  asset_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT scenes_pkey PRIMARY KEY (id),
  CONSTRAINT scenes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.video_subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  subject_key text NOT NULL,
  subject_normalized text NOT NULL,
  embedding USER-DEFINED,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT video_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT video_subjects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT video_subjects_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);