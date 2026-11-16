export type SocialAssistancePortalAliasSource = {
    workspaceId: string;
    workspaceName: string;
};

export const createSocialAssistancePortalAlias = (workspaceName: string): string => {
    const alias = workspaceName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/gi, "d")
        .toLowerCase()
        .replace(/^(?:(?:ubnd|mttq|mat tran to quoc viet nam|uy ban nhan dan|thanh pho|tp|tinh)\s+)+/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
        .replace(/-+$/g, "");

    return alias || "an-sinh";
};

export const buildSocialAssistancePortalAliases = (
    sources: SocialAssistancePortalAliasSource[]
): Map<string, string> => {
    const baseAliases = sources.map((source) => ({
        workspaceId: source.workspaceId,
        baseAlias: createSocialAssistancePortalAlias(source.workspaceName)
    }));
    const counts = new Map<string, number>();
    for (const { baseAlias } of baseAliases) counts.set(baseAlias, (counts.get(baseAlias) ?? 0) + 1);

    return new Map(baseAliases.map(({ workspaceId, baseAlias }) => [
        workspaceId,
        (counts.get(baseAlias) ?? 0) > 1
            ? `${baseAlias.slice(0, 70)}-${workspaceId.replaceAll("-", "").slice(0, 8)}`
            : baseAlias
    ]));
};
