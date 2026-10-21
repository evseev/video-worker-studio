# Autopilot runbook

Design: `docs/superpowers/specs/2026-10-16-autopilot-pipeline-design.md` · Progress log: `docs/autopilot/PROGRESS.md` ·
Content calendar: `docs/autopilot/CONTENT_PLAN.md`.

## What it does

```
topic ─► script (Gemini, Wikidata-verified pairs, fact-checked narration, packaging)
      ─► images (Pinterest [+ Google Images] + Wikimedia Commons → face verification → face-aware crop)
      ─► voice (Soniox: English + every dub language; scenes sized for the longest language)
      ─► [review gate]
      ─► render (Remotion 1080p, per-scene narration, ducked looping music)
      ─► thumbnails (3 variants) ─► localize (pt-BR / es full soundtracks + captions + titles)
      ─► bundle (metadata.txt, chapters, captions, review.html) ─► shorts (3 vertical clips)
```

Every stage writes `state.json`; re-running the same command resumes after the last finished stage.

## One-time setup (owner)

1. `npm install`
2. `npm run face-match:setup` (Python venv + OpenCV YuNet/SFace models into `scripts/face-match/`).
3. Copy the channel's music into `public/music/` (gitignored): `lifting-dreams.mp3`, `twinkle-in-the-night.mp3`,
   `mysterious-sorrows.mp3` (YouTube Audio Library tracks already used on the channel).
4. `.env.local` (names only; never commit values):

| Variable | Needed for | Status on 2026-10-16 |
|---|---|---|
| `GEMINI_API_KEY` (+ `GEMINI_TEXT_MODEL=gemini-3.8-flash`) | script, translation, photo vision checks | present |
| `SONIOX_API_KEY` | narration (all languages) | present |
| `PINTEREST_DL_BIN` | photo candidates | present |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | DB-backed autopilot (Inngest) | present |
| `DataForSEO_API_LOGIN`, `DataForSEO_API_PASSWORD` | extra Google Images candidates via the Live API (≈ $0.002 per person-era, auto-enabled) | present |
| `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL` | YouTube upload | missing |
| `FAL_KEY` (+ optional `HOST_I2V_MODEL`, `HOST_LIPSYNC_MODEL`) | Phase 3 animated host | missing |
| `NARRATION_VOICE_EN` / `_PT` / `_ES` | override voices (default Sloane / Larissa / Lucia) | optional |
| `AUTOPILOT_OUT_DIR` | where DB-backed runs are stored (default `out/autopilot`) | optional |
| `FACE_MATCH_BIN` | custom python + script path | optional |

## Make a video without the database (works today)

```bash
npm run autopilot:local -- --topic "Handsome Hollywood actors of the 1990s and their real-life wives and partners" --format couples --pairs 50
```

Options: `--format couples|parent-child|then-now|mega`, `--pairs N`, `--music <preset id>`, `--locales pt-BR,es`
(empty string disables dubs), `--quality 720p|1080p`, `--until <stage>`, `--force <stage,stage>`, `--out <dir>`.

Output: `out/autopilot/<slug>/review.html` (open in a browser) and `out/autopilot/<slug>/bundle/`:
`video.mp4`, `thumbnail-{labels,banner,names}.png`, `metadata.txt` (titles, description with chapters and photo
credits, tags, localized titles, Studio checklist), `captions.{en,pt-BR,es}.srt`, `audio.{pt-BR,es}.mp3`,
`shorts/short-{1,2,3}.mp4` + `shorts.txt`.

To fix something before rendering: run with `--until voice`, open `review.html`, then edit `state.json`
(swap `images.N.left.chosen` with an alternative, change `narration[N].scriptText`) and re-run with
`--force voice` (narration edits) or without (photo edits).

Typical cost per 50-pair video: Soniox ≈ $0.40 (≈ 30 min of speech across 3 languages), Gemini ≈ $0.10,
Pinterest/Wikidata/Commons free. Local render: ~10–20 min on an Apple Silicon Mac.

## DB-backed autopilot

State on 2026-10-21: migration applied, `types.ts` updated to match the live schema, Emma's Angle has
`autopilot_enabled = true` (weekdays 5 PM ET, pt-BR + es, max 3 waiting for review), and the backlog holds the
20-topic calendar followed by the owner's 13 earlier ideas (all tagged with a format). For another channel:

1. `UPDATE channels SET autopilot_enabled = true, autopilot_config = '{"weekdays":[1,2,3,4,5],"publishHour":17,"timezone":"America/New_York","locales":["pt-BR","es"],"maxPendingReview":3}' WHERE id = '<channel id>';`
2. Seed ideas with `format_slug` and `pair_count` (`docs/autopilot/seed-backlog.sql` shows the shape).
3. Types: `supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts` needs a Supabase access token
   (or `--db-url` with the database password); neither is in `.env.local`, so the last update was made by hand
   against the live REST schema.

4. Run the app and Inngest dev server (`npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`) (`npm run dev` + `npx inngest-cli@latest dev`).
5. Weekdays 06:00 ET the cron starts one video per enabled channel; or press **Run autopilot now**
   (`POST /api/autopilot/run {channelId}`).
6. The dashboard shows **Needs review** → `/review/<projectId>`: flagged pairs first; swap photos, drag to re-crop,
   edit narration, pick the title → **Approve & render**.
7. After render, the bundle downloads appear on the same page. Publishing:
   - Until the YouTube API audit passes: upload manually with the Studio checklist in `metadata.txt`
     (the planned 5 PM ET slot is stored in `projects.publish_at`).
   - After the audit: connect YouTube at `/api/youtube/oauth/start?channelId=<id>`, then set
     `youtube_connections.upload_enabled = true`. Uploads are private with `publishAt`, plus thumbnail,
     captions (en/pt-BR/es) and localized titles. Audio tracks remain a Studio step (no public API).

## Remotion Lambda

Lambda renders need absolute asset URLs. The autopilot renders locally (Phase 1). Before switching the
autopilot to Lambda, upload run assets to the `render-assets` bucket (created by the migration) and
redeploy the Remotion site after any change in `src/remotion/*`: `npx remotion lambda sites create`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `face-match exited …` | `npm run face-match:setup`; check `scripts/face-match/models/*.onnx` exist |
| A slot shows the wrong person or sex | photo check (Gemini) removes faces whose sex does not match Wikidata; couple queries + partner exclusion find little-known spouses; check `review.html` |
| Many "identity not confirmed" photos | add DataForSEO keys (more candidates) or lower `--pairs`; review flags in `review.html` |
| `[wikidata] HTTP 429` | transient; the client backs off (Retry-After) |
| Soniox 429 / 5xx | client retries with backoff; 3 concurrent requests max |
| A dub line sped up | timing fit ≤ 8 %; edit the English line shorter and `--force voice` |
| Background run log empty | run long jobs with `rtk proxy …` (the rtk hook buffers output until exit) |
