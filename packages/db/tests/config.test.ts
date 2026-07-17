import { describe, expect, it } from "vitest";

import { loadDatabaseConfig } from "../src/config";

describe("loadDatabaseConfig", () => {
  it("requires DATABASE_URL", () => {
    expect(() => loadDatabaseConfig({})).toThrow(/DATABASE_URL/i);
  });

  it("rejects non-PostgreSQL URLs", () => {
    expect(() =>
      loadDatabaseConfig({ DATABASE_URL: "mysql://localhost/ship_tickets" }),
    ).toThrow(/PostgreSQL/i);
  });
});
