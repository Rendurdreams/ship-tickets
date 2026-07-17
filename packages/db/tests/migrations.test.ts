import { fileURLToPath } from "node:url";

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateDatabase } from "../src/migrate";
import {
  startPostgresTestContainer,
  type PostgresTestContainer,
} from "./postgres-container";

const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

let container: PostgresTestContainer;

beforeAll(async () => {
  container = await startPostgresTestContainer();
}, 120_000);

afterAll(async () => {
  await container?.stop();
});

describe("database migrations", () => {
  it("creates the initial identity and organization tables on a clean database", async () => {
    await migrateDatabase({
      databaseUrl: container.databaseUrl,
      migrationsFolder,
    });

    const sql = postgres(container.databaseUrl, { max: 1 });

    try {
      const rows = await sql<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in (
            'users',
            'auth_identities',
            'organizations',
            'organization_members'
          )
        order by table_name
      `;

      expect(rows.map((row) => row.table_name)).toEqual([
        "auth_identities",
        "organization_members",
        "organizations",
        "users",
      ]);
    } finally {
      await sql.end();
    }
  });
});
