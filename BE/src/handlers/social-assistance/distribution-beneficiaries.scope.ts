import {
    isLocationWithinScope,
    type PovertyAccessScope
} from "@/handlers/admin/resources/poverty/poverty.scope.ts";

type BeneficiaryScopeTarget = {
    workspaceId: string;
    organizationId?: string | null;
    provinceCode?: string | null;
    wardCode?: string | null;
    areaId?: string | null;
};

export const canAccessDistributionBeneficiary = (
    workspaceId: string,
    scope: PovertyAccessScope,
    beneficiary: BeneficiaryScopeTarget
): boolean => {
    if (!workspaceId || beneficiary.workspaceId !== workspaceId) return false;

    const hasProvince = Boolean(beneficiary.provinceCode);
    const hasWard = Boolean(beneficiary.wardCode);
    const hasOrganization = Boolean(beneficiary.organizationId);
    if (hasProvince !== hasWard || (!hasWard && !hasOrganization)) return false;

    if (scope.isSuperAdmin) return true;
    if (hasOrganization && !scope.organizationIds.includes(beneficiary.organizationId!)) return false;
    if (hasWard && !isLocationWithinScope(scope, beneficiary)) return false;
    return true;
};