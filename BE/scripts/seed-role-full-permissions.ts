import { config } from "@/config.ts";
import { logger } from "@/helpers/index.ts";
import { permissions, rolePermissions, roles } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, eq, inArray } from "drizzle-orm";

function parseRoleId(argv: string[]): number {
  const argWithEquals = [...argv].reverse().find((arg) => arg.startsWith("--roleId="));
  const directValue = argWithEquals?.split("=")[1];

  if (directValue) {
    const parsed = Number.parseInt(directValue, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const roleIdIndex = argv.findIndex((arg) => arg === "--roleId");
  if (roleIdIndex >= 0 && argv[roleIdIndex + 1]) {
    const parsed = Number.parseInt(argv[roleIdIndex + 1]!, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 91;
}

async function seedFullPermissionsForRole(roleId: number): Promise<void> {
  const [role] = await db
    .select({ id: roles.id, code: roles.code, name: roles.name })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1)
    .execute();

  if (!role) {
    throw new Error(`Role with id ${roleId} not found`);
  }

  const permissionRows = await db.select({ id: permissions.id }).from(permissions).execute();
  const allPermissionIds = permissionRows.map((row) => row.id);

  if (allPermissionIds.length === 0) {
    logger.warn({ roleId }, "No permissions found in DB, nothing to seed");
    return;
  }

  const existingRows = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(and(eq(rolePermissions.roleId, roleId), inArray(rolePermissions.permissionId, allPermissionIds)))
    .execute();

  const existingPermissionIds = new Set(
    existingRows
      .filter((row) => row.permissionId !== null)
      .map((row) => row.permissionId)
  );

  const missingPermissionIds = allPermissionIds.filter((permissionId) => !existingPermissionIds.has(permissionId));

  if (missingPermissionIds.length === 0) {
    logger.info(
      {
        roleId,
        roleCode: role.code,
        roleName: role.name,
        totalPermissions: allPermissionIds.length,
        inserted: 0,
        missing: 0
      },
      "Role already has full permissions"
    );
    return;
  }

  const insertRows = missingPermissionIds.map((permissionId) => ({
    roleId,
    permissionId
  }));

  await db
    .insert(rolePermissions)
    .values(insertRows)
    .onConflictDoNothing({ target: [rolePermissions.roleId, rolePermissions.permissionId] });

  logger.info(
    {
      roleId,
      roleCode: role.code,
      roleName: role.name,
      totalPermissions: allPermissionIds.length,
      inserted: insertRows.length,
      missing: missingPermissionIds.length
    },
    "Seeded full permissions for role"
  );
}

const roleId = parseRoleId(process.argv.slice(2));

seedFullPermissionsForRole(roleId)
  .then(() => {
    logger.info({ env: config.env, roleId }, "seed-role-full-permissions finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ error, roleId }, "seed-role-full-permissions failed");
    process.exit(1);
  });
