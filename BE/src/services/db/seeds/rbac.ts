import { logger } from "@/helpers/index.ts";
import { permissions, rolePermissions, roles } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { inArray } from "drizzle-orm";

const defaultRoles = [
  { code: "admin", name: "Admin", description: "Workspace administrator" },
  { code: "user", name: "User", description: "Standard workspace member" },
  { code: "owner", name: "Owner", description: "Resource owner role" }
] as const;

const defaultPermissions = [
  { code: "workspace.read", name: "Read workspace", description: "View workspace details" },
  { code: "workspace.update", name: "Update workspace", description: "Update workspace settings" },
  { code: "workspace.member.read", name: "Read workspace members", description: "View workspace members" },
  { code: "workspace.member.manage", name: "Manage workspace members", description: "Add/remove/update members" },
  { code: "document.view", name: "View documents", description: "View document records" },
  { code: "document.create", name: "Create documents", description: "Create document records" },
  { code: "document.update", name: "Update documents", description: "Update document records" },
  { code: "document.delete", name: "Delete documents", description: "Delete document records" },
  { code: "task.view", name: "View tasks", description: "View task records" },
  { code: "task.create", name: "Create tasks", description: "Create task records" },
  { code: "task.update", name: "Update tasks", description: "Update task records" },
  { code: "task.delete", name: "Delete tasks", description: "Delete task records" },
  { code: "file.view", name: "View files", description: "View file metadata" },
  { code: "file.create", name: "Create files", description: "Upload file metadata" },
  { code: "file.update", name: "Update files", description: "Update file metadata" },
  { code: "file.delete", name: "Delete files", description: "Delete file metadata" },
  { code: "notification.view", name: "View notifications", description: "View notifications" },
  { code: "notification.create", name: "Create notifications", description: "Create notifications" },
  { code: "notification.update", name: "Update notifications", description: "Update notifications" },
  { code: "notification.delete", name: "Delete notifications", description: "Delete notifications" },
  { code: "organization.view", name: "View organizations", description: "View organizations" },
  { code: "organization.create", name: "Create organizations", description: "Create organizations" },
  { code: "organization.update", name: "Update organizations", description: "Update organizations" },
  { code: "organization.delete", name: "Delete organizations", description: "Delete organizations" },
  { code: "category.view", name: "View categories", description: "View category data" },
  { code: "category.create", name: "Create categories", description: "Create category data" },
  { code: "category.update", name: "Update categories", description: "Update category data" },
  { code: "category.delete", name: "Delete categories", description: "Delete category data" },
  { code: "audit.read", name: "Read audit logs", description: "View audit log data" },
  { code: "admin.account.view", name: "View admin accounts", description: "View account administration data" },
  { code: "admin.account.create", name: "Create admin accounts", description: "Create account administration records" },
  { code: "admin.account.update", name: "Update admin accounts", description: "Update account administration state" },
  { code: "admin.account.delete", name: "Delete admin accounts", description: "Delete account administration records" },
  { code: "admin.rbac.view", name: "View RBAC settings", description: "View RBAC roles and permissions" },
  { code: "admin.rbac.create", name: "Create RBAC settings", description: "Create RBAC roles and permissions" },
  { code: "admin.rbac.update", name: "Update RBAC settings", description: "Update RBAC roles and permissions" },
  { code: "admin.rbac.delete", name: "Delete RBAC settings", description: "Delete RBAC roles and permissions" },
  { code: "poverty.household.view", name: "View poverty households", description: "View poverty household list" },
  { code: "poverty.household.create", name: "Create poverty households", description: "Create poverty household records" },
  { code: "poverty.household.update", name: "Update poverty households", description: "Update poverty household records" },
  { code: "poverty.household.delete", name: "Delete poverty households", description: "Deactivate poverty household records" },
  { code: "poverty.household.import", name: "Import poverty households", description: "Import poverty households from spreadsheet" },
  { code: "poverty.household.export", name: "Export poverty households", description: "Export poverty household data" },
  { code: "poverty.household.detail.view", name: "View poverty household detail", description: "View household members, assessments, photos, and change logs" },
  { code: "poverty.household.detail.update", name: "Update poverty household detail", description: "Update household members, assessments, and detail attachments" },
  { code: "poverty.ward_overview.view", name: "View ward overview", description: "View yearly ward overview information" },
  { code: "poverty.ward_overview.create", name: "Create ward overview", description: "Create yearly ward overview information" },
  { code: "poverty.ward_overview.update", name: "Update ward overview", description: "Create or update yearly ward overview information" },
  { code: "poverty.ward_overview.delete", name: "Delete ward overview", description: "Delete yearly ward overview information" },
  { code: "poverty.ward_area.view", name: "View ward areas", description: "View ward area and hamlet records" },
  { code: "poverty.ward_area.create", name: "Create ward areas", description: "Create ward area and hamlet records" },
  { code: "poverty.ward_area.update", name: "Update ward areas", description: "Update ward area and hamlet records" },
  { code: "poverty.ward_area.delete", name: "Delete ward areas", description: "Delete ward area and hamlet records" },
  { code: "poverty.map.read", name: "View poverty map", description: "View poverty GIS map and markers" },
  { code: "poverty.map.create_household", name: "Create poverty household on map", description: "Create poverty household records from the map interface" },
  { code: "poverty.map.update_position", name: "Update poverty marker position", description: "Update household latitude and longitude by dragging markers on the map" },
  { code: "poverty.dashboard.read", name: "View poverty dashboard", description: "View poverty dashboard metrics and charts" },
  { code: "poverty.report.read", name: "View poverty reports", description: "View poverty report summaries" },
  { code: "poverty.report.export", name: "Export poverty reports", description: "Export poverty reports to spreadsheet" }
] as const;

const defaultRolePermissionMatrix: ReadonlyArray<{ roleCode: string; permissionCodes: readonly string[] }> = [
  {
    roleCode: "admin",
    permissionCodes: defaultPermissions.map((permission) => permission.code)
  },
  {
    roleCode: "user",
    permissionCodes: [
      "workspace.read",
      "workspace.member.read",
      "document.view",
      "task.view",
      "file.view",
      "notification.view"
    ]
  },
  {
    roleCode: "owner",
    permissionCodes: ["workspace.read", "document.view", "task.view", "file.view"]
  }
];

export async function seedRbacDefaults(): Promise<void> {
  logger.info("🔐 Seeding default RBAC data...");

  await db.insert(roles).values([...defaultRoles]).onConflictDoNothing({ target: roles.code });
  await db.insert(permissions).values([...defaultPermissions]).onConflictDoNothing({ target: permissions.code });

  const roleRows = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(inArray(roles.code, defaultRoles.map((role) => role.code)));

  const permissionRows = await db
    .select({ id: permissions.id, code: permissions.code })
    .from(permissions)
    .where(inArray(permissions.code, defaultPermissions.map((permission) => permission.code)));

  const roleIdByCode = new Map(roleRows.map((role) => [role.code, role.id]));
  const permissionIdByCode = new Map(permissionRows.map((permission) => [permission.code, permission.id]));

  const rolePermissionRows = defaultRolePermissionMatrix.flatMap(({ roleCode, permissionCodes }) => {
    const roleId = roleIdByCode.get(roleCode);
    if (!roleId) return [];

    return permissionCodes
      .map((permissionCode) => {
        const permissionId = permissionIdByCode.get(permissionCode);
        if (!permissionId) return null;
        return {
          roleId,
          permissionId
        };
      })
      .filter((row): row is { roleId: number; permissionId: number } => row !== null);
  });

  if (rolePermissionRows.length > 0) {
    await db
      .insert(rolePermissions)
      .values(rolePermissionRows)
      .onConflictDoNothing({ target: [rolePermissions.roleId, rolePermissions.permissionId] });
  }

  logger.info(
    {
      roles: defaultRoles.length,
      permissions: defaultPermissions.length,
      rolePermissions: rolePermissionRows.length
    },
    "✅ Default RBAC seed completed"
  );
}
