import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export interface MigrateDatabaseOptions {
  readonly databaseUrl: string;
  readonly migrationsFolder: string;
}

export async function migrateDatabase({
  databaseUrl,
  migrationsFolder,
}: MigrateDatabaseOptions): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end();
  }
}
