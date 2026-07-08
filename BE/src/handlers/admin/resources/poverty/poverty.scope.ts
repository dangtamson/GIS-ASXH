import { expandOrganizationDescendants } from "@/handlers/report/common.ts";
import { organizations, workspaceMemberships } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, eq, inArray } from "drizzle-orm";

type OrganizationLocationScopeRow = {
  provinceCode?: string | null;
  wardCode?: string | null;
  areaId?: string | null;
};

export type PovertyAccessScope = {
  organizationIds: string[];
  provinceCodes: string[];
  wardCodes: string[];
  areaIds: string[];
  isBranchAdmin: boolean;
  isSuperAdmin: boolean;
  hasScope: boolean;
};

export const buildSuperAdminPovertyAccessScope = (): PovertyAccessScope => ({
  organizationIds: [],
  provinceCodes: [],
  wardCodes: [],
  areaIds: [],
  isBranchAdmin: false,
  isSuperAdmin: true,
  hasScope: true
});

export const collapseOrganizationLocationScopes = (
  organizations: OrganizationLocationScopeRow[]
): Omit<PovertyAccessScope, "organizationIds" | "isBranchAdmin" | "isSuperAdmin" | "hasScope"> => {
  const provinceCodes = new Set<string>();
  const wardCodes = new Set<string>();
  const areaIds = new Set<string>();

  organizations.forEach((item) => {
    if (item.areaId) {
      areaIds.add(item.areaId);
      return;
    }

    if (item.wardCode) {
      wardCodes.add(item.wardCode);
      return;
    }

    if (item.provinceCode) {
      provinceCodes.add(item.provinceCode);
    }
  });

  return {
    provinceCodes: [...provinceCodes],
    wardCodes: [...wardCodes],
    areaIds: [...areaIds]
  };
};

export const resolvePovertyAccessScope = async (
  accountId: string | null | undefined,
  workspaceId: string | null | undefined
): Promise<PovertyAccessScope> => {
  if (!accountId || !workspaceId) {
    return {
      organizationIds: [],
      provinceCodes: [],
      wardCodes: [],
      areaIds: [],
      isBranchAdmin: false,
      isSuperAdmin: false,
      hasScope: false
    };
  }

  const [membership] = await db
    .select({
      organizationId: workspaceMemberships.organizationId,
      isAdmin: workspaceMemberships.isAdmin
    })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.accountId, accountId),
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.status, true)
      )
    )
    .limit(1);

  const organizationId = String(membership?.organizationId ?? "").trim();
  const isBranchAdmin = Boolean(membership?.isAdmin);

  if (!organizationId) {
    return {
      organizationIds: [],
      provinceCodes: [],
      wardCodes: [],
      areaIds: [],
      isBranchAdmin,
      isSuperAdmin: false,
      hasScope: false
    };
  }

  const organizationIds = isBranchAdmin
    ? await expandOrganizationDescendants(workspaceId, [organizationId])
    : [organizationId];

  const organizationRows =
    organizationIds.length > 0
      ? await db
        .select({
          uuid: organizations.uuid,
          provinceCode: organizations.provinceCode,
          wardCode: organizations.wardCode,
          areaId: organizations.areaId
        })
        .from(organizations)
        .where(and(eq(organizations.workspaceId, workspaceId), inArray(organizations.uuid, organizationIds)))
      : [];

  const collapsed = collapseOrganizationLocationScopes(organizationRows);
  const hasScope =
    collapsed.areaIds.length > 0 || collapsed.wardCodes.length > 0 || collapsed.provinceCodes.length > 0;

  return {
    organizationIds,
    ...collapsed,
    isBranchAdmin,
    isSuperAdmin: false,
    hasScope
  };
};

export const isLocationWithinScope = (
  scope: PovertyAccessScope,
  location: {
    provinceCode?: string | null;
    wardCode?: string | null;
    areaId?: string | null;
  }
): boolean => {
  if (scope.isSuperAdmin) {
    return true;
  }

  if (!scope.hasScope) {
    return false;
  }

  if (scope.areaIds.length > 0 && location.areaId && scope.areaIds.includes(location.areaId)) {
    return true;
  }

  if (scope.wardCodes.length > 0 && location.wardCode && scope.wardCodes.includes(location.wardCode)) {
    return true;
  }

  if (scope.provinceCodes.length > 0 && location.provinceCode && scope.provinceCodes.includes(location.provinceCode)) {
    return true;
  }

  return false;
};
