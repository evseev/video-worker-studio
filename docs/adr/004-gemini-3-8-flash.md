# ADR 004: Default text model `gemini-3.8-flash`

**Date:** 2026-10-21
**Status:** Accepted (supersedes ADR 001's model choice)

## Context
The owner asked to move text generation to Gemini 3.8 Flash. The local `.env.local` had drifted to
`gemini-3.5-flash-lite`, while the code default still said `gemini-2.5-flash`.

## Decision
- Code default (`src/lib/ai/gemini.ts`) and `.env.local` use `gemini-3.8-flash`.
- `GEMINI_TEXT_MODEL` still overrides it.

## Verification
- `models.list` with the project key returns `models/gemini-3.8-flash` (generateContent supported).
- Smoke test: autopilot pair proposal, narration with JSON `responseSchema`, and the fact-check pass all
  succeed; three generated lines passed the fact check on the first attempt.

## Consequences
- Higher per-call cost than Flash-Lite, still far below the $80/month budget (Gemini ≈ $0.10–0.30 per video).
- The vision photo checks (`src/lib/images/photo-check.ts`) use the same model.
