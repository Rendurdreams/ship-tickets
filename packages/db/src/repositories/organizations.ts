import { and, eq } from "drizzle-orm";

import { organizations, type Organization } from "../schema";
import type { TenantTransaction } from "../tenant";

export interface OrganizationRepository {
  findBySlug(orgId: string, slug: string): Promise<Organization | null>;
  rename(orgId: string, name: string): Promise<Organization | null>;
}

export function createOrganizationRepository(
  transaction: TenantTransaction,
): OrganizationRepository {
  return {
    async findBySlug(orgId, slug) {
      const rows = await transaction
        .select()
        .from(organizations)
        .where(and(eq(organizations.id, orgId), eq(organizations.slug, slug)))
        .limit(1);

      return rows[0] ?? null;
    },
    async rename(orgId, name) {
      const rows = await transaction
        .update(organizations)
        .set({ name, updatedAt: new Date() })
        .where(eq(organizations.id, orgId))
        .returning();

      return rows[0] ?? null;
    },
  };
}
