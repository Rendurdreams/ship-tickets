export interface DatabaseConfig {
  readonly databaseUrl: string;
  readonly maxConnections: number;
  readonly prepareStatements: boolean;
}

export interface DatabaseMigrationConfig {
  readonly databaseUrl: string;
}

export interface DatabaseProvisionConfig extends DatabaseMigrationConfig {
  readonly runtimeRole: string;
}

function parsePostgresUrl(value: string, variableName: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL`);
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${variableName} must use the PostgreSQL protocol`);
  }

  return url;
}

export function loadDatabaseMigrationConfig(
  env: Record<string, string | undefined>,
): DatabaseMigrationConfig {
  const databaseUrl =
    env.DATABASE_MIGRATION_URL?.trim() || env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_MIGRATION_URL or DATABASE_URL is required");
  }

  parsePostgresUrl(
    databaseUrl,
    env.DATABASE_MIGRATION_URL?.trim()
      ? "DATABASE_MIGRATION_URL"
      : "DATABASE_URL",
  );

  return { databaseUrl };
}

export function loadDatabaseConfig(
  env: Record<string, string | undefined>,
): DatabaseConfig {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  parsePostgresUrl(databaseUrl, "DATABASE_URL");

  const maxConnections = Number(env.DATABASE_MAX_CONNECTIONS ?? "1");

  if (
    !Number.isInteger(maxConnections) ||
    maxConnections < 1 ||
    maxConnections > 20
  ) {
    throw new Error(
      "DATABASE_MAX_CONNECTIONS must be an integer between 1 and 20",
    );
  }

  const prepareStatementsValue = env.DATABASE_PREPARE_STATEMENTS ?? "false";

  if (prepareStatementsValue !== "true" && prepareStatementsValue !== "false") {
    throw new Error("DATABASE_PREPARE_STATEMENTS must be true or false");
  }

  const prepareStatements = prepareStatementsValue === "true";

  return {
    databaseUrl,
    maxConnections,
    prepareStatements,
  };
}

export function loadDatabaseProvisionConfig(
  env: Record<string, string | undefined>,
): DatabaseProvisionConfig {
  const databaseUrl = env.DATABASE_MIGRATION_URL?.trim();
  const runtimeRole = env.DATABASE_RUNTIME_ROLE?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_MIGRATION_URL is required for role provisioning");
  }

  parsePostgresUrl(databaseUrl, "DATABASE_MIGRATION_URL");

  if (!runtimeRole || !/^[a-z_][a-z0-9_]{0,62}$/.test(runtimeRole)) {
    throw new Error(
      "DATABASE_RUNTIME_ROLE must be a lowercase PostgreSQL identifier",
    );
  }

  return { databaseUrl, runtimeRole };
}
