import { db } from "../src/services/db/drizzle.ts";
import { features } from "../src/schema.ts";
import { sql } from "drizzle-orm";

/**
 * Seed script to populate all application menu items into the features table
 * This harvests all hardcoded menus and converts them into dynamic features
 */
async function seedFeatures() {
    try {
        console.log("🌱 Starting feature seeding...");

        // Get first workspace (or create if needed)
        const workspaceResult = await db.execute(
            sql`SELECT uuid FROM workspaces LIMIT 1`
        );

        if (!workspaceResult.rows || workspaceResult.rows.length === 0) {
            console.error("❌ No workspace found. Please create a workspace first.");
            process.exit(1);
        }

        const workspaceId = (workspaceResult.rows[0] as Record<string, unknown>).uuid as string;
        console.log(`✅ Using workspace: ${workspaceId}`);

        // Define all menu items exactly as they are in AppSidebar
        const menuItems = [
            // ===== MAIN MENU =====
            {
                name: "Tổng quan",
                code: "dashboard",
                description: "Dashboard overview",
                path: "/",
                groupName: "main",
                orderIndex: 1,
                icon: "GridIcon",
            },
            {
                name: "Nhiệm vụ đã giao",
                code: "assigned_tasks",
                description: "Assigned tasks management",
                path: "/nhiem-vu-da-giao",
                groupName: "main",
                orderIndex: 2,
                icon: "UserCircleIcon",
                requiredPermissionCode: "task.view",
            },
            {
                name: "Nhiệm vụ được giao",
                code: "received_tasks",
                description: "Received tasks management",
                path: "/nhiem-vu-duoc-giao",
                groupName: "main",
                orderIndex: 3,
                icon: "CalenderIcon",
                requiredPermissionCode: "task.view",
            },
            {
                name: "Đánh giá",
                code: "evaluations",
                description: "Evaluations management",
                path: "/danh-gia",
                groupName: "main",
                orderIndex: 4,
                icon: "ListIcon",
                requiredPermissionCode: "task.view",
            },
            {
                name: "Báo cáo",
                code: "reports",
                description: "Reports and statistics",
                path: "/bao-cao",
                groupName: "main",
                orderIndex: 5,
                icon: "PieChartIcon",
                requiredPermissionCode: "task.view",
            },

            // ===== ADMIN MENU =====
            {
                name: "Người dùng",
                code: "user_management",
                description: "User management",
                path: "/quan-tri/nguoi-dung",
                groupName: "admin",
                orderIndex: 2,
                icon: "UserCircleIcon",
                requiredPermissionCode: "admin.account.view",
            },
            {
                name: "Quản lý nhóm quyền",
                code: "permission_groups",
                description: "Permission group management",
                path: "/quan-tri/quan-ly-nhom-quyen",
                groupName: "admin",
                orderIndex: 4,
                icon: "BoxCubeIcon",
                requiredPermissionCode: "admin.rbac.view",
            },
            {
                name: "Danh mục",
                code: "categories",
                description: "Category management",
                path: "/quan-tri/danh-muc",
                groupName: "admin",
                orderIndex: 1,
                icon: "PageIcon",
                requiredPermissionCode: "category.view",
                requiresSuperAdmin: true,
            },
            {
                name: "Quản lý quyền",
                code: "permissions",
                description: "Permission management",
                path: "/quan-tri/quan-ly-quyen",
                groupName: "admin",
                orderIndex: 3,
                icon: "BoxCubeIcon",
                requiredPermissionCode: "admin.rbac.view",
                requiresSuperAdmin: true,
            },
            {
                name: "Quản lý phân quyền",
                code: "workspace_membership",
                description: "Workspace membership management",
                path: "/quan-tri/quan-ly-workspace-membership",
                groupName: "admin",
                orderIndex: 5,
                icon: "BoxCubeIcon",
                requiredPermissionCode: "workspace.member.view",
                requiresSuperAdmin: true,
            },
            {
                name: "Quản lý workspace",
                code: "workspace_management",
                description: "Workspace management",
                path: "/quan-tri/quan-ly-workspace",
                groupName: "admin",
                orderIndex: 6,
                icon: "BoxCubeIcon",
                requiredPermissionCode: "workspace.view",
                requiresSuperAdmin: true,
            },

            // ===== SYSTEM MENU =====
            {
                name: "Cấu hình hệ thống",
                code: "system_config",
                description: "System configuration",
                path: "/quan-tri/cau-hinh-he-thong",
                groupName: "system",
                orderIndex: 1,
                icon: "PlugInIcon",
                requiredPermissionCode: "admin.rbac.view",
                requiresSuperAdmin: true,
            },
            {
                name: "Chính sách an ninh",
                code: "security_policy",
                description: "Security policy management",
                path: "/quan-tri/chinh-sach-an-ninh",
                groupName: "system",
                orderIndex: 2,
                icon: "PlugInIcon",
                requiredPermissionCode: "admin.rbac.view",
                requiresSuperAdmin: true,
            },
            {
                name: "Quản lý chức năng",
                code: "feature_management",
                description: "Feature management",
                path: "/quan-tri/quan-ly-chuc-nang",
                groupName: "system",
                orderIndex: 3,
                icon: "PlugInIcon",
                requiredPermissionCode: "admin.rbac.view",
                requiresSuperAdmin: true,
            },
            {
                name: "Log hệ thống",
                code: "system_logs",
                description: "System logs",
                path: "/quan-tri/log-he-thong",
                groupName: "system",
                orderIndex: 4,
                icon: "PlugInIcon",
                requiredPermissionCode: "audit.read",
                requiresSuperAdmin: true,
            },

            // ===== REPORT SUBITEMS (nested under Báo cáo) =====
            {
                name: "Nhiệm vụ đã giao - Báo cáo",
                code: "report_assigned_tasks",
                description: "Report on assigned tasks",
                path: "/bao-cao/nhiem-vu-da-giao",
                groupName: "reports",
                orderIndex: 1,
                requiredPermissionCode: "task.view",
            },
            {
                name: "Nhiệm vụ được giao - Báo cáo",
                code: "report_received_tasks",
                description: "Report on received tasks",
                path: "/bao-cao/nhiem-vu-duoc-giao",
                groupName: "reports",
                orderIndex: 2,
                requiredPermissionCode: "task.view",
            },
            {
                name: "Tổng hợp theo văn bản",
                code: "report_by_document",
                description: "Report by document",
                path: "/bao-cao/tong-hop-theo-van-ban",
                groupName: "reports",
                orderIndex: 3,
                requiredPermissionCode: "task.view",
            },
            {
                name: "Tổng hợp theo đơn vị",
                code: "report_by_organization",
                description: "Report by organization",
                path: "/bao-cao/tong-hop-theo-don-vi",
                groupName: "reports",
                orderIndex: 4,
                requiredPermissionCode: "task.view",
            },
            {
                name: "Tổng hợp theo lĩnh vực",
                code: "report_by_field",
                description: "Report by field",
                path: "/bao-cao/tong-hop-theo-linh-vuc",
                groupName: "reports",
                orderIndex: 5,
                requiredPermissionCode: "task.view",
            },
            {
                name: "Tổng hợp theo loại văn bản",
                code: "report_by_document_type",
                description: "Report by document type",
                path: "/bao-cao/tong-hop-theo-loai-van-ban",
                groupName: "reports",
                orderIndex: 6,
                requiredPermissionCode: "task.view",
            },
            {
                name: "Báo cáo chi tiết nhiệm vụ",
                code: "report_task_detail",
                description: "Detailed task report",
                path: "/bao-cao/bao-cao-chi-tiet-nhiem-vu",
                groupName: "reports",
                orderIndex: 7,
                requiredPermissionCode: "task.view",
            },

            // ===== POVERTY =====
            {
                name: "Hộ nghèo - Danh sách",
                code: "poverty_households",
                description: "Danh sách hộ nghèo và cận nghèo",
                path: "/ho-ngheo",
                groupName: "poverty",
                orderIndex: 1,
                requiredPermissionCode: "poverty.household.view",
            },
            {
                name: "Hộ nghèo - Dashboard",
                code: "poverty_dashboard",
                description: "Dashboard hộ nghèo và cận nghèo",
                path: "/ho-ngheo/dashboard",
                groupName: "poverty",
                orderIndex: 2,
                requiredPermissionCode: "poverty.dashboard.read",
            },
            {
                name: "Hộ nghèo - Bản đồ",
                code: "poverty_map",
                description: "Bản đồ hộ nghèo và cận nghèo",
                path: "/ho-ngheo/ban-do",
                groupName: "poverty",
                orderIndex: 3,
                requiredPermissionCode: "poverty.map.read",
            },
            {
                name: "Hộ nghèo - Báo cáo",
                code: "poverty_report",
                description: "Báo cáo hộ nghèo và cận nghèo",
                path: "/ho-ngheo/bao-cao",
                groupName: "poverty",
                orderIndex: 4,
                requiredPermissionCode: "poverty.report.read",
            },
            {
                name: "Hộ nghèo - Thông tin chung",
                code: "poverty_year_overview",
                description: "Quản lý thông tin chung hộ nghèo theo năm",
                path: "/ho-ngheo/thong-tin-chung",
                groupName: "poverty",
                orderIndex: 5,
                requiredPermissionCode: "poverty.report.read",
            },

            // ===== CATEGORIES =====
            {
                name: "Danh mục đơn vị",
                code: "categories_organization",
                description: "Organization categories",
                path: "/danh-muc/don-vi",
                groupName: "categories",
                orderIndex: 1,
                requiredPermissionCode: "category.view",
            },
        ];

        // Delete existing features for this workspace (for idempotency)
        await db.delete(features).where(sql`workspace_id = ${workspaceId}`);
        console.log("🗑️  Cleared existing features");

        // Insert all menu items
        let insertedCount = 0;
        for (const item of menuItems) {
            try {
                await db.insert(features).values({
                    workspaceId,
                    name: item.name,
                    code: item.code,
                    description: item.description,
                    path: item.path,
                    groupName: item.groupName,
                    orderIndex: item.orderIndex,
                    icon: item.icon,
                    enabled: true,
                    requiredPermissionCode: item.requiredPermissionCode ?? null,
                    requiresSuperAdmin: item.requiresSuperAdmin ?? false,
                    requiresWorkspaceAdmin: false,
                });
                insertedCount++;
            } catch (error) {
                console.error(`Error inserting ${item.code}:`, error);
            }
        }

        console.log(`✅ Seeded ${insertedCount} features into database`);
        console.log("✅ All menus are now dynamic - loading from API");

    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

seedFeatures();
