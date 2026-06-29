import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { features, roleFeatures, roles, workspaceFeatures, workspaceMemberships } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, eq, inArray } from "drizzle-orm";
import type { Request, Response } from "express";
import type { NextFunction } from "express";
import { z } from "zod";

const bulkUpdateRoleFeaturesSchema = z.object({
    featureIds: z.array(z.string().uuid())
});

/**
 * Get all features accessible to a specific role
 * GET /admin/roles/:roleId/features
 */
export const getRoleFeatures = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const workspaceId = req.workspaceId;
            const { roleId } = req.params;

            if (!workspaceId) {
                const response = apiResponse.error(HttpErrors.Unauthorized("Workspace context required"));
                res.status(response.code).send(response);
                return;
            }

            if (!roleId || isNaN(parseInt(roleId))) {
                const response = apiResponse.error(HttpErrors.BadRequest("Valid roleId required"));
                res.status(response.code).send(response);
                return;
            }

            // Verify role exists
            const [roleExists] = await db.select().from(roles).where(eq(roles.id, parseInt(roleId))).limit(1);
            if (!roleExists) {
                const response = apiResponse.error(HttpErrors.NotFound("Role not found"));
                res.status(response.code).send(response);
                return;
            }

            // Get all features for this role in this workspace
            const roleFeatureMappings = await db
              .select({
                featureId: roleFeatures.featureId,
                roleFeaturesCreatedAt: roleFeatures.createdAt,
                feature: {
                  uuid: features.uuid,
                  name: features.name,
                  code: features.code,
                  description: features.description,
                  icon: features.icon,
                  path: features.path,
                  groupName: features.groupName,
                  enabled: features.enabled
                }
              })
              .from(roleFeatures)
              .leftJoin(features, eq(roleFeatures.featureId, features.uuid))
              .innerJoin(workspaceFeatures, eq(workspaceFeatures.featureId, features.uuid))
              .where(and(eq(roleFeatures.roleId, parseInt(roleId)), eq(workspaceFeatures.workspaceId, workspaceId)))
              .orderBy(features.groupName, features.orderIndex);

            const response = apiResponse.success(HttpStatusCode.OK, roleFeatureMappings, "Role features retrieved");
            res.status(response.code).send(response);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * Update role features - bulk set which features a role can access
 * PUT /admin/roles/:roleId/features
 */
export const updateRoleFeatures = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const workspaceId = req.workspaceId;
            const { roleId } = req.params;
            const parsedRoleId = Number.parseInt(String(roleId), 10);

            if (!workspaceId) {
                const response = apiResponse.error(HttpErrors.Unauthorized("Workspace context required"));
                res.status(response.code).send(response);
                return;
            }

            if (!roleId || Number.isNaN(parsedRoleId) || parsedRoleId <= 0) {
                const response = apiResponse.error(HttpErrors.BadRequest("Valid roleId required"));
                res.status(response.code).send(response);
                return;
            }

            // Validate request body
            const parsed = bulkUpdateRoleFeaturesSchema.safeParse(req.body);
            if (!parsed.success) {
                const response = apiResponse.error(
                    HttpErrors.BadRequest(`Invalid request: ${parsed.error.message}`)
                );
                res.status(response.code).send(response);
                return;
            }

            const { featureIds } = parsed.data;

            // Verify role exists
            const [roleExists] = await db.select().from(roles).where(eq(roles.id, parsedRoleId)).limit(1);
            if (!roleExists) {
                const response = apiResponse.error(HttpErrors.NotFound("Role not found"));
                res.status(response.code).send(response);
                return;
            }

            // Verify all requested features exist in this workspace
            if (featureIds.length > 0) {
                const existingFeatures = await db
                  .select({ uuid: features.uuid })
                  .from(features)
                  .innerJoin(workspaceFeatures, eq(workspaceFeatures.featureId, features.uuid))
                  .where(and(eq(workspaceFeatures.workspaceId, workspaceId), inArray(features.uuid, featureIds)));

                if (existingFeatures.length !== featureIds.length) {
                    const response = apiResponse.error(
                        HttpErrors.BadRequest("One or more feature IDs do not exist in this workspace")
                    );
                    res.status(response.code).send(response);
                    return;
                }
            }

            // Delete all existing role-feature mappings for this role
            await db.delete(roleFeatures).where(eq(roleFeatures.roleId, parsedRoleId));

            // Insert new role-feature mappings
            if (featureIds.length > 0) {
                const mappingsToInsert = featureIds.map((featureId) => ({
                    roleId: parsedRoleId,
                    featureId
                }));

                await db.insert(roleFeatures).values(mappingsToInsert).onConflictDoNothing();
            }

            const response = apiResponse.success(
                HttpStatusCode.OK,
                { roleId: parsedRoleId, featureIds },
                "Role features updated successfully"
            );
            res.status(response.code).send(response);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * Get all features available for assignment (in workspace)
 * GET /admin/features/available
 */
export const getAvailableFeatures = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const workspaceId = req.workspaceId;

            if (!workspaceId) {
                const response = apiResponse.error(HttpErrors.Unauthorized("Workspace context required"));
                res.status(response.code).send(response);
                return;
            }

            const availableFeatures = await db
              .select({
                uuid: features.uuid,
                name: features.name,
                code: features.code,
                description: features.description,
                icon: features.icon,
                path: features.path,
                groupName: features.groupName,
                enabled: features.enabled,
                orderIndex: features.orderIndex
              })
              .from(features)
              .innerJoin(workspaceFeatures, eq(workspaceFeatures.featureId, features.uuid))
              .where(eq(workspaceFeatures.workspaceId, workspaceId))
              .orderBy(features.groupName, features.orderIndex);

            const response = apiResponse.success(HttpStatusCode.OK, availableFeatures, "Available features retrieved");
            res.status(response.code).send(response);
        } catch (err) {
            next(err);
        }
    }
);
