# Backend Refactoring Log

## Findings

- Backend lint rules existed but were bypassed with `eslint-disable` comments in production and test files.
- `backend/src/orchestrator/tasks/review.js` was 603 physical lines and explicitly disabled `max-lines`.
- Other production files also disabled rules: task cleanup, create, runs, app-server runner, and run helpers.
- The backend did not have an `AGENTS.md` file describing architecture rules.
- High-level source folders mixed business concerns, app delivery, and reusable technical integration code.

## Goals

- Make lint rules executable and non-optional.
- Split backend modules by business domain, keeping shared infrastructure modules free of domain logic.
- Keep every source and test file within the line/function/complexity rules without suppression comments.
- Remove obsolete prompt templates and compatibility leftovers that are not part of the current docker/socket workflow.

## Decisions

- Add backend architecture rules in `backend/AGENTS.md`.
- Add a pre-lint rule guard that rejects any `eslint-disable` directive in backend source, tests, scripts, or config.
- Move generic constants, filesystem, process, Git, Codex app-server, and Docker/process shutdown code into `src/shared`.
- Move account and task business code into `src/domains`.
- Keep HTTP delivery code separate from domain code and make it depend on domain/application contracts.
- Use the current Orchestrator class as an application composition root only; domain methods attach there but domain implementation files live under `src/domains`.

## Work Plan

1. Install local backend dependencies so lint and tests run against the pinned toolchain. Done.
2. Add architecture and lint-enforcement documentation. Done.
3. Split oversized task review/run/create/cleanup modules into cohesive business capability files. Done.
4. Move stable infrastructure contracts to `src/shared` and update imports. Done.
5. Split oversized tests/helpers and remove all lint suppressions. Done.
6. Remove unused prompt templates and stale references. Done.
7. Run lint and tests, then fix regressions. Done.

## Completed Changes

- Added `backend/AGENTS.md` with dependency direction, domain module, shared infrastructure, and file-rule requirements.
- Added `backend/scripts/enforce-lint-rules.js` and wired it into `npm run lint`.
- Replaced the large task review module with focused review target, log, state, runtime, and orchestration modules.
- Replaced the large task run module with focused run transition, deferred start, finalization, process start, and branch-sync modules.
- Replaced the large create module with creation worktree, metadata, runtime, and method modules.
- Replaced the large cleanup module with deletion and publication modules.
- Moved reusable constants, filesystem, process, Git, Docker, and Codex app-server code under `src/shared`.
- Moved task business operations under `src/domains/tasks/operations`.
- Tightened `max-lines` to physical line counting, split oversized tests/helpers, and removed every lint suppression directive.
- Removed unused `ORCHESTRATOR_DEVELOPER_INSTRUCTIONS.md`; the remaining root templates are still referenced by runtime code.

## Verification

- `npm run lint` passes with the no-disable guard active.
- `npm test` passes: 81 test files and 267 tests.

## Review Follow-up

- Fixed task creation cleanup so the worktree path is retained after checkout succeeds, even if later initial file setup fails before metadata persistence.
- Fixed commit-and-push preparation so an existing stopped transition claim is passed through to commit guards instead of being shadowed by the release function.
- Fixed task creation metadata so normalized `model` and `reasoningEffort` values are persisted for later task operations.
- Added regression tests for the reviewed cases.
