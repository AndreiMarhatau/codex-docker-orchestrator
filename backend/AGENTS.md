# Backend Architecture Rules

## Module Boundaries

- Organize backend code by business domain first. Domain folders own behavior such as task lifecycle, task review, environments, accounts, and setup.
- Do not create high-level modules around technical capabilities such as HTTP, Docker, Git, storage, or Codex unless they live under `src/shared`.
- Domain modules may depend on shared infrastructure contracts. Shared infrastructure modules must not depend on domain modules.
- Shared modules must be concrete, reusable, and free of domain decisions. They should expose stable contracts for Git, Docker, Codex app-server, process execution, filesystem storage, and path handling.
- Prefer narrow functions and data contracts over broad service objects. If a change in one domain requires touching unrelated domains, the boundary is wrong.

## Dependency Direction

- `src/shared/**` has minimal outbound dependencies and many inbound dependencies.
- `src/domains/**` may import `src/shared/**` and sibling files inside the same domain capability.
- `src/app/**` is delivery code. It may call domain/application services but must not contain domain logic.
- Avoid circular dependencies. Do not import HTTP routes, request objects, or Express helpers from domain or shared modules.

## File Rules

- Every backend source, test, script, and config file must follow lint rules. No `eslint-disable` directives are allowed.
- Keep files at or under 200 physical lines. Split by business capability before adding helpers to an oversized file.
- Keep functions under 130 effective lines and complexity under 20.
- Keep parameter lists to four parameters or fewer. Use named options objects for cohesive inputs.

## Refactoring Rules

- Remove dead prompt templates, unused fallbacks, and compatibility paths when they are not part of the current Docker socket workflow.
- Do not add defensive fallback behavior unless a current production flow requires it.
- Update tests with the same architectural boundaries as production code.
- New shared infrastructure contracts must be generic enough that implementation details can change locally without changing domain modules.
