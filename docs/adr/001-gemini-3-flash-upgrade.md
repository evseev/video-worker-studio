# ADR-001: Upgrade Script Generation Model to Gemini 3.0 Flash

**Date:** 2026-03-14
**Status:** Superseded (current runtime uses `gemini-2.5-flash`)
**Affects:** `src/lib/ai/generate-script.ts`

## Context

The script generation step (`generate-script`) uses Google Gemini via `@google/generative-ai` to produce a structured JSON scene list from a user-provided topic. The original implementation used `gemini-2.0-flash`.

## Decision

Upgrade the model identifier from `gemini-2.0-flash` to `gemini-3-flash`.

## Rationale

- **Better reasoning.** Gemini 3 Flash combines Pro-level reasoning with Flash-level latency and cost, producing higher quality scripts with more vivid, specific search keywords.
- **Same cost tier.** Flash pricing remains the lowest in the Gemini family — no budget impact.
- **Same SDK.** No changes required to `@google/generative-ai`; the model string is the only difference.
- **GA availability.** Gemini 3 Flash has been in preview since Dec 2025 and is available via the Gemini API in Google AI Studio.

## Consequences

- Script quality should improve (better hooks, more visual keywords).
- If Google deprecates the preview tag, the model string may need updating to a versioned alias (e.g. `gemini-3-flash-001`).
- No breaking changes to downstream consumers — the Zod validation schema remains identical.

## Superseded Note

The active code path currently targets `gemini-2.5-flash` in `src/lib/ai/generate-script.ts` and wizard AI helpers. This ADR remains as historical context for the earlier model-evaluation decision.
