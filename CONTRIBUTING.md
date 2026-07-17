# Contributing to Ship Tickets

Thanks for helping make fair ticketing infrastructure available to more venues.

## Before you start

1. Search existing issues and Discussions.
2. For material product or architecture changes, open an issue before writing code.
3. Never include real customer data, credentials, private anti-bot thresholds, or production configuration.

## Development workflow

Prerequisites are Node.js 24, pnpm 11, and a running Docker daemon. The database integration test starts a short-lived PostgreSQL 16 container and removes it after the test.

```bash
corepack enable
corepack prepare pnpm@11.13.1 --activate
pnpm install
cp .env.example apps/web/.env.local
pnpm check
```

Create a focused branch from `main`:

- `feat/<description>`
- `fix/<description>`
- `docs/<description>`
- `ci/<description>`

Use Conventional Commits, for example `feat(events): add draft event form`.

## Pull requests

A pull request should:

- Link one issue.
- Explain the user-visible outcome.
- Include tests for new behavior and regressions.
- Pass `pnpm check`.
- Preserve tenant isolation and package boundaries.
- Update `.env.example` and documentation when configuration changes.
- Avoid unrelated refactors.

Business logic belongs in `packages/core`. Vendor SDK access belongs in the relevant adapter package, never directly in `apps/web`.

## Testing discipline

Use red-green-refactor for behavior changes:

1. Write the smallest failing test.
2. Run it and confirm the expected failure.
3. Add the minimum implementation.
4. Run the focused test and then the full quality gate.

## Contribution terms

Unless explicitly stated otherwise, contributions intentionally submitted for inclusion are provided under the Apache License 2.0, including its patent grant and contribution terms.

Participation is governed by [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
