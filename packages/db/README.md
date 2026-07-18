# `@ship-tickets/db`

Provider-neutral PostgreSQL access for Ship Tickets. Application code imports this package instead of a hosted-provider SDK.

## Connections

- `DATABASE_URL` must use a non-owner, non-superuser, non-`BYPASSRLS` runtime login. Serverless deployments should use its transaction-pooler URL.
- `DATABASE_MIGRATION_URL` is the table-owner/admin direct or session-mode URL. Production must keep it separate from `DATABASE_URL`; migration fallback to `DATABASE_URL` exists only for simple local development.
- `DATABASE_MAX_CONNECTIONS` defaults to `1` per application instance and is limited to `1..20`.
- `DATABASE_PREPARE_STATEMENTS` defaults to `false` because transaction-mode poolers such as Supavisor do not support prepared statements reliably.

`createDatabaseClient` attests the authenticated PostgreSQL `session_user` before returning a Drizzle handle. The dedicated runtime login must equal `current_user`, have no role memberships, own no application tables, and have none of `SUPERUSER`, `BYPASSRLS`, `CREATEDB`, `CREATEROLE`, replication, `CREATE` on `public`, or forbidden effective table privileges such as `TRUNCATE`. It must hold every required table grant.

## Runtime role provisioning

Database migrations contain only database-local schema, indexes, and RLS policies. They never create cluster-global roles.

1. Create a dedicated login and password through the database provider or an administrator. Do not reuse the migration owner.
2. Set `DATABASE_MIGRATION_URL` to the admin connection and `DATABASE_RUNTIME_ROLE` to that existing login name.
3. Run `pnpm --filter @ship-tickets/db db:provision-runtime-role` once per database.
4. Set `DATABASE_URL` to the provisioned login's runtime/pooler connection.

The idempotent provisioning command rejects logins with role memberships, revokes the login's existing privileges on the managed schema, type, and tables, then grants the exact minimum contract directly in that database. It creates neither credentials nor shared cluster-global grant roles, so provisioning one database cannot authorize another database's runtime login. Startup also rejects forbidden effective privileges inherited from sources such as `PUBLIC`.

## Tenant isolation

Every tenant operation runs through `withTenant(db, orgId, callback)`. It opens a transaction and sets `app.current_org_id` through parameterized `set_config(..., true)`; the setting disappears after commit or rollback. The runtime login cannot bypass RLS even if a future caller forgets this wrapper: a missing context returns no tenant rows.

Repository methods still require an explicit `orgId` and include it in their predicates. Callers must authorize the authenticated user's organization membership before selecting the trusted `orgId`; RLS is defense in depth, not a substitute for application authorization.

The global identity repository intentionally runs outside tenant context and receives only `SELECT`/`INSERT` access to `users` and `auth_identities`.

## Query safety

Use Drizzle predicates or PostgreSQL.js tagged templates for every value. Never pass request data to raw/unsafe SQL APIs or build SQL with string concatenation. The identity store treats `(provider, subject)` as opaque exact values and resolves them through the unique composite index.
