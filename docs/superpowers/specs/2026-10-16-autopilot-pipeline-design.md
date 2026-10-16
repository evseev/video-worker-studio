# Emma's Angle: Channel Growth Strategy + Autopilot Production Pipeline

## Context

**The channel.** Emma's Angle (UCr0MYdJwwSsSdpNUqB90KOw): 63 subscribers, ~20,400 views, 38 long-form videos published Jan 13 – Jun 5, 2026, nothing since. Audience is 83% over 55, 57% female, 71% watch on TV, 34% US. Views flatlined at ~19K from June to September; a small revival started late September (~50 views/day) from older videos being re-suggested.

**What the data says (vidIQ + comments, gathered this session):**
- Formats that worked here: *"actors and their real-life partners"* (best video 6,939 views, 36 min, breakout score 11.3) and *"actors and their kids / fathers & daughters"* (1,400–1,500 views each). Generic *"then and now transformation"* videos got 18–40 views. Three January titles were uploaded twice with identical titles.
- The niche is proven and hot: channels with 462–17,000 subs are pulling 100K–6.8M views on the exact same formats in the last 6 months (Timeless Vintage 6.8M on a 10-min "handsome 80s/90s actors then & now"; Star Stories TV 474K on "celebrities and their real-life partners" with 462 subs; Born into Fame 677K on "actors & real-life sons" with 4,030 subs). Winners are 8–12 min, music-only, two-face thumbnails with 1–2 word labels.
- Top audience pain points across 296 niche channels: (1) misleading thumbnails (277 likes of complaints), (2) misidentified photos and wrong names ("random Google photos of other people with the same name", "AI slop not fact-checked"), (3) robotic AI narration, (4) false death claims. **Accuracy is an open differentiator.**
- Search demand: "celebrities then and now" 35K/mo (competition 21/100, best opportunity), "hollywood actors and their partners" 4K/mo (competition 17/100), "hollywood legends" 56K/mo (+115%), "celebrity couples then and now" 9.8K/mo.
- Subscriber conversion in this niche is ~0.1–0.5% of views for everyone. 1,000 subs realistically needs 200–350K views or a breakout video, plus explicit subscribe mechanics.

**Policy facts verified on YouTube's pages:**
- YPP today: 1,000 subs + 4,000 public watch hours (12 mo) or 10M Shorts views (90 d). Fan-funding tier: 500 subs + 3,000 hours. **From Feb 1, 2027 new applicants need 8,000 hours / 20M Shorts views** (announced Aug 10, 2026). Existing partners are grandfathered.
- "Inauthentic content": *"Image slideshows... with minimal or no narrative, commentary, or educational value"* and *"similar or repetitive content... minimal variation across videos"* are ineligible. Content must be *"materially varied and deliver creative, educational, or other value."* Judged at channel level.
- Disclosure: AI-assisted scripts/titles/thumbnails need no disclosure; TTS narration of real photos is not a listed case; AI-generated realistic imagery of real people would require it. **Design constraint: never generate or alter faces.**

**The app (video-worker-studio).** Note: this worktree is a stale March prototype (d7b4163, v0.2.1.0), 174 commits behind `develop` (c6a1cde, v0.4.9.0, May 21). **All implementation targets `develop`** (checked out at `/Users/evs/www/video-worker-studio`). `develop` already has: 3 archetype templates (`slideshow`, `comparison`, `fact-card`), a 6-step wizard, Gemini scene generation with per-scene `scriptText` narration text (generated but never voiced), Pinterest fetch with 3 candidates/slot + drag-to-pan, channels with niche/tone, topic backlog (`channel_topic_ideas`), pgvector subject memory, SEO description/tags, Remotion Lambda + local render, Inngest v4, Vitest (51 test files). Missing: TTS, image verification/cropping, thumbnails, YouTube upload/OAuth, scheduling, music files (presets point to non-existent `/music/*.mp3`), Lambda asset upload (Lambda receives app-relative `/tmp_assets/...` URLs).

## Answers to the three questions

1. **Can production be fully automated?** Yes. Every step from topic to a scheduled upload can run as Inngest jobs. The only genuinely hard part is image identity (wrong face = the #2 complaint in this niche); it is solved with reference-photo face matching + reverse image search, and a 3–5 minute approval gate per video that shows flagged pairs first. Expected manual time: ~5 min/video instead of 30.
2. **How to grow in this niche?** Resume publishing at 5/week with the two proven formats, narrated and fact-grounded, honest two-face thumbnails, series branding, explicit subscribe mechanics, Shorts as a funnel, and localization for the non-English half of the audience. Details in Part A.
3. **What else I can do:** weekly analytics and topic research fed into the app's backlog, title/thumbnail scoring before publish, comment reply drafts, competitor tracking, and building/maintaining the pipeline. Details in Part C.

## Decisions (yours) and calls (mine)

| Topic | Decision |
|---|---|
| Narration | **Full narration**, every pair gets 1–2 sentences (your choice). Voice: Soniox TTS v2 with emotional hints (your choice). My call: a warm, unhurried female US-English voice named "Emma" to match the brand; one voice for the whole channel. |
| Human review | **One approval gate** per video (storyboard review), then render + upload automatically. |
| Budget | **≤ $80/month for 20 videos.** Estimated actual: Soniox ≈ $9 for en + pt-BR + es (≈13 h speech at $0.70/h), DataForSEO ≈ $2–4 (2,800 SERPs at $0.0006–0.0012), Lambda + storage ≈ $5, Gemini ≈ $3. Phase 3 animated host adds ≈ $10–15 once and ≈ $5/month. Headroom stays for ElevenLabs ($22) if Soniox voice quality disappoints. |
| Cadence | **5 long videos/week** (Mon–Fri) + 3 Shorts/week from Phase 2. |
| Image sources | pinterest-dl (existing) + DataForSEO Google Images (candidates) + Google Search-by-Image (identity signal). My call: add Wikimedia Commons / Wikidata as the *reference photo + facts* source (free, structured spouse/children/birth data). |
| Output hygiene | Normalize MP4 container metadata with ffmpeg (strip encoder/tool tags, set title/date). Honest caveat: YouTube re-encodes uploads and reviews content, not container tags. The real protection is narrated, fact-grounded, materially varied videos. |
| Thumbnails | Real photos only, two large faces, 1–2 word labels, no text over faces, no fake aged faces. |
| Deadline | Aim for 1,000 subs + 4,000 hours before Feb 1, 2027 (stretch). Fallback: 500-sub tier by January, full YPP in 2027 under the 8,000-hour rule, which 5 narrated videos/week to a TV audience can reach. |
| Where it runs (confirmed by you) | The repo has no deploy target today; everything runs on your Mac (`next dev` + Inngest dev server, Python `.venv`, ffmpeg). **Phase 1 keeps that**: a "Run autopilot now" button plus the daily cron when the Mac is awake. **Phase 2 adds a Dockerfile** so the same app moves to a $5–10/month VPS (Hetzner/Fly.io) with Inngest Cloud (free tier covers 20 videos/month) for reliable unattended scheduling. Vercel is ruled out: the face-match CLI, ffmpeg and `renderStill` need a real host. |
| Publishing until the API audit passes | Uploads from an unaudited Google Cloud project are **locked private and cannot be flipped**, even by you. So: request the audit on day one, and the review page offers a one-click **download bundle** (MP4 + 3 thumbnail PNGs + metadata.txt + captions.srt) for a 2-minute manual Studio upload. The OAuth upload path is built in Phase 1C but switched on only after the audit passes. |
| Worker writes and RLS (confirmed by you) | Strict AGENTS.md path: every worker write goes through a new SECURITY DEFINER RPC (precedent: `worker_fetch_channel_for_project`, `worker_persist_topic_suggestions`). About six new RPCs, listed in Phase 1A. No service-role table access from functions. |
| Format carried by backlog ideas | `channel_topic_ideas` gets `template_id`, `pair_count`, `format_slug` (`couples` / `parent-child` / `then-now` / `mega`) and `series_key`. The weekly backlog job fills them; when missing, the plan step classifies the idea with Gemini. |
| Localization (confirmed: single channel first, Path A) | **Every video gets pt-BR and es narration tracks from Soniox** (adds ≈ $6/month), translated captions, and localized titles/descriptions. **Path A, default for the next 15 weeks: multi-language audio tracks on Emma's Angle.** All Portuguese and Spanish watch time and subscribers then count toward the one channel that must clear 1,000 subs + 4,000 hours before Feb 1, 2027, and it is the mechanism YouTube built for exactly this. Constraints: "Multi-language features" is an **Advanced feature** (unlocked by channel history or ID/video verification in Studio → Settings → Channel → Feature eligibility), and audio tracks can only be added in **Studio** (the Data API has no endpoint), about one minute per track per video; translated captions and `localizations` are uploaded by the API. **Path B, your three-channel idea:** not forbidden as such (language channels were the standard before multi-audio existed), but three things to know: (1) "Add additional channels to your account" is itself an Advanced feature; (2) each channel must clear YPP on its own, and any channel applying after Feb 1, 2027 needs 8,000 hours, so splitting the same views across three channels triples the bar; (3) the reused-content policy is judged per channel, and a re-upload that differs only in the audio track is the weak case. If you still want Path B later, the pipeline will render **fully localized** versions (narration, on-screen labels, thumbnail text, native titles) under distinct channel branding, which is the defensible form. Recommendation: Path A now, Path B only after Emma's Angle is monetized or if multi-audio turns out to be unavailable. |
| Render asset bucket | New public Supabase Storage bucket `render-assets` (created by migration). No AWS IAM change needed; egress per render is ~40 MB. Every change to `src/remotion/*` requires redeploying the Remotion site (`npx remotion lambda sites create`) behind `REMOTION_SERVE_URL`; this is an ops step in each phase. |

---

## Part A: Channel strategy (no code, start immediately)

**Phase 0 – hygiene and baseline (needs your yes on items 2 and 4):**
1. Connect Emma's Angle to vidIQ (`vidiq_connect_youtube_channel` widget) so I can read retention curves, traffic sources, watch hours and best posting time. The vidIQ account (evseev.zp@gmail.com) currently has no channel connected.
2. Unlist the 7 near-duplicate January "Iconic Actors Then and Now" videos (18–40 views each). They are the textbook "repetitive content" pattern a YPP reviewer sees first. Nothing to lose.
3. Fix the best video's description (it says "50+ actors who rose to fame in the 1980s" under a 1990s/100+ title).
4. Request a YouTube Data API audit for the app's Google Cloud project on day one (unaudited projects' uploads are locked private, with no way to unlock them). Until it passes, publishing = download bundle from the review page + manual Studio upload (about 2 minutes per video).
5. Create playlists for the two series, set a default end screen (subscribe + best video) in Studio and apply it to all videos.

**Format mix per month (20 videos):** 8 couples/partners (fact-card or comparison with HUSBAND/WIFE labels), 6 parent/child lookalikes, 4 then-and-now by cohort (action stars, 80s actresses, rom-com leads), 2 mega-compilations (30–40 min) for the TV audience's watch hours.

**Title formula** (every top outlier follows it): `[50–100+] [adjective] [cohort] and Their [relation] | Then & Now 2026`. Example: "60 Handsome Actors of the 1990s and Their Real-Life Wives | Then & Now 2026". Score candidates with `vidiq_score_title` before publish.

**Thumbnail formula:** two faces filling the frame, contrast banner labels (HUSBAND/WIFE, FATHER/SON, 1990/2026), consistent brand color, honest subject who actually appears in the first minute.

**Subscribe mechanics:** narrated hook in first 10 s names the series; CTA at ~20% and at the end with a reason ("new episode every weekday at 5 PM Eastern"); pinned comment question ("Which couple surprised you? Who should be in Part 2?"); series numbering; end screens.

**Publish time:** 5 PM Eastern weekdays as a start (TV prime time follows), then adjust from vidIQ "best time to post".

**Positioning line** for channel description and intros: every photo verified, every fact sourced. This is what the audience is loudly asking for.

**Honest forecast:** 60 videos by late January at 2–5K views each ≈ 120–300K views → 1,000 subs only with improved conversion or one breakout. Watch hours (4,000) are the easier half with a TV audience. Track weekly: CTR, average view duration (target ≥ 3:30 on 10-min videos), subs per 1K views (target ≥ 5, today ≈ 3), uploads/week.

---

## Part B: Autopilot pipeline (implementation on `develop`)

### Target flow (all steps are Inngest functions; one human gate)

```
topic backlog ──► plan (title/structure/SEO) ──► facts (Wikidata) ──► image candidates
   (cron, daily)      reuse wizard.ts               new                 pinterest-dl + DataForSEO + Commons
        │
        ▼
verify + rank + crop ──► narration (Soniox) ──► REVIEW PAGE (approve/swap) ──► render (Lambda)
   face match, reverse     per-scene MP3 + SRT       human, ~5 min              per-scene audio, music duck
   image, quality, dedupe
        │
        ▼
thumbnail (Remotion Still) ──► ffmpeg metadata ──► YouTube upload (private, thumbnail, captions, publishAt) ──► done
```

### Setup
- Create branch `feature/autopilot` from `origin/develop` in a fresh worktree (this worktree is stale). Copy this design to `docs/superpowers/specs/2026-10-16-autopilot-pipeline-design.md`.
- New env vars (names only): `SONIOX_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`, `FACE_MATCH_BIN`, `ASSET_BUCKET` (Supabase Storage bucket or S3 for render assets).

### Phase 1A – Facts, verified images, review gate (the 30-minute bottleneck)

**New: `src/lib/facts/wikidata.ts`** – resolve a person name to a Wikidata QID (wbsearchentities), fetch P18 (image), P569 (birth), P26 (spouse, with start/end qualifiers), P40 (children), P106 (occupation). Returns typed facts + Commons image URL. Cache in a new `subject_facts` table (QID, json, fetched_at).

**New: `src/lib/images/`**
- `sources/pinterest.ts` – wraps existing `fetchAssets` from `src/lib/ai/fetch-assets.ts` (execFile `pinterest-dl`), raise candidates to 8/slot.
- `sources/google-images.ts` – DataForSEO Google Images SERP (task-based, standard queue) with queries like `"<name> 1995 portrait"` / `"<name> 2026"`.
- `sources/commons.ts` – Wikimedia Commons API: category/search images for the person, with license + attribution captured for the description.
- `verify.ts` – calls `scripts/face-match/face_match.py` (Python CLI, InsightFace + onnxruntime CPU, invoked via `execFile` exactly like pinterest-dl): input = reference image + candidate paths; output = per-candidate `{faceCount, similarity, faceBox, blur, width, height}`. Optional second signal: DataForSEO Search-by-Image on the top candidate; accept if the person's name appears in result titles.
- `quality.ts` – reject: no face / multiple faces where one is expected, short side < 600 px, blur below threshold, perceptual-hash duplicates within the project, text/watermark density (Gemini vision yes/no).
- `rank.ts` – score = similarity × quality × era fit (Gemini vision estimates apparent age vs. birth year for "then"/"now" slots). Marks `confidence: high | medium | low`.
- `crop.ts` – face box → `objectPosition` ("X% Y%") so faces sit in the upper third of each half-frame. Reuses the existing pan field; no zoom (matches the crop design spec).
- `upload.ts` – copy selected candidates (and the music track) to the `render-assets` bucket and return absolute URLs, fixing the Lambda bug where `src/lib/render/render-video.ts:168-172` passes app-relative scene and music URLs that only the local path normalizes (`:238-246`).

**Data (migrations, append-only):**
- `draft_scenes.scenes[].assets[]` gains `{candidates: [{url, source, score, confidence, faceBox, license}], verification}`.
- `projects`: `review_status` (`pending_review | approved | rejected`), `narration` jsonb, `thumbnail_url`, `youtube_video_id`, `publish_at`.
- `channels`: `autopilot_enabled` boolean, `autopilot_config` jsonb (weekday slots, publish hour, format mix). The cron processes only enabled channels and sets `projects.user_id` to the channel owner, so the review page's RLS and the `event.data.userId` concurrency key keep working.
- `channel_topic_ideas`: `template_id`, `pair_count`, `format_slug`, `series_key`.
- New table `subject_facts` (QID, facts json, fetched_at) and new bucket `render-assets`.
- New SECURITY DEFINER RPCs (grant to service_role, like the existing `worker_*` functions): `autopilot_list_enabled_channels`, `autopilot_claim_next_idea(channel_id)`, `autopilot_create_project(channel_id, idea_id, payload)`, `worker_update_project_assets`, `worker_set_narration`, `worker_set_publish_result`. `types.ts` is regenerated after each migration, never hand-edited.

**New: `src/app/review/[id]/page.tsx`** – storyboard grid: all pairs, flagged (low/medium) first; per pair: swap among top candidates, drag to pan (reuse `src/components/DraggableImage.tsx`), edit labels/caption/narration line; "Approve & Render". Reuses `SceneCard.tsx` from `src/templates/comparison/` and `src/templates/fact-card/`.

**Inngest:** `autopilot/plan` (cron Mon–Fri 06:00 ET: pick next `channel_topic_ideas` backlog row, create project with channel defaults from `src/lib/channels/defaults.ts`, run `enhanceIdea → validateTrend → generateStructure → generateSeo` from `src/lib/ai/wizard.ts`, mark idea `shot`), `autopilot/source-assets` (facts → candidates → verify → rank → crop → upload → `pending_review`). Keep `concurrency 3/user` and add the global cap AGENTS.md §10 asks for.

### Phase 1B – Narration and audio

**New: `src/lib/tts/soniox.ts`** – TTS v2 client (verify API shape and emotional-hint syntax in Soniox docs during implementation; fall back to Gemini TTS if hints are unavailable). **`src/lib/tts/narration.ts`** – per scene: synthesize `scriptText` → MP3 in Storage, measure duration, set `scene.durationSec = audio + 0.8 s`; intro hook + outro CTA scenes; build SRT from scene offsets; chapters list (`0:00 Intro`, `0:14 Tom Hanks & Rita Wilson`, ...).

**Multi-language tracks (`src/lib/tts/localize.ts`):** English is the timing master. For each extra language (pt-BR, es): Gemini translates every scene line (names, years and film titles preserved; Zod-validated), Soniox synthesizes it with a native voice, and a timing-fit step makes each dubbed line fit its scene (pad with silence when shorter; when longer, ask for a tighter translation once, then allow ≤ 8% tempo change). Output per language: one full-length MP3 matching the video duration (Studio requires roughly equal length), a translated SRT, and a localized title + description. Stored under `projects.narration.languages[]`.

**Script prompt changes** (`src/templates/comparison/prompt.ts`, `src/templates/fact-card/prompt.ts`, `src/lib/ai/prompts.ts`): narration must use only facts passed from Wikidata (years married, children count, birth years, notable films); warm, respectful tone; never speculate about health or death; vary sentence shapes across scenes (anti-repetition); add a `factCheck` pass with Zod schema listing each claim → source field.

**Remotion** (`src/remotion/VideoComposition.tsx`): per-scene `<Audio>` inside each `Sequence`; scene frames from `durationSec` instead of a fixed value; music looped (`loop` on `<Audio>`) and ducked to −14 dB while narration plays; add real royalty-free tracks to `public/music/` so `src/lib/music-presets.ts` resolves; scale caption font sizes with output height (`ComparisonScene.tsx` uses fixed px).

### Phase 1C – Thumbnail, metadata, upload, scheduling

- **`src/remotion/ThumbnailStill.tsx`** + `src/lib/thumbnail/render.ts` (`renderStill`): 3 variants (labels HUSBAND/WIFE etc., 1990/2026, names) from the two highest-confidence faces; store `projects.thumbnail_url`.
- **`src/lib/video/postprocess.ts`**: `ffmpeg -map_metadata -1 -metadata title=... -c copy` on the rendered MP4 (worker host has ffmpeg; Lambda output is downloaded, processed, re-uploaded).
- **`src/lib/youtube/oauth.ts` + `src/app/api/youtube/oauth/callback/route.ts`**: channel-owner OAuth (`youtube.upload`, `youtube.force-ssl`), tokens in new `youtube_connections` table (RLS, per channel). **`src/lib/youtube/upload.ts`**: `videos.insert` (private, `publishAt`, category Entertainment, title/description/tags, `localizations` for pt/es/de/ru later), `thumbnails.set`, `captions.insert` (SRT). Store `projects.youtube_video_id`, `projects.publish_at`.
- **Review page download bundle** (works from day one, independent of the API audit): MP4 (post-processed), 3 thumbnail PNGs, `metadata.txt` (title, description with Commons attributions, tags, chapters, localized titles/descriptions), `captions.en.srt`, `captions.pt-BR.srt`, `captions.es.srt`, `audio.pt-BR.mp3`, `audio.es.mp3`, plus a 4-line Studio checklist (upload, thumbnail, audio tracks, schedule).
- **API publish step** (when the audit flag is on): `videos.insert` + `thumbnails.set` + `captions.insert` for all three languages + `videos.update` with `localizations` for pt-BR and es. Audio tracks stay a Studio step until YouTube exposes an API for them.
- **Inngest `autopilot/publish`**: the existing `generate-video` function emits a `video/completed` event; `autopilot/publish` consumes it, uploads via OAuth when the audit flag is on (otherwise marks the project "ready to upload"), assigns the next free 17:00 ET Mon–Fri slot, keeps ≥ 3 approved videos ahead; dashboard "Needs review" and "Ready to upload" counters.
- **Manual trigger**: "Run autopilot now" on the channel page sends the same event the cron sends, so Phase 1 works on a laptop that sleeps.
- Fix pipeline-breaking bugs found in the audit: server-written `wizard_step` values (`validation|structure|assets`) that blank the wizard on reopen; `generate-structure` overwriting `draft_scenes` with a bare array; RenderStep initializing music/voiceover to `null` so any render after a page reload wipes the saved audio (`src/app/wizard/[id]/steps/RenderStep.tsx:19-20`, `src/lib/merge-render-payload.ts:95-103`).

### Phase 2 – Growth layer
- Shorts cutter: per project, 3 vertical 30–45 s clips (one pair each, narrated) rendered with the existing 9:16 layouts; uploaded with `#Shorts`.
- Localization expansion: add de and ru titles/descriptions and captions (cheap, API-only); evaluate adding a third audio language from analytics; Path B language channels only per the decisions table.
- Analytics loop: weekly job pulls YouTube Analytics (via OAuth) + vidIQ outliers for the niche, writes new `channel_topic_ideas` with source `youtube_performance`, and a weekly report.
- Comment replies drafted (vidIQ) + pinned question per video.

### Phase 3 – Animated host experiment ("Emma" on screen)

**Hypothesis:** a stylized animated host who opens each video, bridges sections and closes with the subscribe reason raises 30-second retention, average view duration and subscribers per 1K views, and makes the channel visibly original next to faceless competitors.

**Character rules (policy-driven):** Emma is clearly stylized (illustrated / 3D-cartoon look), never photorealistic, so she falls under YouTube's "non-realistic content" exemption and needs no AI disclosure. The design constraint stays: real celebrities are never generated or altered.

**Model shortlist (Chinese video models, pick one after a bake-off on a fixed test script):**
- **Kling 2.x** (Kuaishou): image-to-video with strong character consistency and built-in lip sync; global API, also hosted on fal.ai.
- **Wan 2.2** (Alibaba): open weights (Apache 2.0), image-to-video, cheapest per second when hosted on fal.ai / Replicate; lip sync via an open model (Tencent MuseTalk or ByteDance LatentSync).
- **Seedance 1.0** (ByteDance): fast, good motion quality, API via BytePlus / fal.ai.
Selection criteria: cost per 5-s clip, consistency of the same character across clips, lip-sync quality on Soniox audio, commercial-use license, API reliability from outside China.

**Budget-safe design:** generate a reusable **clip library once** (≈ 20 clips: greeting, pointing left/right, surprised, nodding, goodbye, idle loop) from one character reference image; per video, only the intro and outro lines are lip-synced to the Soniox narration. Estimated one-time ≈ $10–15, then ≈ $5/month at 20 videos, inside the $80 cap.

**Implementation:** `src/lib/host/character.ts` (character bible: reference image, style prompt, voice = the channel's Emma voice), `src/lib/host/clips.ts` (one-time library job, stored in `channel-assets`), `src/lib/host/lipsync.ts` (per-video intro/outro), Remotion `HostIntroScene.tsx`, `HostBridge.tsx` (3-s bridge every ~15 pairs) and `HostOutroScene.tsx`, plus a picture-in-picture `HostOverlay.tsx` variant; `channels.autopilot_config.host_mode` (`off | intro_outro | intro_bridges_outro | pip`); `projects.experiment_arm` for assignment.

**Experiment protocol:** 10 videos, alternating arms within the same format (5 with host, 5 without), same publish slots; read per-video CTR, 30-s retention, AVD and subs/1K views from YouTube Analytics after 14 days; adopt the host mode if retention at 30 s improves by ≥ 5 points or subs/1K views by ≥ 30%; otherwise keep it for intros only or drop it.

### Phase 3 – Hardening
- Vitest coverage for ranking thresholds, Wikidata parsing, SRT/chapter math, duration/frame math, upload payloads (mock googleapis). Playwright smoke for the review page (the `mvp` branch already has `playwright.config.ts` + `.github/workflows/test.yml` to merge).
- Dockerfile (Node 22 + Python 3.13 + ffmpeg + InsightFace model) and a deploy runbook for the VPS move; record the Lambda doc's open post-deploy checklist (P95 render time, cold starts, cost per render) and refresh `TODOS.md`.
- Add the global Inngest concurrency cap AGENTS.md §10 asks for (today only `concurrency 3/user` at `src/lib/inngest/functions.ts:119-122`).

---

## Part C: What I run for you as channel co-manager (after approval)
- Weekly: pull channel analytics + niche outliers, score next week's 5 titles, update the topic backlog, post a one-page report.
- Per video: thumbnail/title score before publish; pinned comment; reply drafts for comments.
- Monthly: competitor set review (`vidiq_similar_channels` list above), format mix adjustment, YPP progress check (subs, hours) against the Feb 1 deadline.
- Save channel strategy decisions to memory so every future session starts with the context.

## Verification
1. `npm run lint`, `npm run build`, `npm run test` green on `feature/autopilot`.
2. Unit tests: face-match CLI contract, `rank.ts` thresholds (fixtures: correct person, wrong person same name, group photo, blurry), Wikidata resolver (fixture JSON), SRT/chapter builders, duration→frames math, YouTube payload builder.
3. End-to-end locally (`RENDER_BACKEND=local`, `INNGEST_DEV=1`): one real topic → review page shows 60–70 pairs with confidence badges → approve → MP4 plays with per-scene narration in sync, music ducked, captions SRT matches audio → thumbnail PNGs produced → upload lands as **private** in Studio with thumbnail, captions and chapters.
4. Lambda path: same topic rendered on Lambda with absolute asset URLs; verify cost per render in AWS billing (target < $0.30).
5. First 5 real publishes: check Studio for accuracy complaints in comments, CTR ≥ 4%, AVD ≥ 3:00; then switch cron to daily.
6. Policy sanity before applying to YPP: no duplicate titles live, every video has narration + sourced facts, no synthetic imagery of real people; the animated host is visibly stylized.
7. Phase 3 experiment: 10 videos, two arms, 14-day read-out of CTR, 30-s retention, AVD and subs/1K views per arm; decision recorded in `docs/superpowers/specs/`.

## Items only you can do
- Say yes/no to unlisting the 7 duplicate January videos.
- Complete the vidIQ channel-connect widget and the YouTube OAuth consent once.
- Create Soniox and DataForSEO accounts and put the keys in `.env.local` (never share values in chat).
- Request the YouTube Data API audit for the Cloud project (day one; it gates automatic publishing).
- Drop 5–6 royalty-free music tracks into `public/music/` (or point me at the three MP3s in `public/local_renders`).
- Check in Studio → Settings → Channel → Feature eligibility whether Emma's Angle has **Advanced features** (needed for multi-language audio and for extra channels). If not, start ID or video verification there; it is the fastest unlock.
- Decide Path A vs Path B for localization after reading the decisions table (plan assumes Path A).
