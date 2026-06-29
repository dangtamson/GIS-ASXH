import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { logger } from "@/helpers/logger.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { features, featureSubItems, workspaceFeatures, workspaceMemberships } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, eq, inArray } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

const featureSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    code: z.string().min(1),
    icon: z.string().optional(),
    path: z.string().min(1),
    groupName: z.string().min(1),
    enabled: z.boolean().default(true),
    requiredPermissionCode: z.string().nullable().optional(),
    requiresSuperAdmin: z.boolean().default(false),
    requiresWorkspaceAdmin: z.boolean().default(false),
    orderIndex: z.number().default(0),
    workspaces: z.array(z.string()).optional().default([]),
});

/**
 * Get all features for a workspace
 */
export const listFeatures = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const workspaceId = req.workspaceId;
            if (!workspaceId) {
                const response = apiResponse.error(HttpErrors.Unauthorized("Workspace context required"));
                res.status(response.code).send(response);
                return;
            }

            const allFeatures = await db
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


          const allFeaturesIds = allFeatures.map((e) => e.uuid)

            const wfs = await db.select().from(workspaceFeatures)
              .where(inArray(workspaceFeatures.featureId, allFeaturesIds));

          const wfsMap = wfs.reduce((map, item) => {
            const key = item.featureId;

            if (!map.has(key)) {
              map.set(key, []);
            }

            map.get(key).push(item.workspaceId);
            return map;
          }, new Map());

          const data = allFeatures.map((f) => ({
            ...f,
            workspaces: wfsMap.get(f.uuid) || [],
          }))


            const response = apiResponse.success(HttpStatusCode.OK, data, "Features retrieved successfully");
            res.status(response.code).send(response);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * Get features by group
 */
export const listFeaturesByGroup = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const workspaceId = req.workspaceId;
            const { groupName } = req.params;

            if (!workspaceId) {
                const response = apiResponse.error(HttpErrors.Unauthorized("Workspace context required"));
                res.status(response.code).send(response);
                return;
            }

          if (!groupName) {
            const response = apiResponse.error(HttpErrors.Unauthorized("groupName required"));
            res.status(response.code).send(response);
            return;
          }

            const groupFeatures = await db
                .select()
                .from(features)
                .where(and(eq(features.workspaceId, workspaceId), eq(features.groupName, groupName)))
                .orderBy(features.orderIndex);

            const response = apiResponse.success(
                HttpStatusCode.OK,
                groupFeatures,
                `Features in group '${groupName}' retrieved successfully`
            );
            res.status(response.code).send(response);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * Get feature by ID with sub-items
 */
export const getFeature = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const workspaceId = req.workspaceId;
            const { featureId } = req.params;

            if (!featureId) {
              const response = apiResponse.error(HttpErrors.Unauthorized("feature id required"));
              res.status(response.code).send(response);
              return;
            }

            if (!workspaceId) {
                const response = apiResponse.error(HttpErrors.Unauthorized("Workspace context required"));
                res.status(response.code).send(response);
                return;
            }

            const result = await db
                .select()
                .from(features)
                .where(and(eq(features.uuid, featureId), eq(features.workspaceId, workspaceId)))
                .limit(1);

            const feature = result[0];

            if (!feature) {
                const response = apiResponse.error(HttpErrors.NotFound("Feature not found"));
                res.status(response.code).send(response);
                return;
            }

            const subItems = await db
                .select()
                .from(featureSubItems)
                .where(eq(featureSubItems.featureId, featureId))
                .orderBy(featureSubItems.orderIndex);

            const response = apiResponse.success(
                HttpStatusCode.OK,
                { ...feature, subItems },
                "Feature retrieved successfully"
            );
            res.status(response.code).send(response);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * Create new feature
 */
export const createFeature = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
          const workspaceId = req.workspaceId;
          const accountId = req.accountId;

          if (!workspaceId || !accountId) {
            const response = apiResponse.error(HttpErrors.Unauthorized("Workspace and account context required"));
            res.status(response.code).send(response);
            return;
          }

          const validation = featureSchema.safeParse(req.body);
          if (!validation.success) {
            const response = apiResponse.error(
              HttpErrors.ValidationFailed(`Invalid feature data: ${validation.error.message}`)
            );
            res.status(response.code).send(response);
            return;
          }

          const [result] = await db
            .insert(features)
            .values({
              workspaceId,
              createdBy: accountId,
              updatedBy: accountId,
              name: validation.data.name,
              description: validation.data.description,
              code: validation.data.code,
              icon: validation.data.icon,
              path: validation.data.path,
              groupName: validation.data.groupName,
              enabled: validation.data.enabled,
              requiredPermissionCode: validation.data.requiredPermissionCode?.trim() || null,
              requiresSuperAdmin: validation.data.requiresSuperAdmin,
              requiresWorkspaceAdmin: validation.data.requiresWorkspaceAdmin,
              orderIndex: validation.data.orderIndex
            })
            .returning();

          let workspaces: any[] = [];
          if (result && validation.data.workspaces.length > 0) {
            workspaces = await db
              .insert(workspaceFeatures)
              .values(
                validation.data.workspaces.map((wsId) => ({
                  featureId: result.uuid!,
                  workspaceId: wsId
                }))
              )
              .onConflictDoNothing().returning();
          }

          const response = apiResponse.success(HttpStatusCode.CREATED, {
            ...result,
            workspaces: workspaces.length > 0 ? workspaces.map((e) => e.workspaceId) : []
          }, "Feature created successfully");
          res.status(response.code).send(response);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * Update feature
 */
export const updateFeature = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const workspaceId = req.workspaceId;
            const accountId = req.accountId;
            const { featureId } = req.params;

            if (!workspaceId || !accountId) {
                const response = apiResponse.error(HttpErrors.Unauthorized("Workspace and account context required"));
                res.status(response.code).send(response);
                return;
            }

          if (!featureId) {
            const response = apiResponse.error(HttpErrors.Unauthorized("feature id required"));
            res.status(response.code).send(response);
            return;
          }

            // Verify feature belongs to workspace
            const existing = await db
                .select()
                .from(features)
                .where(and(eq(features.uuid, featureId), eq(features.workspaceId, workspaceId)))
                .limit(1) as any;

            if (!existing[0]) {
                const response = apiResponse.error(HttpErrors.NotFound("Feature not found"));
                res.status(response.code).send(response);
                return;
            }

            const validation = featureSchema.safeParse(req.body);
            if (!validation.success) {
                const response = apiResponse.error(
                    HttpErrors.ValidationFailed(`Invalid feature data: ${validation.error.message}`)
                );
                res.status(response.code).send(response);
                return;
            }

            const [result] = await db
                .update(features)
                .set({
                    name: validation.data.name,
                    description: validation.data.description,
                    code: validation.data.code,
                    icon: validation.data.icon,
                    path: validation.data.path,
                    groupName: validation.data.groupName,
                    enabled: validation.data.enabled,
                    requiredPermissionCode: validation.data.requiredPermissionCode?.trim() || null,
                    requiresSuperAdmin: validation.data.requiresSuperAdmin,
                    requiresWorkspaceAdmin: validation.data.requiresWorkspaceAdmin,
                    orderIndex: validation.data.orderIndex,
                    updatedBy: accountId,
                    updatedAt: new Date()
                })
                .where(eq(features.uuid, featureId))
                .returning();

          const workspaces = await db.transaction(async (tx) => {
            await tx.delete(workspaceFeatures).where(eq(workspaceFeatures.featureId, featureId));

            if (validation.data.workspaces?.length) {
              await tx.insert(workspaceFeatures).values(
                validation.data.workspaces.map((wsId) => ({
                  featureId,
                  workspaceId: wsId
                }))
              );
            }

            // 3. Lấy lại full data (source of truth)
            return await tx.select().from(workspaceFeatures).where(eq(workspaceFeatures.featureId, featureId));
          });


            const response = apiResponse.success(HttpStatusCode.OK, {
              ...result,
              workspaces: workspaces
            }, "Feature updated successfully");
            res.status(response.code).send(response);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * Toggle feature enabled/disabled
 */
export const toggleFeature = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const workspaceId = req.workspaceId;
            const accountId = req.accountId;
            const { featureId } = req.params;

            if (!workspaceId || !accountId) {
                const response = apiResponse.error(HttpErrors.Unauthorized("Workspace and account context required"));
                res.status(response.code).send(response);
                return;
            }


          if (!featureId) {
            const response = apiResponse.error(HttpErrors.Unauthorized("feature id required"));
            res.status(response.code).send(response);
            return;
          }

            const existing = await db
                .select()
                .from(features)
                .where(and(eq(features.uuid, featureId), eq(features.workspaceId, workspaceId)))
                .limit(1) as any;

            const existingFeature = existing[0];

            if (!existingFeature) {
                const response = apiResponse.error(HttpErrors.NotFound("Feature not found"));
                res.status(response.code).send(response);
                return;
            }

            const result = await db
                .update(features)
                .set({
                    enabled: !existingFeature.enabled,
                    updatedBy: accountId,
                    updatedAt: new Date()
                })
                .where(eq(features.uuid, featureId))
                .returning() as any;

            const updatedFeature = result[0];

            logger.info(
                { featureId, enabled: updatedFeature?.enabled, workspaceId },
                `Feature toggled: ${existingFeature.name}`
            );

            const response = apiResponse.success(
                HttpStatusCode.OK,
                updatedFeature,
                `Feature ${updatedFeature?.enabled ? "enabled" : "disabled"} successfully`
            );
            res.status(response.code).send(response);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * Delete feature
 */
export const deleteFeature = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const workspaceId = req.workspaceId;
            const { featureId } = req.params;

            if (!workspaceId) {
                const response = apiResponse.error(HttpErrors.Unauthorized("Workspace context required"));
                res.status(response.code).send(response);
                return;
            }

          if (!featureId) {
            const response = apiResponse.error(HttpErrors.Unauthorized("feature id required"));
            res.status(response.code).send(response);
            return;
          }

            const existing = await db
                .select()
                .from(features)
                .where(and(eq(features.uuid, featureId), eq(features.workspaceId, workspaceId)))
                .limit(1) as any;

            const existingFeature = existing[0];

            if (!existingFeature) {
                const response = apiResponse.error(HttpErrors.NotFound("Feature not found"));
                res.status(response.code).send(response);
                return;
            }

          if (!featureId) {
            const response = apiResponse.error(HttpErrors.Unauthorized("feature id required"));
            res.status(response.code).send(response);
            return;
          }

            await db.delete(features).where(eq(features.uuid, featureId));

            logger.info({ featureId, workspaceId }, `Feature deleted: ${existingFeature.name}`);

            const response = apiResponse.success(
                HttpStatusCode.OK,
                { message: "Feature deleted successfully" },
                "Feature removed"
            );
            res.status(response.code).send(response);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * Reorder features
 */
export const reorderFeatures = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const workspaceId = req.workspaceId;
            const { orderedIds } = req.body as { orderedIds: string[] };

            if (!workspaceId) {
                const response = apiResponse.error(HttpErrors.Unauthorized("Workspace context required"));
                res.status(response.code).send(response);
                return;
            }

            if (!Array.isArray(orderedIds)) {
                const response = apiResponse.error(
                    HttpErrors.ValidationFailed("orderedIds must be an array of feature UUIDs")
                );
                res.status(response.code).send(response);
                return;
            }

            // Update order for each feature
            for (let i = 0; i < orderedIds.length; i++) {
              const id = orderedIds[i];
              if (!id) continue;

              await db
                .update(features)
                .set({ orderIndex: i })
                .where(and(eq(features.uuid, id), eq(features.workspaceId, workspaceId)));
            }

            const response = apiResponse.success(HttpStatusCode.OK, { message: "Features reordered" }, "Order updated");
            res.status(response.code).send(response);
        } catch (err) {
            next(err);
        }
    }
);
