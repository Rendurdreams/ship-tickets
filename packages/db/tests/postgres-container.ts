import { execFile } from "node:child_process";
import { promisify } from "node:util";

import postgres from "postgres";

const execFileAsync = promisify(execFile);

export interface PostgresTestContainer {
  readonly databaseUrl: string;
  stop(): Promise<void>;
}

async function waitForPostgres(databaseUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const sql = postgres(databaseUrl, {
      connect_timeout: 1,
      max: 1,
    });

    try {
      await sql`select 1`;
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    } finally {
      await sql.end().catch(() => undefined);
    }
  }

  throw new Error("PostgreSQL test container did not become ready");
}

export async function startPostgresTestContainer(): Promise<PostgresTestContainer> {
  const containerName = `ship-tickets-db-test-${process.pid}-${Date.now()}`;
  const password = "ship_tickets_test_password";

  await execFileAsync(
    "docker",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      containerName,
      "--env",
      `POSTGRES_PASSWORD=${password}`,
      "--env",
      "POSTGRES_DB=ship_tickets_test",
      "--publish",
      "127.0.0.1::5432",
      "postgres:16-alpine",
    ],
    { timeout: 120_000 },
  );

  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["port", containerName, "5432/tcp"],
      { timeout: 5_000 },
    );
    const port = stdout.trim().split(":").at(-1);

    if (!port) {
      throw new Error("Could not determine PostgreSQL test container port");
    }

    const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/ship_tickets_test`;
    await waitForPostgres(databaseUrl);

    return {
      databaseUrl,
      async stop() {
        await execFileAsync("docker", ["rm", "--force", containerName], {
          timeout: 10_000,
        }).catch(() => undefined);
      },
    };
  } catch (error) {
    await execFileAsync("docker", ["rm", "--force", containerName], {
      timeout: 10_000,
    }).catch(() => undefined);
    throw error;
  }
}
