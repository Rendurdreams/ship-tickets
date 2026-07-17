export interface DatabaseConfig {
  readonly databaseUrl: string;
}

export function loadDatabaseConfig(
  env: Record<string, string | undefined>,
): DatabaseConfig {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  let url: URL;

  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol");
  }

  return { databaseUrl };
}
