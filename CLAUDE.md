# Ship Tickets — Project Plan & Build Guide

**Owner:** Mixt Labs (Justin)
**Status:** Foundations underway — tested monorepo skeleton built
**Last updated:** 2026-07-17

This document is the source of truth for the Ship Tickets build. Drop it into any Claude session to restore full context — architecture, tier model, schema, build order, content plan, and constraints — without re-explaining.

---

## 1. Vision

Ship Tickets is the rebuild of Mix Tickets, the ticketing venture Justin started in 2022 in partnership with GET Protocol. The original product worked but was throttled by a vendor that locked the team into a sales-gated onboarding flow and made fast iteration impossible. In 2026 — with serverless infrastructure, Privy-style embedded wallets, Solana-grade settlement speed, and AI coding tools that compress months of work into weekends — the same product is buildable solo, openly, and on rails Mixt Labs controls end-to-end.

**The mission has not changed:** strip middlemen out of event ticketing, kill scalping at the protocol level, and put authentic, anti-fraud tickets in the hands of real fans at fair prices, with a transparent resale layer the platform enforces.

**What's new:** the build is solo, the IP sits cleanly under Mixt Labs from line one, the codebase is open source, and the long arc is broader than ticketing — it's a stack of composable agentic tools for DIY/decentralized event production (permits, venue booking, artist outreach, marketing, payouts). Ship Tickets is the first surface; the rest follows once the rails are proven.

---

## 2. The three-tier deployment model

| Tier | Audience | Payment rails | Mixt Labs role | Fee |
|------|----------|--------------|----------------|-----|
| **0 — OSS** | Self-hosters, hobby organizers, devs forking | None (or whatever they wire in) | None — pure open source | $0 |
| **1 — Mixt Hosted (Stripe)** | Small/mid venues that want fiat and don't want to operate infrastructure | Stripe Connect | Run the multi-tenant instance | Stripe cost + $2.22 per paid ticket |
| **2 — Mixt Hosted (Solana)** | Crypto-native events, DIY shows with multi-party payouts, anything that needs atomic splits | Solana via Privy embedded wallets | Run the program + the hosted instance | Solana network fees + small platform fee |

**Same codebase across all three.** Deployment config flips the payment processor and the auth options. Tier 0 is the marketing engine and the proof. Tier 1 is the cash flow. Tier 2 is the differentiator — the only tier where automatic payout splits to N recipients are trivial to configure (no Stripe Connect KYC per recipient).

---

## 3. Core principles

- **Serverless from line one.** Pay nothing when idle, scale to whatever a hot drop throws at it.
- **Multi-tenant from line one.** Every event belongs to an `organization_id`. Every authenticated use case and query checks the tenant. Branding, payout config, resale rules all per-tenant. White-label is a config change, not a fork.
- **One repo, one codebase.** Tier 0/1/2 are deployment modes, not separate products.
- **Anti-scalping is built into the core.** Not a feature, not optional — it's why the product exists.
- **Open source from Slice 1.** Repo is public when the first commit lands, not when v1 is "ready."
- **Solo owner, no co-founders.** Contributors work through PRs under the repository's Apache 2.0 contribution terms; add a DCO or CLA only after legal review shows it is needed. Future material partnerships happen as separate agreements with explicit cap-table conversations — never handshakes.
- **Vertical slices, not horizontal layers.** Build one full feature end-to-end at a time. Each slice ends with a working demo.

---

## 4. Architecture

### Implemented MVP stack
- **Workspace:** pnpm + Turborepo on Node.js 24
- **Frontend/API:** Next.js 16 App Router, TypeScript, Tailwind, and Route Handlers in `apps/web`
- **Business logic:** framework-neutral use cases and domain contracts in `packages/core`
- **Database:** standard PostgreSQL via Drizzle behind `packages/db`; Supabase Postgres is the first hosted target
- **Auth:** provider-neutral `packages/auth`; Supabase Auth phone OTP is the canonical MVP login/session provider for Tier 0/1, with Privy trusting the same session via JWT-based auth when embedded wallets are enabled (see [`docs/decisions/0003-supabase-phone-auth-and-privy-wallets.md`](./docs/decisions/0003-supabase-phone-auth-and-privy-wallets.md))
- **Storage:** minimal S3-compatible interface in `packages/storage`
- **Email:** provider interface in `packages/email`, with console and Resend drivers planned first
- **Payments:** free/self-hosted/Mixt Hosted policy in `packages/payments`; Stripe Connect is the first paid adapter
- **Deployment config:** typed policy in `packages/config`; self-hosted mode cannot charge a Mixt platform fee
- **Hosting:** Vercel for Mixt Hosted initially; commercial usage requires an appropriate paid plan
- **Monitoring:** structured logs and Sentry before the first live pilot

### Why one serverless application first
Next.js Route Handlers plus PostgreSQL provide the shortest path to a working organizer-to-door flow while remaining pay-for-use and easy to self-host. Tickets, inventory holds, orders, and scans stay in PostgreSQL until load tests or a real event prove a distributed hot-data store is necessary. AWS Lambda, DynamoDB, SQS, EventBridge, and Aurora are migration options, not MVP dependencies.

### Tenant isolation
- PostgreSQL: every tenant table has `org_id`, and Row Level Security provides defense in depth
- Application: auth resolves a user and membership before core use cases run
- Repositories: every tenant operation requires explicit `orgId`; no unscoped list/update methods
- Connection pooling: tenant/user context is transaction-local, never connection-global
- Storage: tenant-prefixed object keys
- Tests: create two organizations and prove cross-tenant reads and writes fail

---

## 4.5 MVP and Tier 0: Supabase + Vercel, with pluggable backends

Supabase Postgres is the right starting point for two converging reasons. First, it's the fastest path to MVP for Mixt Hosted — features shipping in days, not weeks. Second, it's a low-friction deployment target for **Tier 0 self-hosters** who do not want AWS account setup. The same standard PostgreSQL code supports both.

Mixt Hosted starts with the implemented architecture in section 4 and moves to AWS only when measured scale, SLA, or compliance requirements demand it. Tier 0 can remain on Supabase or any compatible PostgreSQL provider indefinitely.

### Why Supabase fits both MVP and Tier 0 self-host
- Postgres + Storage + optional Realtime in one platform, with a useful administration UI
- Free tier covers MVP through first paying venues; most self-hosted small venues never exceed it
- Genuinely low lock-in: standard Postgres, S3-compatible storage, JWT auth, entire stack open source and self-hostable as escape valve
- Built-in Row Level Security maps cleanly to the multi-tenant model
- Supabase Studio gives a free admin UI — no need to build internal tools yet
- Self-hosters get the same dev experience Mixt Hosted has, which means contributions back to the codebase actually work

### Pluggable backends: the anti-lock-in design

The codebase treats infrastructure as configurable, not coupled. A self-hoster on Supabase Cloud, a Mixt Hosted instance on AWS, a venue running self-hosted Supabase in their own datacenter, and a paranoid org running raw Postgres + MinIO somewhere weird — all use the same code with different env vars. **The interfaces, not the implementations, are the contract.**

- **Database:** standard Postgres connection string via `DATABASE_URL`. Queries go through Drizzle ORM (speaks Postgres wire protocol, no vendor SDK). Works identically on Supabase, Aurora, RDS, Neon, Railway, self-hosted — any Postgres ≥14.
- **Storage:** S3-compatible API via `STORAGE_ENDPOINT` + credentials. The AWS S3 SDK works against Supabase Storage, MinIO, Cloudflare R2, AWS S3, any S3-compatible target. No Supabase Storage SDK imported anywhere in the codebase.
- **Auth:** internal user IDs are provider-independent. `packages/auth` selects the Supabase Auth adapter, a deterministic test adapter, or an optional Privy wallet-linking adapter; application code does not depend on a provider subject format. Every domain record references the internal user id; an `auth_identities` table maps unique `(provider, subject)` pairs to it.
- **Email:** abstracted behind a `send(to, template, vars)` function with provider drivers: `resend`, `ses`, `sendgrid`, `console-log` (for dev). New drivers are ~30 lines each.
- **Payments:** Stripe and Solana are independent modules, enabled per deployment via env config. Tier 0 self-host can run Stripe-only, Solana-only, both, or neither (test mode).
- **Realtime:** door-scan live counts default to 1-second polling. WebSockets via Supabase Realtime is opt-in via `REALTIME_PROVIDER=supabase` and treated as enhancement, not a dependency.
- **Runtime wrappers:** business logic lives in `packages/core`. Next.js Route Handlers are the first wrapper; a future Lambda or edge wrapper calls the same use cases only when needed.

### What this looks like in practice
`.env.example` lives in the repo with safe placeholders. The launch target is a self-hoster choosing providers, filling in keys, and deploying without application code edits. Mixt Hosted is one validated provider configuration among many possible configurations.

The discipline rule that makes this hold: never import a Supabase or AWS SDK directly into application code. All vendor-specific code lives inside `packages/db`, `packages/storage`, `packages/email`, etc. Application code imports from the package, not the vendor. Every PR that violates this gets a comment.

### Migration trigger (for Mixt Hosted only)

Move Mixt Hosted to AWS when *any* of these happens:
- A hosted-tier customer is paying enough that downtime costs them real money (need SLA-grade infrastructure)
- Supabase pro tier limits get tight on connection pooling, storage, or function invocations
- You need DynamoDB-style hot-data performance for a high-traffic drop (rare; Postgres + caching usually handles it)
- An enterprise venue specifically requires AWS for compliance reasons

If none of these is true, stay on Supabase. "We might need to scale" is not a migration trigger. **Tier 0 self-hosters never need to migrate** — Supabase is their permanent stack.

### Migration plan (when triggered, Mixt Hosted only)
Because the abstractions are clean, this is roughly one focused week:
1. Provision Aurora Serverless v2, `pg_dump` from Supabase, restore to Aurora (a few hours)
2. Update `DATABASE_URL` env var — application code unchanged because Drizzle speaks standard Postgres
3. Update `STORAGE_ENDPOINT` env var to point at native S3 — application code unchanged because the S3 SDK is identical
4. Select the appropriate auth adapter; internal user IDs and application authorization remain unchanged
5. Move any Edge Functions to Lambda by wrapping the existing handlers
6. Update env vars in Vercel/Amplify, redeploy, verify, cut DNS

The migration being easy *because the abstractions were right from line one* is the content piece, not the migration itself.

---

## 5. Data schema

Carrying forward the schema from the original Bubble build, evolved for a PostgreSQL-only MVP. DynamoDB remains a future migration option for measured hot-data pressure.

### PostgreSQL — MVP relational and ticket data
```
organizations
  id (PK), name, slug, logo_url, currency, brand_color,
  privacy_policy_url, tos_url, stripe_connect_id,
  solana_payout_address, created_at, updated_at

users
  id (PK), privy_did, email, phone, display_name,
  primary_wallet, created_at, updated_at

org_members
  org_id (FK), user_id (FK), role (owner|admin|staff),
  PRIMARY KEY (org_id, user_id)

events
  id (PK), org_id (FK), slug, name, description,
  start_at, end_at, venue_name, venue_address,
  cover_image_url, status (draft|live|sold_out|cancelled|complete),
  max_capacity, sales_open_at, sales_close_at,
  created_at, updated_at

ticket_types
  id (PK), event_id (FK), name, description, price_cents,
  currency, total_supply, per_wallet_limit, resale_enabled,
  resale_price_cap_pct, sort_order

orders
  id (PK), org_id (FK), event_id (FK), user_id (FK),
  total_cents, currency, status (pending|paid|refunded|failed),
  payment_processor (stripe|solana), payment_ref,
  created_at, updated_at

payout_splits  -- new in Ship Tickets, didn't exist in original
  id (PK), event_id (FK), recipient_label,
  recipient_address, recipient_stripe_id, percent_bps,
  -- percent_bps in basis points; sum across splits must equal 10000
  created_at

scans  -- entry log
  id (PK), ticket_id (FK), scanner_user_id (FK),
  scanned_at, gate_label, accepted (bool), reject_reason
```

### Future DynamoDB option — not part of the MVP
```
tickets table
  PK: ORG#{org_id}#EVENT#{event_id}
  SK: TICKET#{ticket_id}
  attrs: owner_wallet, owner_user_id, ticket_type_id,
         status (issued|transferred|scanned|refunded),
         qr_seed, qr_rotation_started_at,
         solana_mint_address (nullable), order_id

inventory_holds table
  PK: ORG#{org_id}#EVENT#{event_id}#TYPE#{ticket_type_id}
  SK: HOLD#{user_id}#{expires_at}
  attrs: quantity, expires_at (TTL)
```

DynamoDB TTL handles hold expiration automatically. Tickets table partitioned so a single event's reads/writes don't hot-spot other events.

---

## 6. Anti-scalping mechanics

The original GET Protocol playbook is correct. Re-implement it under our control:

1. **Wallet-bound tickets by default.** A ticket is issued to a Privy user's primary wallet. Default `resale_enabled = false` per ticket type. Resale is opt-in by the organizer.
2. **Rotating signed QR codes.** Client polls the API every ~30 seconds for a fresh JWT-encoded QR payload signed with an HMAC of `(ticket_id, current_window, server_secret)`. Old codes invalidate within 60s. Screenshots become useless.
3. **QR hidden until event window.** Per the original spec, the QR doesn't render in the buyer's app until the organizer's configured "doors open" time. No data to leak before then.
4. **Code disappears after first valid scan.** Status transitions to `scanned` and the rotating endpoint returns 410 for subsequent requests on that ticket.
5. **Per-wallet purchase cap.** Configured per `ticket_type` (`per_wallet_limit`). Enforced server-side at order creation against the Tickets index by `owner_wallet`.
6. **Platform-only resale with price cap.** When `resale_enabled = true`, sellers list at the original price plus an organizer-configured percentage (default 0%). All resale flows through the platform — no off-platform transfers possible because the ticket is wallet-bound and the QR is dynamic.
7. **Edge bot mitigation.** WAF rate limits per IP, Turnstile challenge before checkout, no public ticket inventory endpoint that bots can scrape.
8. **Phone verification (optional).** Privy supports phone auth; high-demand events can require phone-verified accounts to purchase, replicating the original phone-binding design.

---

## 7. Build order (vertical slices)

Each slice is one focused work session, ends with a working demo, gets its own commit/PR/post.

### Slice 1 — Foundations
*Goal: deploy the tested Next.js skeleton, then add provider-neutral auth and PostgreSQL through the established abstractions. Repo public, deploy pipeline live.*
- Monorepo (Turborepo): `apps/web`, `packages/core`, `packages/config`, `packages/db`, `packages/auth`, `packages/payments`, `packages/storage`, `packages/email`, `packages/shared`
- `packages/db` uses Drizzle against a standard Postgres `DATABASE_URL`. No Supabase client.
- `packages/auth` exposes a provider-neutral contract; implement a deterministic test adapter and the Supabase Auth phone OTP adapter first, with Privy optional later (per [ADR 0003](./docs/decisions/0003-supabase-phone-auth-and-privy-wallets.md)).
- `packages/storage` uses the AWS S3 SDK against `STORAGE_ENDPOINT` (set to Supabase Storage for MVP).
- `packages/email` exports `send()` with a `resend` driver for now; `console-log` driver for dev.
- Supabase project created, RLS enabled, initial schema migrated via Drizzle migrations
- Supabase Auth phone OTP login working in the Next.js app; Privy stays optional and is not required for Slice 1
- Next.js Route Handler `GET /api/me` returns the authenticated user via `packages/auth`
- Vercel deployment connected to `main`, env vars wired
- `.env.example` committed with placeholders for every backend choice (DB, storage, auth, email, payments)
- `SECURITY.md` and `CONTRIBUTING.md` committed
- Repo made public

### Slice 2 — Event & Ticket sales
*Goal: an organizer can create an event, a buyer can purchase a ticket with Stripe test mode, both can see it in their dashboard.*
- Organization onboarding (create org, basic profile)
- Event creation form (name, date, venue, cover image, capacity)
- Ticket type creation with pricing
- Public event page at `/events/{org-slug}/{event-slug}`
- Stripe Connect Express onboarding for the org
- Checkout flow → Stripe → webhook → order + ticket issued in DB
- Buyer dashboard showing owned tickets
- Email receipt via Resend

### Slice 3 — Entry (the scanner)
*Goal: a venue staffer can scan a ticket at the door and see "valid / already scanned / invalid" in under a second.*
- Rotating QR endpoint + client poll
- Scanner PWA route at `/scan/{event-id}` using `BarcodeDetector` API + camera
- Scan validation Lambda: verify HMAC, check status, transition to `scanned`, log
- Real-time count dashboard for organizer (WebSockets via API Gateway)

### Slice 4 — Resale & anti-scalping
*Goal: a buyer who can't attend can list their ticket; another buyer can purchase it; price cap is enforced; bots can't scrape.*
- Resale listing flow (when `resale_enabled = true`)
- Resale purchase flow (transfers ticket to new owner, prior owner refunded)
- WAF rules + Turnstile challenge on checkout
- Per-wallet limit enforced
- Refund flow (organizer-initiated and self-service)

### Slice 5 — Solana tier
*Goal: same product, but checkout settles in SOL or USDC on Solana with atomic payout splits, and the ticket is minted as an NFT to the buyer's Privy wallet.*
- Anchor program: `purchase_ticket` instruction that takes payment, splits to N recipient addresses per `payout_splits`, mints NFT to buyer in one transaction
- Solana checkout UI via Privy
- Split configuration UI on event creation
- Devnet deployment + tests, then mainnet-beta deployment with audit

### Slice 6 — Polish, docs, launch
*Goal: someone who finds the repo can self-host their own instance in under an hour, and the launch post goes live.*
- Self-host guide (`docs/self-hosting.md`)
- One-command deploy script (`pnpm deploy:fresh`)
- Architecture docs with the diagrams
- README that tells the story (rebuild of Mix Tickets, open source, three tiers)
- Launch post + thread

### Out of scope for v1
- Mixt Collective NFT membership tiers (Selecta / Hero / Legend) — reintroduce after Slice 6
- DAO/governance token — much later, only if community organically forms
- Marketing automation (OpenAI report generation, DALL-E flyer generation) — Slice 7+
- Native mobile apps — PWA is sufficient for v1
- Custom domain per tenant — Slice 7+
- Seat-map / reserved seating — Slice 8+

---

## 8. Content plan

The build *is* the content. Every slice generates one or more posts, threads, or videos. The series is what builds the audience; the platform is what gets shipped along the way.

### Arc 1 — Origin (pre-Slice 1, then ongoing as backstory)
- Long-form post: "I tried to take down Ticketmaster in 2022. Here's what happened and why I'm rebuilding it for free." Tell the GET Protocol story, the lock-in, the lessons.
- Thread version on X with screenshots from the old Bubble build.
- The narrative hook: not "look at my cool startup" but "this is what I learned, and here's me trying again with better tools and no middlemen."

### Arc 2 — The build (one piece per slice)
- Slice 1: "Why I'm doing this serverless and open source from day one"
- Slice 2: "How I built event creation and ticket sales in a weekend"
- Slice 3: "Rotating QR codes that make screenshots useless" (this one is genuinely interesting tech and will earn shares)
- Slice 4: "Killing scalping at the protocol level"
- Slice 5: "Why crypto rails actually matter for one specific thing: paying everyone instantly"
- Slice 6: "Ship Tickets is live and the repo is public. Here's how to run your own."

### Arc 3 — Case studies (post-launch)
- Every venue/event ships a post. "Here's how we ran a 400-cap show with 1.8% in fees instead of 35%."
- Eventually: "Here's a community-run show where the lineup was voted on by ticket-holders." This is where the Mixt Collective vibe quietly returns.

### Cross-channel format
- **Long-form:** blog/Substack
- **X threads:** with diagrams from the build
- **YouTube:** 5–10 min walkthrough per slice
- **TikTok/Reels:** 60-second teaser per slice
- All diagrams are reusable assets — render once, repurpose everywhere.

### The AI/human framing
The series threads a specific narrative through every post: AI tools handle the boring infrastructure work (Terraform, boilerplate, test scaffolding, repetitive UI code) so the human does the high-judgment creative work (the architecture decisions, the venue relationships, the content, the artistic vision). Not "AI built this" — "AI made it possible for one person to build what used to take a team and a Series A." This positioning matters for both the audience and the long arc; the agentic event-production stack (permits, booking, marketing) is the next product family if Ship Tickets lands.

---

## 9. Open source approach

- **License:** Apache 2.0. Permissive, allows commercial forks, no GPL contagion. Optional separate "Mixt Hosted" trademark that only Mixt Labs can use commercially.
- **Repo public from Slice 1.** No "build privately and reveal." The dev process is the marketing.
- **Contributor License Agreement (CLA).** Standard one (e.g. from cla-assistant.io). Protects Mixt Labs' ability to relicense or commercialize without ambiguity.
- **No equity for contributors.** PRs are PRs. Material partnerships are separate explicit agreements.
- **Consultation as a separate paid offering.** If a venue or platform wants a custom white-label build, that's a paid engagement with Mixt Labs — not a community contribution.

---

## 9.5 Secrets and private config: the open-source boundary

Open source is the right call, but security depends on a clean separation between what lives in the public repo and what lives in private infrastructure. The principle is old (Kerckhoffs, 1883) and modern security depends on it: the system stays secure when attackers know how it works, because what they don't have are the secrets.

### What lives in the public repo
- The full architecture and stack
- All schemas, migrations, and table definitions
- All algorithms (HMAC scheme for QR rotation, signature verification, payout split math)
- Default configurations that are safe to be public (e.g. `qr_rotation_window_seconds = 30`)
- Tests, including ones that exercise security edges
- Self-hosting documentation including environment variable templates with placeholder values
- The Solana program source (it's on-chain anyway — public is the only mode)

### What lives in private infrastructure, never in the repo
- **Cryptographic secrets:** HMAC keys for QR signing, JWT signing secrets, Privy app secret, Stripe webhook signing secret, Solana program upgrade authority keypair. All in Supabase Vault (MVP) or AWS Secrets Manager (production).
- **Specific tuning thresholds:** per-IP rate limits, per-account purchase velocity caps, WAF rule thresholds, Turnstile site secret. These are env vars or per-tenant config rows, not constants in code.
- **Anomaly detection heuristics:** if/when behavioral detection ships (e.g. "flag accounts buying at exactly the millisecond sales open"), the heuristics live in a private config feed, not in source.
- **Known-bot fingerprints:** an updateable allow/deny list maintained operationally, not committed.
- **Any future ML detection models:** model weights, training data, and inference thresholds stay private. Open-source the model-calling code; keep the model itself proprietary. This is the standard pattern for Cloudflare, AWS, and Google bot detection.

### How the boundary is enforced
- `.env.example` with placeholder values lives in the repo
- Real `.env` is gitignored
- Pre-commit hook scans for secret patterns (use `gitleaks` or `trufflehog`)
- Secrets rotation is a documented runbook, not an ad-hoc operation
- Any contributor PR that introduces a hard-coded threshold gets a comment to move it to env config

### Bug bounty
Once Mixt Hosted is moving real money, open a small bug bounty (HackerOne or just a `SECURITY.md` policy in the repo): tiered rewards from $100 for low-severity to $5,000+ for critical. Open-source code makes this work — researchers can actually audit and report. This is one of the strongest *security* arguments for open source: closed-source platforms have the same vulnerabilities but find out about them via Twitter after a show breaks.

### Common-sense sanity check
The HMAC algorithm being public is fine. The HMAC key being public would be catastrophic. The schema being public is fine. The Supabase service-role key being public would be catastrophic. Those are two different things and the line between them is what this section exists to make explicit.

---

## 10. Operational/legal items to handle as we go

- Florida ticketing law check (more permissive than NY/CA on resale, but check the secondary-market disclosure rules)
- Stripe Connect Express onboarding for tenants (KYC handled by Stripe)
- Terms of Service + Privacy Policy (tier-specific where they differ)
- Solana program audit before mainnet money (Slice 5 → Slice 6 gate)
- Show-night ops: phone number that someone answers, runbook for "what if the venue's WiFi dies"
- Insurance: minimum E&O once real money is moving through Mixt Hosted instances
- Mixt Labs entity hygiene: separate bank account for any Mixt Hosted revenue, clean accounting

---

## 11. Workflow notes for future Claude sessions

When picking this project up in a new session:
1. Drop this CLAUDE.md into the session as context (or reference it by path).
2. State which slice you're working on.
3. Ask for a specific deliverable within that slice (don't ask for "the next thing" — ask for "write the rotating QR Lambda" or "draft the event creation form").
4. Build vertical slices end-to-end. Resist horizontal layering ("all the frontend first").
5. Open the repo as you go. Every working slice ships. No "I'll clean it up before pushing."
6. Each slice produces a piece of content. Don't separate building from documenting.
7. **Route every infrastructure touch through the abstractions.** Database access via `packages/db`. Storage via `packages/storage`. Auth via `packages/auth`. Email via `packages/email`. Never import a Supabase or AWS SDK directly into application code (`apps/web`). The Tier 0 self-host story only works if this discipline holds at every PR. If a feature genuinely needs a backend capability the abstraction doesn't expose, add it to the abstraction first, then use it in application code — same PR, two commits.

When the architecture or scope materially changes, update this doc and commit it to the repo at `/CLAUDE.md` so the canonical version always lives with the code.

---

## 12. The long arc (for context, not for v1)

Ship Tickets is the first surface in a larger thesis: **agentic, decentralized event production**. Once tickets ship, the next products in the stack are composable agents that handle the parts of putting on a show that currently require teams or expensive vendors:

- Permit application drafting and submission
- Venue search, outreach, and contract negotiation
- Artist booking and rider negotiation
- Marketing copy, flyer generation, paid-ad management
- Vendor coordination (sound, lighting, security)
- Post-event settlement and accounting

Each one is a separate product riding the same auth, payments, and data primitives Ship Tickets establishes. The goal is to compress what currently requires a $50k production budget and a six-person team into something one person + a stack of agents can run end-to-end, with the community marketing it and the artists/staff getting paid atomically on chain.

This is not v1 scope. It is the reason v1 is worth building.
