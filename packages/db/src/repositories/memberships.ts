import { eq } from "drizzle-orm";

import { organizationMembers, type OrganizationMember } from "../schema";
import type { TenantTransaction } from "../tenant";

export interface MembershipRepository {
  listByOrganization(orgId: string): Promise<OrganizationMember[]>;
}

export function createMembershipRepository(
  transaction: TenantTransaction,
): MembershipRepository {
  return {
    listByOrganization(orgId) {
      return transaction
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, orgId));
    },
  };
}
