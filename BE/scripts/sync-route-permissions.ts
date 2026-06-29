import { config } from "@/config.ts";
import { logger, permissions as routePermissions } from "@/helpers/index.ts";
import { PERMISSION_CODES } from "@/helpers/permissions.ts";
import { permissions as permissionRecords } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { inArray } from "drizzle-orm";

function toTitleCase(value: string): string {
  return value
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function collectPermissionCodesFromRoutes(): string[] {
  const codes = new Set<string>();

  for (const [, metadata] of routePermissions.permissions.entries()) {
    for (const code of Object.values(metadata.permissions)) {
      if (!code) {
        continue;
      }

      if (code === PERMISSION_CODES.OwnerOnly) {
        continue;
      }

      codes.add(code);
    }
  }

  return [...codes].sort();
}

async function syncRoutePermissions(): Promise<void> {
  const routePermissionCodes = collectPermissionCodesFromRoutes();

  if (routePermissionCodes.length === 0) {
    logger.info("No route permission codes found to synchronize.");
    return;
  }

  const existingRows = await db
    .select({ code: permissionRecords.code })
    .from(permissionRecords)
    .where(inArray(permissionRecords.code, routePermissionCodes));

  const existingCodes = new Set(existingRows.map((row) => row.code).filter((code): code is string => Boolean(code)));

  const missingCodes = routePermissionCodes.filter((code) => !existingCodes.has(code));

  if (missingCodes.length === 0) {
    logger.info(
      {
        totalRouteCodes: routePermissionCodes.length,
        inserted: 0,
        missing: 0
      },
      "Route permissions are already synchronized with DB"
    );
    return;
  }

  const recordsToInsert = missingCodes.map((code) => ({
    code,
    name: toTitleCase(code),
    description: `Auto-synced permission code from route authorization mapping: ${code}`
  }));

  await db.insert(permissionRecords).values(recordsToInsert).onConflictDoNothing({ target: permissionRecords.code });

  logger.info(
    {
      totalRouteCodes: routePermissionCodes.length,
      inserted: recordsToInsert.length,
      missing: missingCodes.length,
      missingCodes
    },
    "Route permission synchronization completed"
  );
}

syncRoutePermissions()
  .then(() => {
    logger.info({ env: config.env }, "sync-route-permissions finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ error }, "sync-route-permissions failed");
    process.exit(1);
  });
