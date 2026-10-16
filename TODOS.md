# TODOS

- Optional: add authenticated Supabase integration tests for channel RLS (user A cannot `select`/`update` user B's `channels` row by id); Epic 25 Phase E uses SQL policies plus unit tests on lib/repository and API behavior.
- Validate Pinterest batch defaults in staging under high-scene projects and tune `PINTEREST_BATCH_SIZE` / `PINTEREST_BATCH_PAUSE_MS` if provider throttling increases.
- Consider adding explicit toast UX for Preview step stream failures (currently logs and exits gracefully).

## Autopilot (2026-10-16)
- [ ] Apply migration `20261016120000_autopilot.sql`, regenerate `types.ts`, then drop the local row types in `src/lib/autopilot/access.ts` and the untyped client in `src/lib/autopilot/db.ts`.
- [ ] End-to-end test of the DB-backed flow (cron → review page → approve → bundle) on the Mac.
- [ ] YouTube OAuth: create Google Cloud OAuth client, request the API audit, test upload with `upload_enabled = true`.
- [ ] DataForSEO keys → extra Google Images candidates; re-check low-confidence rate.
- [ ] Lambda path for autopilot: upload run assets to `render-assets`, then use `renderVideoOnLambda`.
- [ ] Phase 3 host bake-off (Kling / Wan / Seedance) once `FAL_KEY` exists.
- [ ] Automated narration QA: transcribe the final mix with Soniox STT and flag lines whose transcript diverges from the script.
