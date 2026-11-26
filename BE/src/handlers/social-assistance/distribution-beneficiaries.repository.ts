import { and, asc, eq } from "drizzle-orm";
import type { PovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import {
    poorHouseholds,
    socialAssistanceDistributionBeneficiaries,
    socialAssistanceDistributionTargets
} from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { canAccessDistributionBeneficiary } from "./distribution-beneficiaries.scope.ts";
import {
    distributionBeneficiaryCreateSchema,
    type DistributionBeneficiaryCreateInput
} from "./distribution-orders.schemas.ts";

type Beneficiary = typeof socialAssistanceDistributionBeneficiaries.$inferSelect;

export const listDistributionBeneficiaries = async (
    workspaceId: string,
    scope: PovertyAccessScope,
    targetId: string
): Promise<Beneficiary[] | null> => {
    if (!workspaceId || !targetId) return null;
    const [target] = await db.select().from(socialAssistanceDistributionTargets)
        .where(and(
            eq(socialAssistanceDistributionTargets.workspaceId, workspaceId),
            eq(socialAssistanceDistributionTargets.id, targetId)
        ))
        .limit(1);
    if (!target || !canAccessDistributionBeneficiary(workspaceId, scope, target)) return null;

    return db.select().from(socialAssistanceDistributionBeneficiaries)
        .where(and(
            eq(socialAssistanceDistributionBeneficiaries.workspaceId, workspaceId),
            eq(socialAssistanceDistributionBeneficiaries.targetId, target.id)
        ))
        .orderBy(asc(socialAssistanceDistributionBeneficiaries.createdAt));
};

export const createDistributionBeneficiary = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    input: DistributionBeneficiaryCreateInput
): Promise<Beneficiary | null> => {
    const validatedInput = distributionBeneficiaryCreateSchema.parse(input);
    if (!workspaceId || !actorId) return null;

    return db.transaction(async (transaction) => {
        const [target] = await transaction
            .select()
            .from(socialAssistanceDistributionTargets)
            .where(and(
                eq(socialAssistanceDistributionTargets.id, validatedInput.targetId),
                eq(socialAssistanceDistributionTargets.componentId, validatedInput.componentId),
                eq(socialAssistanceDistributionTargets.workspaceId, workspaceId)
            ))
            .limit(1)
            .for("update");
        if (!target || !canAccessDistributionBeneficiary(workspaceId, scope, target)) return null;

        if (validatedInput.householdId) {
            if (target.type !== "LOCALITY" || !target.provinceCode || !target.wardCode) return null;
            const [household] = await transaction
                .select({ id: poorHouseholds.id })
                .from(poorHouseholds)
                .where(and(
                    eq(poorHouseholds.id, validatedInput.householdId),
                    eq(poorHouseholds.provinceCode, target.provinceCode),
                    eq(poorHouseholds.wardCode, target.wardCode)
                ))
                .limit(1);
            if (!household) return null;
        }

        const [beneficiary] = await transaction
            .insert(socialAssistanceDistributionBeneficiaries)
            .values({
                ...validatedInput,
                workspaceId,
                orderId: target.orderId,
                createdBy: actorId,
                updatedBy: actorId
            })
            .returning();
        return beneficiary ?? null;
    });
};