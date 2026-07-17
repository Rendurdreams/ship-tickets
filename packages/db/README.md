# `@ship-tickets/db`

Provider-neutral PostgreSQL access for Ship Tickets. Application code imports this package instead of a hosted-provider SDK.

## Connections

- `DATABASE_URL` must use a non-owner, non-superuser, non-`BYPASSRLS` runtime login. Serverless deployments should use its transaction-pooler URL.
- `DATABASE_MIGRATION_URL` is the table-owner/admin direct or session-mode URL. Production must keep it separate from `DATABASE_URL`; migration fallback to `DATABASE_URL` exists only for simple local development.
- `DATABASE_MAX_CONNECTIONS` defaults to `1` per application instance and is limited to `1..20`.
- `DATABASE_PREPARE_STATEMENTS` defaults to `false` because transaction-mode poolers such as Supavisor do not support prepared statements reliably.

`createDatabaseClient` checks the live PostgreSQL role before returning a Drizzle handle. It refuses a superuser, `BYPASSRLS` role, tenant-table owner, role that can create in `public`, or role missing required table privileges.

## Runtime role provisioning

Database migrations contain only database-local schema, indexes, and RLS policies. They never create cluster-global roles.

1. Create a dedicated login and password through the database provider or an administrator. Do not reuse the migration owner.
2. Set `DATABASE_MIGRATION_URL` to the admin connection and `DATABASE_RUNTIME_ROLE` to that existing login name.
3. Run `pnpm --filter @ship-tickets/db db:provision-runtime-role` once per database.
4. Set `DATABASE_URL` to the provisioned login's runtime/pooler connection.

The idempotent provisioning command creates or hardens the shared `NOLOGIN` `ship_tickets_app` group, revokes inherited `CREATE` on `public`, grants the minimum identity and tenant-table privileges, and attaches the existing runtime login. It never creates login credentials.

## Tenant isolation

Every tenant operation runs through `withTenant(db, orgId, callback)`. It opens a transaction and sets `app.current_org_id` through parameterized `set_config(..., true)`; the setting disappears after commit or rollback. The runtime login cannot bypass RLS even if a future caller forgets this wrapper: a missing context returns no tenant rows.

Repository methods still require an explicit `orgId` and include it in their predicates. Callers must authorize the authenticated user's organization membership before selecting the trusted `orgId`; RLS is defense in depth, not a substitute for application authorization.

The global identity repository intentionally runs outside tenant context and receives only `SELECT`/`INSERT` access to `users` and `auth_identities`.

## Query safety

Use Drizzle predicates or PostgreSQL.js tagged templates for every value. Never pass request data to raw/unsafe SQL APIs or build SQL with string concatenation. The identity store treats `(provider, subject)` as opaque exact values and resolves them through the unique composite index.
