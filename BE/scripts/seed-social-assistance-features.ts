import { and, eq, inArray } from "drizzle-orm";
import {
    features,
    permissions,
    roleFeatures,
    rolePermissions,
    roles,
    workspaceFeatures,
    workspaces
} from "../src/schema.ts";
import { closeDbPool, db } from "../src/services/db/drizzle.ts";

const SOCIAL_ASSISTANCE_FEATURES = [
    {
        name: "An sinh - Tiếp nhận",
        code: "social_assistance_intake",
        description: "Tiếp nhận và rà soát yêu cầu hỗ trợ an sinh xã hội",
        path: "/an-sinh/tiep-nhan",
        groupName: "social_assistance",
        orderIndex: 1,
        icon: "GridIcon",
        requiredPermissionCode: "social_assistance.request.view"
    },
    {
        name: "An sinh - Cổng công khai",
        code: "social_assistance_portal",
        description: "Cấu hình tiếp nhận và công khai chương trình an sinh xã hội",
        path: "/an-sinh/cong-khai",
        groupName: "social_assistance",
        orderIndex: 2,
        icon: "PlugInIcon",
        requiredPermissionCode: "social_assistance.portal.manage"
    },
    {
        name: "An sinh - Chương trình",
        code: "social_assistance_programs",
        description: "Quản lý chương trình an sinh xã hội",
        path: "/an-sinh/chuong-trinh",
        groupName: "social_assistance",
        orderIndex: 3,
        icon: "PageIcon",
        requiredPermissionCode: "social_assistance.program.view"
    },
    {
        name: "An sinh - Cam kết ủng hộ",
        code: "social_assistance_pledges",
        description: "Rà soát và đối soát cam kết ủng hộ",
        path: "/an-sinh/tai-tro",
        groupName: "social_assistance",
        orderIndex: 4,
        icon: "PieChartIcon",
        requiredPermissionCode: "social_assistance.pledge.view"
    },
    {
        name: "An sinh - Phân bổ hỗ trợ",
        code: "social_assistance_allocations",
        description: "Phân bổ và theo dõi việc thực hiện hỗ trợ",
        path: "/an-sinh/phan-bo",
        groupName: "social_assistance",
        orderIndex: 5,
        icon: "BoxCubeIcon",
        requiredPermissionCode: "social_assistance.allocation.view"
    },
    {
        name: "An sinh - Điều phối",
        code: "social_assistance_dashboard",
        description: "Tổng hợp tiếp nhận, cam kết, tiếp nhận và kết quả hỗ trợ",
        path: "/an-sinh/dieu-phoi",
        groupName: "social_assistance",
        orderIndex: 6,
        icon: "PieChartIcon",
        requiredPermissionCode: "social_assistance.report.read"
    },
    {
        name: "An sinh - Duyệt kết quả công khai",
        code: "social_assistance_publications",
        description: "Xem trước và duyệt số liệu an sinh công khai",
        path: "/an-sinh/duyet-ket-qua",
        groupName: "social_assistance",
        orderIndex: 7,
        icon: "PageIcon",
        requiredPermissionCode: "social_assistance.publication.manage"
    }
] as const;

const SOCIAL_ASSISTANCE_PERMISSIONS = [
    ["social_assistance.request.view", "View social assistance requests"],
    ["social_assistance.request.review", "Review social assistance requests"],
    ["social_assistance.program.view", "View social assistance programs"],
    ["social_assistance.program.manage", "Manage social assistance programs"],
    ["social_assistance.pledge.view", "View social assistance pledges"],
    ["social_assistance.pledge.reconcile", "Reconcile social assistance pledges"],
    ["social_assistance.allocation.view", "View social assistance allocations"],
    ["social_assistance.allocation.manage", "Manage social assistance allocations"],
    ["social_assistance.distribution_batch.view", "View locality allocation batches"],
    ["social_assistance.distribution_batch.manage", "Manage locality allocation batches"],
    ["social_assistance.distribution_batch.publish", "Publish locality allocation batches"],
    ["social_assistance.beneficiary.view", "View private social assistance beneficiaries"],
    ["social_assistance.beneficiary.manage", "Manage private social assistance beneficiaries"],
    ["social_assistance.report.read", "View social assistance reports"],
    ["social_assistance.publication.manage", "Manage public social assistance results"],
    ["social_assistance.portal.manage", "Manage social assistance public portal"]
] as const;

const ADMIN_ROLE_CODES = ["ADMIN", "SUPER_ADMIN", "admin"] as const;

async function seedSocialAssistanceFeatures(): Promise<void> {
    const workspaceRows = await db.select({ uuid: workspaces.uuid }).from(workspaces);
    if (workspaceRows.length === 0) {
        throw new Error("No workspaces found; cannot seed social assistance features");
    }

    const permissionValues = SOCIAL_ASSISTANCE_PERMISSIONS.map(([code, name]) => ({
        code,
        name,
        description: name
    }));

    await db.transaction(async (tx) => {
        await tx.insert(permissions).values(permissionValues).onConflictDoNothing({ target: permissions.code });

        const storedPermissions = await tx
            .select({ id: permissions.id, code: permissions.code })
            .from(permissions)
            .where(inArray(permissions.code, SOCIAL_ASSISTANCE_PERMISSIONS.map(([code]) => code)));

        for (const workspace of workspaceRows) {
            await tx
                .insert(features)
                .values(SOCIAL_ASSISTANCE_FEATURES.map((feature) => ({
                    workspaceId: workspace.uuid,
                    ...feature,
                    enabled: true,
                    requiresSuperAdmin: false,
                    requiresWorkspaceAdmin: false
                })))
                .onConflictDoNothing({ target: [features.workspaceId, features.code] });

            const storedFeatures = await tx
                .select({ uuid: features.uuid, code: features.code })
                .from(features)
                .where(and(
                    eq(features.workspaceId, workspace.uuid),
                    inArray(features.code, SOCIAL_ASSISTANCE_FEATURES.map((feature) => feature.code))
                ));
            if (storedFeatures.length !== SOCIAL_ASSISTANCE_FEATURES.length) {
                throw new Error(`Could not resolve every social assistance feature for workspace ${workspace.uuid}`);
            }

            const existingWorkspaceLinks = await tx
                .select({ featureId: workspaceFeatures.featureId })
                .from(workspaceFeatures)
                .where(eq(workspaceFeatures.workspaceId, workspace.uuid));
            const linkedFeatureIds = new Set(existingWorkspaceLinks.map((link) => link.featureId));
            const newWorkspaceLinks = storedFeatures
                .filter((feature) => !linkedFeatureIds.has(feature.uuid))
                .map((feature) => ({ workspaceId: workspace.uuid, featureId: feature.uuid }));
            if (newWorkspaceLinks.length > 0) {
                await tx.insert(workspaceFeatures).values(newWorkspaceLinks);
            }

            const adminRoles = await tx
                .select({ id: roles.id })
                .from(roles)
                .where(and(eq(roles.workspaceId, workspace.uuid), inArray(roles.code, [...ADMIN_ROLE_CODES])));
            if (adminRoles.length === 0) continue;

            const roleFeatureRows = adminRoles.flatMap((role) => storedFeatures.map((feature) => ({
                roleId: role.id,
                featureId: feature.uuid
            })));
            await tx.insert(roleFeatures).values(roleFeatureRows).onConflictDoNothing();

            const rolePermissionRows = adminRoles.flatMap((role) => storedPermissions.flatMap((permission) =>
                permission.id == null ? [] : [{ roleId: role.id, permissionId: permission.id }]
            ));
            if (rolePermissionRows.length > 0) {
                await tx.insert(rolePermissions).values(rolePermissionRows).onConflictDoNothing();
            }
        }
    });

    console.info(`Seeded ${SOCIAL_ASSISTANCE_FEATURES.length} social assistance menu features for ${workspaceRows.length} workspaces`);
}

void seedSocialAssistanceFeatures()
    .catch((error: unknown) => {
        console.error("Failed to seed social assistance features", error);
        process.exitCode = 1;
    })
    .finally(async () => closeDbPool());
