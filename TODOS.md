# TODOS

## Completed

### Bootstrap automated tests (Vitest + Playwright)

**What:** Add Vitest + `@testing-library/react` and Playwright (or agreed stack) with CI-friendly scripts.

**Why:** Ship and refactor safely without relying only on manual smoke tests.

**Context:** `.gstack/no-test-bootstrap` defers setup; remove it when starting. Prefer `src/__tests__/` once a framework is chosen per `AGENTS.md`.

**Effort:** M
**Priority:** P0
**Depends on:** None
**Completed:** v0.3.0.0 (2026-03-20)
