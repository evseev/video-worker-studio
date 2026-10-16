# Autopilot — implementation progress

Design: `docs/superpowers/specs/2026-10-16-autopilot-pipeline-design.md`.
Branch: `feature/autopilot` (worktree `.claude/worktrees/autopilot`, from `origin/develop` c6a1cde).

## Ground rules for this run (owner away, autonomous)
- Do NOT apply migrations to the live Supabase project. Write migration files only; owner applies them.
- Do NOT publish anything to YouTube or any external account.
- Available credentials: Gemini, Supabase (existing), Remotion AWS, Soniox (new, in `.env.local` as `SONIOX_API_KEY`).
  Missing: DataForSEO, YouTube OAuth, Kling/Wan/Seedance. Code for them is written behind interfaces and stays disabled until keys exist.
- Everything must be runnable offline from the DB via `npm run autopilot:local -- --topic "..."` which writes a full bundle to `out/autopilot/<slug>/`.

## Status (update after each step)

| # | Step | Status | Notes |
|---|---|---|---|
| 0 | Worktree, env, deps, design doc committed | done | Soniox key verified, 200 voices |
| 1 | Soniox TTS client + voice choice | done | `src/lib/tts/soniox.ts`; defaults en Sloane, pt-BR Larissa, es Lucia (override NARRATION_VOICE_*) |
| 2 | Wikidata facts resolver | done | `src/lib/facts/wikidata.ts`, throttled 400ms + Retry-After |
| 3 | Image sources (pinterest-dl, Wikimedia Commons; DataForSEO stub) | done | `src/lib/images/sources/*`; Google Images auto-enables when DATAFORSEO_* set |
| 4 | Face match CLI (OpenCV YuNet + SFace) + quality + rank + crop | done | `scripts/face-match/` (run setup.sh), `src/lib/images/{verify,rank,crop,source-person}.ts`; ~17 s/person; verified visually on Kurt Russell/Goldie Hawn |
| 5 | Narration builder (per-scene audio, durations, SRT, chapters) | done | `src/lib/tts/{narration,timeline}.ts`; content-hash cache |
| 6 | Localization (pt-BR, es) timing-fit tracks | done | all languages voiced BEFORE timeline; scenes sized for longest language; music bed under dubs |
| 7 | Remotion: per-scene audio, scene durations, music loop + duck | done | `VideoComposition.tsx` (sceneDurationsFrames, narrationUrl, narrationWindows, textScale) |
| 8 | Thumbnail still (3 variants) | done | `src/remotion/ThumbnailStill.tsx` |
| 9 | ffmpeg metadata post-process | done | `src/lib/video/postprocess.ts` |
| 10 | Local runner `autopilot:local` → bundle; first real video produced | in progress | smoke runs OK (6 pairs, 720p, 7.9 min); full 50-pair run next |
| 11 | Migrations + RPCs (files only) | done | `supabase/migrations/20261016120000_autopilot.sql` — NOT applied |
| 12 | Inngest functions (plan, source-assets, narrate, publish) + manual trigger | done | `src/lib/inngest/autopilot-functions.ts`, `POST /api/autopilot/run` |
| 13 | Review page `/review/[id]` + download bundle route | done | needs migration applied to test in app; offline `review.html` works now |
| 14 | YouTube OAuth + upload code (disabled until audit/keys) | done | `src/lib/youtube/{oauth,upload}.ts`; untested against Google (no keys) |
| 15 | Wizard bug fixes (step names, bare array, audio nulling) | done | + regression tests; dashboard 'Needs review' badge |
| 16 | Phase 3 host experiment scaffolding (interfaces, no keys) | done | `src/lib/host/*`, `src/remotion/HostScene.tsx`; disabled without FAL_KEY |
| 17 | Tests, lint, build green; owner handoff notes | in progress | 276+ tests pass, `next build` passes, RUNBOOK + CONTENT_PLAN written |

| 18 | Shorts stage (3 vertical clips) | done | stacked layout opt-in, re-cropped from stored face boxes |
| 19 | Narration QA (Soniox STT) | done | re-voices failing lines once, flags in review |
| 20 | Content calendar + backlog seed | done | `docs/autopilot/CONTENT_PLAN.md`, `seed-backlog.sql` |

## Log
- 2026-10-16: setup done; Soniox TTS verified with `[warm]`/`[softly]` tags (mp3 44.1 kHz mono).
- Face calibration: same-person consensus 0.33–0.59 vs other-person 0.04–0.16; ref similarity drops with age gap. YuNet needs multi-scale (640/960/320).
- Smoke run 1 found a wrong-person photo (low confidence) → pipeline now over-generates 20% pairs and drops pairs with unverified photos.
- Portuguese runs 15–30% longer than English → all languages are voiced before the timeline is built.
- Full 50-pair run started 18:28 UTC (`out/full-couples-90s.log`); it predates the Shorts/QA code — resume it afterwards to add them.
- `next build` needed turbopackIgnore annotations + runtime fs in static-server (tracing pulled in .venv/out).
