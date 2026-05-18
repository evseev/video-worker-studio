# ADR 003: Channel-scoped subject memory (supersedes ADR-002 cross-video scope)

## Status

Accepted (Epic 25)

## Context

ADR-002 defined cross-video subject memory as “the user’s latest N completed projects,” regardless of which channel a video belonged to. Epic 25 introduces **channels** as the primary editorial container: creators run multiple channels (e.g. “Tech Facts” vs “Celebrity Drama”) with separate niches, watermarks, and defaults.

Continuing to exclude subjects **across all channels** would:

- Block legitimately reusable entities when the same creator runs two unrelated channels.
- Couple AI exclusions to `auth.users` instead of the product’s publishing unit (the channel).

ADR-002’s **in-video** dedupe (chunk retries, `subjectKey`, normalization) is unchanged.

## Decision

1. **Cross-video horizon is channel-scoped.** `getExcludedSubjectsForChannel` loads the channel’s `subject_memory_lookback` (default 5), then the latest **completed** projects **on that `channel_id`**, then `video_subjects` rows filtered by `channel_id` and those project ids. Ranking by embedding similarity to the current idea is preserved where embeddings exist.

2. **Persistence is channel-scoped.** `persistSubjectsForProject` writes via `worker_insert_video_subjects` with `p_channel_id`; `video_subjects.user_id` is removed at the schema level in favor of `channel_id` as the ownership key (see migrations).

3. **Operational controls** (`SUBJECT_MEMORY_ENABLED`, `SUBJECT_MEMORY_MAX`, per-channel `subject_memory_lookback`) remain the safety valves described in ADR-002.

## Consequences

- **Positive:** Same subject can appear on channel B even if it was recently used on channel A; exclusions stay aligned with a single channel’s content strategy.
- **Positive:** RLS and API authorization can key off `channels.user_id` for all channel-derived rows.
- **Neutral:** RPC backfill correctness and migration race windows are enforced in SQL (transaction + `EXCLUSIVE` lock + verification gates); automated coverage is limited to unit tests on query shape and helpers—full replay is a manual/staging checklist (see Epic 25 design verification).

## Supersedes

- **ADR-002** — Cross-video memory was user-scoped (latest N completed projects for the user). ADR-003 rebases that slice of the design onto `channel_id` while keeping the hybrid in-video / cross-video strategy and embedding ranking behavior.
