import { sql } from "drizzle-orm";

import type { ShipTicketsDatabase } from "./client";

export type TenantTransaction = Parameters<
  Parameters<ShipTicketsDatabase["transaction"]>[0]
>[0];

export async function withTenant<TResult>(
  database: ShipTicketsDatabase,
  orgId: string,
  operation: (transaction: TenantTransaction) => Promise<TResult>,
): Promise<TResult> {
  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select set_config('app.current_org_id', ${orgId}, true)`,
    );

    return operation(transaction);
  });
}
