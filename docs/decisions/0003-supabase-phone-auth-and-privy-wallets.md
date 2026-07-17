# 0003. Supabase phone OTP as canonical MVP auth, with Privy as an optional wallet bridge

- **Status:** Accepted
- **Date:** 2026-07-17
- **Related issue:** [#4 — decision(auth): select the default open authentication adapter](https://github.com/Rendurdreams/ship-tickets/issues/4)

## Context

Ship Tickets needs one default login/session provider for the self-hosted (Tier 0) and
Mixt Hosted Stripe (Tier 1) paths before Slice 2 (event & ticket sales) can build a real
buyer/organizer dashboard. `packages/auth` (`packages/auth/src/index.ts`) currently only
exports a provider-neutral `AuthProvider` contract with a mock adapter selected via
`AUTH_PROVIDER=mock`; no real session provider is wired in yet.

Issue #4 asked for a comparison of Postgres-backed options (Better Auth and others)
against email login, passkeys, self-hosting, licensing, and Next.js support, without
making Privy mandatory. Privy (embedded crypto wallets) is part of the long-term Tier 2
design (CLAUDE.md §2, §4), but per CLAUDE.md §4 the MVP buyer wallet is a PostgreSQL-backed
Ship Tickets ticket wallet, not a crypto wallet — Privy must stay optional and must never
become a second, independent identity system.

CLAUDE.md §4.5 also commits the project to Supabase Postgres as the first hosted database
target and to treating infrastructure as pluggable, not coupled — "the interfaces, not the
implementations, are the contract." Any auth decision has to fit that same discipline:
provider-specific code stays inside `packages/auth`, and every domain record must reference
an internal, provider-independent user id.

### Options considered

| Dimension                                | Supabase Auth (phone OTP)                                                                                 | Better Auth (self-hosted, Postgres)                                                                                | Privy (email/SMS + wallets)                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Email login                              | Yes, built in                                                                                             | Yes, built in                                                                                                      | Yes, built in                                                                                 |
| Phone/SMS OTP                            | Yes, built in (`supabase.com/docs/guides/auth/phone-login`)                                               | Plugin required, self-managed SMS integration                                                                      | Yes, but couples identity to a wallet-centric SDK                                             |
| Passkeys                                 | Supported                                                                                                 | Supported via plugin                                                                                               | Not the primary path                                                                          |
| Self-hosting                             | Full self-host via the Supabase stack (Postgres + GoTrue), matches Tier 0's existing Supabase-first story | Fully self-hosted, no vendor at all                                                                                | No — hosted SaaS only, no self-host escape valve                                              |
| Licensing                                | Supabase Auth (GoTrue) is Apache 2.0                                                                      | MIT                                                                                                                | Proprietary SaaS, commercial terms                                                            |
| Next.js support                          | First-class, widely used with Next.js App Router                                                          | First-class, framework-agnostic core + Next.js adapter                                                             | First-class, but pulls in wallet UI/SDK surface even for pure login                           |
| Fit with Tier 0/1 rails (CLAUDE.md §4.5) | Already the target DB/storage provider; auth rides the same instance                                      | Adds a second stateful service and its own migrations, separate from the Supabase Postgres instance already chosen | Adds an external identity dependency the self-hosted tier cannot run without a vendor account |

## Decision

1. **Supabase Auth phone OTP is the canonical MVP login/session provider** for both the
   Mixt Hosted and the simple self-hosted (OSS) path. It reuses the Postgres instance
   already selected for Tier 0/1 (CLAUDE.md §4.5), ships phone OTP and email login out of
   the box, is Apache 2.0, and self-hosts alongside the rest of the Supabase stack —
   satisfying the self-hosting and licensing criteria in issue #4 without adding a second
   stateful auth service (the gap in the Better Auth option).
2. **Every domain record references an internal Ship Tickets UUID** (`users.id` per
   CLAUDE.md §5), never a raw Supabase `auth.users` id or a raw Privy DID/subject.
   `packages/auth` resolves a provider session to this internal id before any core use
   case runs, consistent with the tenant-isolation rule in CLAUDE.md §4.
3. **A new `auth_identities` table maps unique `(provider, subject)` pairs to internal
   users** — one internal user can have multiple linked identities (e.g. `supabase_phone`
   today, `privy_wallet` later), but a given `(provider, subject)` pair maps to exactly one
   internal user.
4. **Privy does not run as a second independent login system in the MVP.** When embedded
   wallets are enabled in a later slice, Privy trusts the existing Supabase-issued session
   via Privy's documented JWT-based authentication integration
   (`docs.privy.io/authentication/user-authentication/jwt-based-auth/overview`) rather than
   becoming its own source of identity. Wallet identifiers Privy returns are linked to the
   same internal user via `auth_identities`, not treated as a new account.
5. **The initial buyer wallet is a Ship Tickets mobile web/PWA ticket wallet backed by
   PostgreSQL**, per CLAUDE.md §4. Privy crypto wallets remain optional, and tickets stay
   off-chain for the first free and Stripe-mode pilots (Slices 2–4). Privy's SMS login
   surface (`docs.privy.io/authentication/user-authentication/login-methods/sms-whatsapp`)
   is documented here only as the point of reference for the eventual JWT trust bridge, not
   as an alternative MVP login path.

## Detailed flow

**MVP (Tier 0 self-hosted and Tier 1 Mixt Hosted, phone OTP only):**

1. Buyer/organizer enters a phone number; the client requests an OTP from Supabase Auth.
2. Supabase Auth sends the OTP through its configured SMS provider and returns a session
   (JWT) on successful verification.
3. A Next.js Route Handler in `apps/web` calls `packages/auth`, which validates the Supabase
   session and looks up `auth_identities` for `(provider='supabase_phone', subject=<supabase auth.users.id>)`.
4. If the identity exists, `packages/auth` returns the linked internal `users.id`. If it does
   not exist and there is no authenticated session already establishing a different internal
   user, a new internal user and `auth_identities` row are created together.
5. All core use cases and repository calls (CLAUDE.md §4 "Tenant isolation") receive only the
   internal `users.id` — no package outside `packages/auth` ever sees a Supabase subject.

**Later (optional embedded wallet slice, Tier 2 groundwork):**

1. A user with an existing Supabase-authenticated session opts into an embedded wallet.
2. Privy is initialized in JWT-based auth mode, trusting the existing Supabase JWT instead
   of prompting a separate Privy login.
3. Privy returns a wallet address for the already-authenticated user. `packages/auth` writes
   an `auth_identities` row `(provider='privy_wallet', subject=<privy wallet id>)` linked to
   the **same** internal `users.id` resolved in step 1 — never a new user.
4. If no active Supabase session is present, the wallet-linking flow is refused; Privy is
   never allowed to originate a new internal identity on its own.

## Security requirements

- **Real phone OTP requires**, before any production traffic:
  - A configured SMS provider (Supabase Auth supports Twilio, MessageBird, Vonage, and
    similar providers).
  - E.164 phone number normalization before every OTP request and lookup.
  - A CAPTCHA/bot challenge in front of OTP requests.
  - Resend, per-IP, and per-phone-number rate limits on OTP requests.
  - Generic, anti-enumeration error responses (never reveal whether a phone number has an
    account).
  - Stronger recovery and MFA requirements for organizer and platform-operator roles
    (`org_members.role` per CLAUDE.md §5), since those accounts control payout
    configuration.
- **Development/test auth must be**:
  - Deterministic (fixed test OTP/codes, no timing or randomness dependent on an external
    SMS provider).
  - Free of any real SMS send — a test/dev adapter must never call a live SMS provider.
  - Fail-closed if selected in a production deployment (the deployment config in
    `packages/config`, per CLAUDE.md §4, must refuse to boot with a test auth adapter when
    `DEPLOYMENT_MODE` indicates production/hosted).
- **No silent account merging.** Two identities are linked only when there is an
  authenticated session for one of them _and_ a fresh verification of the other (e.g. an
  active Supabase session plus a live Privy wallet-linking step). Matching phone numbers or
  email addresses alone is never sufficient to merge two internal users or attach a new
  `auth_identities` row.

## Consequences

- `packages/auth` gains a real Supabase adapter (implemented in a follow-up PR, not this
  one) alongside the existing mock/test adapter; the provider-neutral `AuthProvider`
  contract in `packages/auth/src/index.ts` is extended to resolve to an internal user id
  and to support identity linking, without leaking provider-specific types into
  `apps/web` or `packages/core`.
- A new `auth_identities` table joins the schema in CLAUDE.md §5 (implemented via Drizzle
  migrations in a follow-up PR).
- Supabase Auth (GoTrue) is bundled with and self-hostable alongside Supabase Postgres for
  Tier 0/1, so self-hosters who already run Supabase for the database do not need a second
  auth _service_. Phone OTP itself is not free, though: it still requires a self-hoster or
  Mixt Hosted to configure and pay a separate SMS provider (e.g. Twilio) per outbound
  message — that per-message cost and account setup is not eliminated by this decision.
- Embedded wallets (Tier 2) become a strictly additive slice: linking a wallet never
  requires re-architecting how existing users, orders, or tickets are identified, because
  every domain table already points at the internal `users.id`.
- Organizer/operator accounts need a documented stronger-auth path (MFA/recovery) before
  any pilot handles real payouts; that is tracked as follow-up work, not solved by this ADR.

## Rejected alternatives

- **Better Auth (self-hosted, Postgres-backed).** Meets the self-hosting and licensing bar
  and is a reasonable Tier 0 fit on its own, but it is a second stateful service with its
  own schema and session model sitting next to the Supabase Postgres instance CLAUDE.md
  §4.5 already commits to. It does not reduce the number of moving pieces for either Tier 0
  or Tier 1, and phone OTP support depends on a plugin rather than a first-party integration.
- **Privy as the primary MVP login system.** Rejected because CLAUDE.md §4 and §2 are
  explicit that Tier 0/1 ("free/self-hosted/Mixt Hosted") ship without requiring a crypto
  wallet, and Privy has no self-host mode — it would make every self-hosted deployment
  depend on an external vendor account for basic login, which contradicts the "escape
  valve" design in CLAUDE.md §4.5.
- **Custom-rolled Postgres OTP (no Supabase Auth, no Better Auth).** Rejected for the MVP:
  it would require building and maintaining SMS delivery, rate limiting, and anti-
  enumeration protections from scratch before any pilot, duplicating what Supabase Auth
  already provides as a maintained, audited feature.
- **Email-only login for MVP.** Considered as a simpler first step, but phone OTP is the
  anti-scalping/anti-bot posture CLAUDE.md §6 assumes (phone verification for high-demand
  events), so building on a provider that supports both from day one avoids a later
  migration.

## Migration/portability notes

- Because `packages/auth` exposes a provider-neutral contract and every domain table
  references the internal `users.id`, moving off Supabase Auth later (e.g. to Better Auth,
  or to a fully custom adapter) only requires a new adapter behind the same contract plus a
  backfill of `auth_identities` — no changes to `packages/core`, `apps/web` route handlers,
  or the ticket/order schema.
- This mirrors the database/storage portability story already committed to in CLAUDE.md
  §4.5: the interface is the contract, not the vendor.
- Enabling Privy later is additive per the flow above; disabling it later (or swapping it
  for a different wallet provider) only touches `auth_identities` rows with
  `provider='privy_wallet'` and the optional wallet-linking UI — it does not touch how
  existing users, orders, or tickets are identified.

## Sources

- Supabase — Phone Login: <https://supabase.com/docs/guides/auth/phone-login>
- Supabase — Identity Linking: <https://supabase.com/docs/guides/auth/auth-identity-linking>
- Supabase — Creating a Server-Side Client (SSR): <https://supabase.com/docs/guides/auth/server-side/creating-a-client>
- Supabase — Passkeys: <https://supabase.com/docs/guides/auth/passkeys>
- Privy — JWT-based Authentication: <https://docs.privy.io/authentication/user-authentication/jwt-based-auth/overview>
- Privy — SMS / WhatsApp Login Methods: <https://docs.privy.io/authentication/user-authentication/login-methods/sms-whatsapp>
