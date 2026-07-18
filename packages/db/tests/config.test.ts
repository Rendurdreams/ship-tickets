import { describe, expect, it } from "vitest";

import {
  loadDatabaseConfig,
  loadDatabaseMigrationConfig,
  loadDatabaseProvisionConfig,
} from "../src/config";

describe("loadDatabaseConfig", () => {
  it("uses serverless-safe connection defaults", () => {
    expect(
      loadDatabaseConfig({
        DATABASE_URL: "postgresql://localhost/ship_tickets",
      }),
    ).toEqual({
      databaseUrl: "postgresql://localhost/ship_tickets",
      maxConnections: 1,
      prepareStatements: false,
    });
  });

  it("accepts explicit connection pool settings", () => {
    expect(
      loadDatabaseConfig({
        DATABASE_MAX_CONNECTIONS: "5",
        DATABASE_PREPARE_STATEMENTS: "true",
        DATABASE_URL: "postgresql://localhost/ship_tickets",
      }),
    ).toMatchObject({
      maxConnections: 5,
      prepareStatements: true,
    });
  });

  it.each(["0", "-1", "1.5", "21", "many"])(
    "rejects invalid connection count %s",
    (maxConnections) => {
      expect(() =>
        loadDatabaseConfig({
          DATABASE_MAX_CONNECTIONS: maxConnections,
          DATABASE_URL: "postgresql://localhost/ship_tickets",
        }),
      ).toThrow(/DATABASE_MAX_CONNECTIONS/i);
    },
  );

  it("rejects an invalid prepared-statements flag", () => {
    expect(() =>
      loadDatabaseConfig({
        DATABASE_PREPARE_STATEMENTS: "sometimes",
        DATABASE_URL: "postgresql://localhost/ship_tickets",
      }),
    ).toThrow(/DATABASE_PREPARE_STATEMENTS/i);
  });

  it("requires DATABASE_URL", () => {
    expect(() => loadDatabaseConfig({})).toThrow(/DATABASE_URL/i);
  });

  it("rejects non-PostgreSQL URLs", () => {
    expect(() =>
      loadDatabaseConfig({ DATABASE_URL: "mysql://localhost/ship_tickets" }),
    ).toThrow(/PostgreSQL/i);
  });
});

describe("loadDatabaseMigrationConfig", () => {
  it("prefers a direct migration URL", () => {
    expect(
      loadDatabaseMigrationConfig({
        DATABASE_MIGRATION_URL: "postgresql://direct/ship_tickets",
        DATABASE_URL: "postgresql://pooler/ship_tickets",
      }),
    ).toEqual({
      databaseUrl: "postgresql://direct/ship_tickets",
    });
  });

  it("falls back to the runtime URL", () => {
    expect(
      loadDatabaseMigrationConfig({
        DATABASE_URL: "postgresql://localhost/ship_tickets",
      }),
    ).toEqual({
      databaseUrl: "postgresql://localhost/ship_tickets",
    });
  });
});

describe("loadDatabaseProvisionConfig", () => {
  it("requires a direct admin URL and an existing runtime login name", () => {
    expect(
      loadDatabaseProvisionConfig({
        DATABASE_MIGRATION_URL: "postgresql://admin/ship_tickets",
        DATABASE_RUNTIME_ROLE: "ship_tickets_runtime",
      }),
    ).toEqual({
      databaseUrl: "postgresql://admin/ship_tickets",
      runtimeRole: "ship_tickets_runtime",
    });
  });

  it.each([
    "",
    "Postgres",
    "1runtime",
    "runtime-role",
    "runtime; drop role postgres",
  ])("rejects unsafe runtime role name %j", (runtimeRole) => {
    expect(() =>
      loadDatabaseProvisionConfig({
        DATABASE_MIGRATION_URL: "postgresql://admin/ship_tickets",
        DATABASE_RUNTIME_ROLE: runtimeRole,
      }),
    ).toThrow(/DATABASE_RUNTIME_ROLE/);
  });

  it("does not fall back to the runtime connection for provisioning", () => {
    expect(() =>
      loadDatabaseProvisionConfig({
        DATABASE_RUNTIME_ROLE: "ship_tickets_runtime",
        DATABASE_URL: "postgresql://runtime/ship_tickets",
      }),
    ).toThrow(/DATABASE_MIGRATION_URL/);
  });
});
