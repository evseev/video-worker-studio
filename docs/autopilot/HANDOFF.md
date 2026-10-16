# Handoff — autopilot run of 2026-10-16

Branch `feature/autopilot` (worktree `.claude/worktrees/autopilot`), based on `develop`. Not pushed, no PR, nothing
applied to the live database, nothing uploaded to YouTube.

## Finished videos to review

| Folder | What |
|---|---|
| `out/autopilot-v2/couples-handsome-hollywood-actors-of-the-1990s-and-their-rea/` | **Final**: 50 couples, ~10 min 1080p, en narration + pt-BR/es tracks, 3 thumbnails, 3 Shorts, all quality checks |
| `out/autopilot/couples-handsome-hollywood-actors-of-the-1990s-and-their-rea/` | First full run (before partner-exclusion and watermark checks) — kept for comparison |
| `out/smoke/…` | 6-pair 720p smoke test |

Open `review.html` in each folder: video, thumbnails, Shorts, every pair with photo confidence, alternatives,
fact-check source and voice-check result. Flagged pairs are listed first. Upload files are in `bundle/`
with the Studio checklist in `bundle/metadata.txt`.

## v2 result (34.5 min end to end)

| Metric | Value |
|---|---|
| Length | 9.2 min, 1080p, 450 MB |
| Pairs | 50 verified couples (28+ proposals rejected by Wikidata or photo checks) |
| Photos needing a look | 3 (lesser-known spouses: Riko Shibata, Rosalind Ross, Erdenetuya Batsukh) |
| Stock-watermarked candidates avoided | 41 of 487 |
| Narration | 52/52 lines pass the speech-to-text check; 2 lines use the fact-only template |
| Extras | 3 thumbnails, pt-BR + es soundtracks and captions, 3 Shorts (34–37 s) |
| Variable cost | ≈ $0.50 (Soniox + Gemini) |

## Quality gates that ran

1. Every pair's relationship confirmed in Wikidata (invented couples are rejected).
2. Narration written only from Wikidata facts, then fact-checked by a second model pass; failures rewritten once,
   then replaced by a template line built purely from the data.
3. Photos: face detection + identity verification against the Wikidata portrait and across search results,
   the partner's face excluded, group photos cropped to the right person, stock watermarks avoided,
   near-duplicates removed; pairs whose photos cannot be verified are dropped (20 % over-generation).
4. Narration voiced in all three languages before timing, so no dub is cut off.
5. Speech-to-text check of every English line against its script.

## What you need to do

1. Watch the v2 video; check the flagged pairs in `review.html`.
2. If it is good: upload it with `bundle/metadata.txt` (title option 1, description, tags, captions, the two
   audio tracks, thumbnail), schedule for a weekday 5 PM Eastern, then post the Shorts one per day.
3. Make the next videos: `npm run autopilot:local -- --topic "<topic from CONTENT_PLAN.md>" --format <format> --pairs 50`.
4. When ready for the in-app flow: apply the migration, regenerate types, follow `RUNBOOK.md`.
5. Keys still missing: DataForSEO (more photo candidates), Google OAuth + API audit (auto-upload), fal.ai (host experiment).
6. Rotate the Soniox key at some point: it was pasted into chat. It is stored only in the gitignored `.env.local`.

## Known limitations

- Lesser-known spouses often have no Wikidata portrait and few photos online; those pairs are flagged or dropped.
- "Then" photos rely on era-specific searches; a modern photo can occasionally win a "then" slot (visible in review).
- The DB-backed flow (Inngest + review page) is typechecked, built and unit-tested but has not run end-to-end,
  because the migration is not applied.
- Multi-language audio tracks must be added in YouTube Studio (no public API); captions and localized titles are automated.
