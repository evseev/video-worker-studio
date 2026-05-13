# TODOS

- Optional: add authenticated Supabase integration tests for channel RLS (user A cannot `select`/`update` user B's `channels` row by id); Epic 25 Phase E uses SQL policies plus unit tests on lib/repository and API behavior.
- Validate Pinterest batch defaults in staging under high-scene projects and tune `PINTEREST_BATCH_SIZE` / `PINTEREST_BATCH_PAUSE_MS` if provider throttling increases.
- Consider adding explicit toast UX for Preview step stream failures (currently logs and exits gracefully).
