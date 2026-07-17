# Ship Tickets

**Fair ticketing. Open rails.**

Ship Tickets is an open-source, modular ticketing platform for independent venues, DIY organizers, and the fans who should not have to fund unnecessary middlemen.

> **Project status:** Foundation skeleton. The public app, provider contracts, configuration rules, tests, and CI are in place. Event creation and ticket issuance are the next vertical slice.

## Product contract

| Mode         | Operator           |      Ship Tickets fee |
| ------------ | ------------------ | --------------------: |
| Self-hosted  | Venue or organizer |       $0 platform fee |
| Mixt Hosted  | Mixt Labs          | $2.22 per paid ticket |
| Free tickets | Either mode        |   $0 Ship Tickets fee |

Card processors and infrastructure providers may charge their own fees. “No platform fee” does not mean a paid card transaction has no processing cost.

## Architecture

The MVP is intentionally small: one Next.js application, one PostgreSQL database, and vendor-specific integrations behind package interfaces.

```text
apps/web → packages/core → auth / db / payments / storage / email adapters
```

AWS, DynamoDB, Solana, NFTs, and a resale marketplace are deferred until a measured requirement justifies them.

### Workspace

- `apps/web` — Next.js App Router application and route handlers.
- `packages/core` — framework-neutral ticketing domain contracts and use cases.
- `packages/config` — typed deployment configuration and policy enforcement.
- `packages/auth` — authentication provider contract.
- `packages/db` — PostgreSQL repository boundary.
- `packages/payments` — free, self-hosted, and Mixt Hosted payment rules.
- `packages/storage` — minimal object-storage contract.
- `packages/email` — transactional email contract.
- `packages/shared` — intentionally small cross-package types.

Application code must not import database, Stripe, Supabase, storage, or email SDKs directly. Vendor code belongs in its adapter package.

## Local development

Requirements:

- Node.js 24+
- Corepack

```bash
corepack enable
corepack prepare pnpm@11.13.1 --activate
pnpm install
cp .env.example apps/web/.env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The machine-readable health endpoint is at `/api/health`.

## Quality gate

```bash
pnpm check
```

The check runs formatting, linting, TypeScript, unit tests, and the production build. Pull requests must leave this command green.

## Guiding principles

- Multi-tenant and tenant-scoped from the first database query.
- One codebase for self-hosted and hosted deployments.
- PostgreSQL first; add distributed infrastructure only after measurement.
- Free events work without a payment processor.
- Self-hosted mode cannot charge a Mixt platform fee.
- Payment, ticket issuance, scans, and webhooks are idempotent and auditable.
- The repository contains algorithms and safe defaults—never production secrets.

## Roadmap

1. Foundation and deployment skeleton.
2. Free event: organizer → buyer → ticket.
3. Stripe test-mode checkout and idempotent issuance.
4. Rotating QR and door scanner.
5. Controlled venue pilot and operational hardening.
6. Self-host documentation and public launch.

See [`CLAUDE.md`](./CLAUDE.md) for the full product vision. Architecture decisions will be revised there as implementation evidence replaces pre-build assumptions.

## Contributing and security

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a pull request. Do not report vulnerabilities in public issues; follow [`SECURITY.md`](./SECURITY.md).

## License

Licensed under the [Apache License 2.0](./LICENSE). The license covers the code, not permission to imply endorsement by Mixt Labs or use Ship Tickets branding as your own hosted service; see [`TRADEMARKS.md`](./TRADEMARKS.md).
