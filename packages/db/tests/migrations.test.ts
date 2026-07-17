import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateDatabase } from "../src/migrate";
import {
  startPostgresTestContainer,
  type PostgresTestContainer,
} from "./postgres-container";
import { migrationsFolder } from "./test-paths";

let container: PostgresTestContainer;
let sql: Sql;

beforeAll(async () => {
  container = await startPostgresTestContainer();
  await migrateDatabase({
    databaseUrl: container.databaseUrl,
    migrationsFolder,
  });
  sql = postgres(container.databaseUrl, { max: 1 });
}, 120_000);

afterAll(async () => {
  await sql?.end();
  await container?.stop();
});

describe("database migrations", () => {
  it("creates the initial identity and organization tables on a clean database", async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'users',
          'auth_identities',
          'organizations',
          'org_members'
        )
      order by table_name
    `;

    expect(rows.map((row) => row.table_name)).toEqual([
      "auth_identities",
      "org_members",
      "organizations",
      "users",
    ]);
  });

  it("is idempotent when migrations run twice", async () => {
    const before = await sql<{ count: number }[]>`
      select count(*)::integer as count
      from drizzle.__drizzle_migrations
    `;

    await migrateDatabase({
      databaseUrl: container.databaseUrl,
      migrationsFolder,
    });

    const after = await sql<{ count: number }[]>`
      select count(*)::integer as count
      from drizzle.__drizzle_migrations
    `;

    expect(before[0]?.count).toBe(3);
    expect(after[0]?.count).toBe(before[0]?.count);
  });

  it("migrates a second fresh database in the same cluster", async () => {
    const secondDatabaseName = "ship_tickets_second_test";
    const secondDatabaseUrl = new URL(container.databaseUrl);
    secondDatabaseUrl.pathname = `/${secondDatabaseName}`;

    await sql`create database ${sql(secondDatabaseName)}`;

    try {
      await migrateDatabase({
        databaseUrl: secondDatabaseUrl.toString(),
        migrationsFolder,
      });
      const secondDatabase = postgres(secondDatabaseUrl.toString(), { max: 1 });

      try {
        const rows = await secondDatabase<{ table_name: string }[]>`
          select table_name
          from information_schema.tables
          where table_schema = 'public'
            and table_name = 'organizations'
        `;

        expect(rows).toEqual([{ table_name: "organizations" }]);
      } finally {
        await secondDatabase.end();
      }
    } finally {
      await sql`drop database ${sql(secondDatabaseName)} with (force)`;
    }
  });

  it("installs the expected constraints, indexes, and RLS policies", async () => {
    const constraints = await sql<{ conname: string }[]>`
      select conname
      from pg_constraint
      where conname in (
        'org_members_org_id_user_id_pk',
        'auth_identities_user_id_users_id_fk',
        'org_members_org_id_organizations_id_fk',
        'org_members_user_id_users_id_fk'
      )
      order by conname
    `;
    const indexes = await sql<{ indexname: string }[]>`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and indexname in (
          'auth_identities_provider_subject_unique',
          'auth_identities_user_id_index',
          'org_members_org_id_user_id_pk',
          'org_members_user_id_index',
          'organizations_slug_unique'
        )
      order by indexname
    `;
    const rlsTables = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select relname, relrowsecurity
      from pg_class
      where relname in ('organizations', 'org_members')
      order by relname
    `;
    const policies = await sql<{ policyname: string }[]>`
      select policyname
      from pg_policies
      where policyname in (
        'organizations_tenant_isolation',
        'org_members_tenant_isolation'
      )
      order by policyname
    `;

    expect(constraints.map((row) => row.conname)).toEqual([
      "auth_identities_user_id_users_id_fk",
      "org_members_org_id_organizations_id_fk",
      "org_members_org_id_user_id_pk",
      "org_members_user_id_users_id_fk",
    ]);
    expect(indexes.map((row) => row.indexname)).toEqual([
      "auth_identities_provider_subject_unique",
      "auth_identities_user_id_index",
      "org_members_org_id_user_id_pk",
      "org_members_user_id_index",
      "organizations_slug_unique",
    ]);
    expect(rlsTables).toEqual([
      { relname: "org_members", relrowsecurity: true },
      { relname: "organizations", relrowsecurity: true },
    ]);
    expect(policies.map((row) => row.policyname)).toEqual([
      "org_members_tenant_isolation",
      "organizations_tenant_isolation",
    ]);
  });

  it("uses indexes for representative identity and membership lookups", async () => {
    await sql`
      insert into users (id, display_name)
      select
        md5('query-plan-user-' || value)::uuid,
        'Query plan user ' || value
      from generate_series(1, 1000) as value
    `;
    await sql`
      insert into auth_identities (user_id, provider, subject)
      select
        md5('query-plan-user-' || value)::uuid,
        'supabase',
        'query-plan-subject-' || value
      from generate_series(1, 1000) as value
    `;
    await sql`
      insert into organizations (id, name, slug)
      select
        md5('query-plan-org-' || value)::uuid,
        'Query plan org ' || value,
        'query-plan-org-' || value
      from generate_series(1, 100) as value
    `;
    await sql`
      insert into org_members (org_id, user_id, role)
      select
        md5(
          'query-plan-org-' || (((value - 1) / 10) + 1)
        )::uuid,
        md5('query-plan-user-' || value)::uuid,
        'staff'
      from generate_series(1, 1000) as value
    `;
    await sql`analyze auth_identities`;
    await sql`analyze org_members`;

    const identityPlan = await sql<{ "QUERY PLAN": unknown }[]>`
      explain (format json)
      select user_id
      from auth_identities
      where provider = ${"supabase"}
        and subject = ${"query-plan-subject-500"}
    `;
    const membershipPlan = await sql<{ "QUERY PLAN": unknown }[]>`
      explain (format json)
      select role
      from org_members
      where org_id = md5('query-plan-org-50')::uuid
    `;

    expect(JSON.stringify(identityPlan[0]?.["QUERY PLAN"])).toContain(
      "auth_identities_provider_subject_unique",
    );
    expect(JSON.stringify(membershipPlan[0]?.["QUERY PLAN"])).toContain(
      "org_members_org_id_user_id_pk",
    );
  });
});
