# ADR 002: Subject De-duplication for Long Scenarios

> **Scope update (Epic 25):** ADR-002’s *cross-video* memory was originally described per **user**. The product now scopes that memory per **channel**; see [ADR 003 — Channel-scoped subject memory](./003-channel-scoped-subject-memory.md). In-video dedupe in this ADR remains authoritative.

## Status

Accepted

## Context

Long videos (for example 50 scenes) are generated in chunks inside `generateStructureChunked`. Each chunk was produced independently, so the model had no memory of subjects used in earlier chunks. This caused repeated entities (same actor/person/topic appearing multiple times in one scenario).

Additionally, generation had no persistent memory of subjects used in recent completed videos for the same user, so near-duplicate channel content could recur across videos.

## Decision

We implement a hybrid de-duplication strategy:

1. In-video de-duplication (deterministic text normalization):
   - Add `subjectKey` to every generated scene schema.
   - Normalize and track subject keys across chunk generation.
   - Pass an exclusion list into each subsequent prompt.
   - Retry a chunk once when too many collisions are detected.

2. Cross-video memory (persistent + semantic ranking):
   - Add `video_subjects` table in Supabase with optional embedding vector.
   - Persist subject keys after successful render completion.
   - On future generation, load subjects from the user's latest N completed projects.
   - Rank by similarity to current idea embedding when available, with chronological fallback.

3. Safety and control:
   - `SUBJECT_MEMORY_ENABLED` kill switch.
   - `SUBJECT_MEMORY_LIMIT` and `SUBJECT_MEMORY_MAX` to bound query and prompt size.
   - Memory persistence failures are non-blocking and do not fail completed renders.

## Consequences

Positive:
- Eliminates repeated subjects within long, chunked scenarios.
- Reduces duplicate topics/entities across a user's recent video history.
- Keeps rendering resilient even if memory persistence fails.

Trade-offs:
- Slightly larger prompts due to exclusion lists.
- Added storage and embedding compute cost.
- Additional migration and RPC maintenance overhead.

## Migration

- `supabase/migrations/20260421120000_add_video_subjects.sql`
  - Enables `vector` extension.
  - Creates `video_subjects` table.
  - Adds indexes and SELECT RLS policy.
  - Adds `worker_insert_video_subjects` SECURITY DEFINER RPC for worker writes.
