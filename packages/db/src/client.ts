import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { DatabaseConfig } from "./config";
import * as schema from "./schema";

export function createDatabaseClient(config: DatabaseConfig) {
  const client = postgres(config.databaseUrl);
  const db = drizzle(client, { schema });

  return {
    db,
    async close(): Promise<void> {
      await client.end();
    },
  };
}

export type ShipTicketsDatabase = ReturnType<typeof createDatabaseClient>["db"];
