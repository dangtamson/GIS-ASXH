import { and, eq } from "drizzle-orm";
import { features, roleFeatures, roles, workspaces } from "../src/schema.ts";
import { db } from "../src/services/db/drizzle.ts";

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

async function seedSocialAssistanceFeature(): Promise<void> {
    const [adminRole] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.code, "admin"))
        .limit(1);

    if (!adminRole) {
        throw new Error("Default admin role is missing; seed RBAC defaults first");
    }

    const workspaceRows = await db.select({ uuid: workspaces.uuid }).from(workspaces);

    for (const workspace of workspaceRows) {
        for (const featureDefinition of SOCIAL_ASSISTANCE_FEATURES) {
            const [existing] = await db
                .select({ uuid: features.uuid })
                .from(features)
                .where(and(eq(features.workspaceId, workspace.uuid), eq(features.code, featureDefinition.code)))
                .limit(1);

            let featureId = existing?.uuid;
            if (!featureId) {
                const [created] = await db
                    .insert(features)
                    .values({ workspaceId: workspace.uuid, ...featureDefinition, enabled: true })
                    .onConflictDoNothing({ target: [features.workspaceId, features.code] })
                    .returning({ uuid: features.uuid });
                featureId = created?.uuid;
            }

            if (!featureId) {
                const [upserted] = await db
                    .select({ uuid: features.uuid })
                    .from(features)
                    .where(and(eq(features.workspaceId, workspace.uuid), eq(features.code, featureDefinition.code)))
                    .limit(1);
                featureId = upserted?.uuid;
            }

            if (!featureId) continue;

            await db
                .insert(roleFeatures)
                .values({ roleId: adminRole.id, featureId })
                .onConflictDoNothing({ target: [roleFeatures.roleId, roleFeatures.featureId] });
        }
    }
}

seedSocialAssistanceFeature()
    .then(() => {
        console.info("Social assistance feature seeded for existing workspaces");
    })
    .catch((error: unknown) => {
        console.error("Failed to seed social assistance feature", error);
        process.exitCode = 1;
    });
