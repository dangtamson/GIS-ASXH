import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { isLocationWithinScope, type PovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import {
    organizations,
    provinces,
    socialAssistanceDistributionComponents,
    socialAssistanceDistributionOrders,
    socialAssistanceDistributionTargets,
    socialAssistancePrograms,
    wards
} from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { calculateDistributionComponentAmount, distributionOrderCreateSchema, type DistributionOrderCreateInput } from "./distribution-orders.schemas.ts";
import { getPublicPortalBySlug } from "./requests.repository.ts";

type DistributionOrder = typeof socialAssistanceDistributionOrders.$inferSelect;
type DistributionTarget = typeof socialAssistanceDistributionTargets.$inferSelect;
type DistributionComponent = typeof socialAssistanceDistributionComponents.$inferSelect;
type DistributionOrderWithComponents = DistributionOrder & {
    components: Array<DistributionComponent & { targets: DistributionTarget[] }>;
};

const targetIsInScope = (target: DistributionTarget, scope: PovertyAccessScope): boolean => {
    if (scope.isSuperAdmin) return true;
    if (target.type === "LOCALITY") return isLocationWithinScope(scope, target);
    return target.type === "ORGANIZATION" && Boolean(target.organizationId && scope.organizationIds.includes(target.organizationId));
};

export const listDistributionOrders = async (
    workspaceId: string,
    scope: PovertyAccessScope
): Promise<DistributionOrderWithComponents[]> => {
    if (!workspaceId || (!scope.isSuperAdmin && !scope.hasScope && scope.organizationIds.length === 0)) return [];

    const orders = await db.select().from(socialAssistanceDistributionOrders)
        .where(eq(socialAssistanceDistributionOrders.workspaceId, workspaceId))
        .orderBy(desc(socialAssistanceDistributionOrders.documentDate));
    if (orders.length === 0) return [];
    const components = await db.select().from(socialAssistanceDistributionComponents)
        .where(and(
            eq(socialAssistanceDistributionComponents.workspaceId, workspaceId),
            inArray(socialAssistanceDistributionComponents.orderId, orders.map((order) => order.id))
        ));
    if (components.length === 0) return [];
    const targets = await db.select().from(socialAssistanceDistributionTargets)
        .where(and(
            eq(socialAssistanceDistributionTargets.workspaceId, workspaceId),
            inArray(socialAssistanceDistributionTargets.componentId, components.map((component) => component.id))
        ));

    return orders.flatMap((order) => {
        const visibleComponents = components.filter((component) => component.orderId === order.id).flatMap((component) => {
            const visibleTargets = targets.filter((target) => target.componentId === component.id && targetIsInScope(target, scope));
            return visibleTargets.length ? [{ ...component, targets: visibleTargets }] : [];
        });
        return visibleComponents.length ? [{ ...order, components: visibleComponents }] : [];
    });
};

type PublicOrderSource = Pick<DistributionOrder,
    "status" | "publishedAt" | "documentNumber" | "documentDate" | "title" | "fundingSourceText"
    | "submissionDeadline" | "submissionDeadlineExclusive" | "completionDeadline" | "completionDeadlineExclusive"
> & {
    programTitle: string | null;
    components: Array<Pick<typeof socialAssistanceDistributionComponents.$inferSelect,
        "name" | "unitLabel" | "unitAmount" | "period" | "periodCount" | "periodStart" | "periodEnd"
        | "declaredTotalQuantity" | "declaredTotalAmount" | "eligibilitySummary"
    > & {
        targets: Array<Pick<typeof socialAssistanceDistributionTargets.$inferSelect,
            "type" | "provinceCode" | "wardCode" | "allocatedQuantity"
        > & { provinceName: string | null; wardName: string | null; organizationName: string | null }>;
    }>;
};

type PublicDistributionOrder = {
    documentNumber: string;
    documentDate: string;
    title: string;
    fundingSourceText: string;
    status: string;
    publishedAt: Date;
    submissionDeadline: string | null;
    submissionDeadlineExclusive: boolean;
    completionDeadline: string | null;
    completionDeadlineExclusive: boolean;
    programTitle: string | null;
    components: Array<{
        name: string;
        unitLabel: string;
        unitAmount: number;
        period: string;
        periodCount: number;
        periodStart: string | null;
        periodEnd: string | null;
        declaredTotalQuantity: number;
        declaredTotalAmount: number | null;
        projectedTotalAmount: number;
        eligibilitySummary: string;
        targets: Array<{
            type: string;
            provinceCode: string | null;
            wardCode: string | null;
            provinceName: string | null;
            wardName: string | null;
            organizationName: string | null;
            allocatedQuantity: number;
        }>;
    }>;
};

export const toPublicDistributionOrder = (order: PublicOrderSource): PublicDistributionOrder | null => {
    if (!order.publishedAt || (order.status !== "PUBLISHED" && order.status !== "CLOSED")) return null;
    return {
        documentNumber: order.documentNumber,
        documentDate: order.documentDate,
        title: order.title,
        fundingSourceText: order.fundingSourceText,
        status: order.status,
        publishedAt: order.publishedAt,
        submissionDeadline: order.submissionDeadline,
        submissionDeadlineExclusive: order.submissionDeadlineExclusive,
        completionDeadline: order.completionDeadline,
        completionDeadlineExclusive: order.completionDeadlineExclusive,
        programTitle: order.programTitle,
        components: order.components.map((component) => ({
            name: component.name,
            unitLabel: component.unitLabel,
            unitAmount: component.unitAmount,
            period: component.period,
            periodCount: component.periodCount,
            periodStart: component.periodStart,
            periodEnd: component.periodEnd,
            declaredTotalQuantity: component.declaredTotalQuantity,
            declaredTotalAmount: component.declaredTotalAmount,
            projectedTotalAmount: calculateDistributionComponentAmount(component),
            eligibilitySummary: component.eligibilitySummary,
            targets: component.targets.map((target) => ({
                type: target.type,
                provinceCode: target.provinceCode,
                wardCode: target.wardCode,
                provinceName: target.provinceName,
                wardName: target.wardName,
                organizationName: target.organizationName,
                allocatedQuantity: target.allocatedQuantity
            }))
        }))
    };
};

export const listPublicDistributionOrders = async (slug: string): Promise<PublicDistributionOrder[] | null> => {
    const portal = await getPublicPortalBySlug(slug, "allocationsEnabled");
    if (!portal) return null;

    const orders = await db.select({
        id: socialAssistanceDistributionOrders.id,
        documentNumber: socialAssistanceDistributionOrders.documentNumber,
        documentDate: socialAssistanceDistributionOrders.documentDate,
        title: socialAssistanceDistributionOrders.title,
        fundingSourceText: socialAssistanceDistributionOrders.fundingSourceText,
        submissionDeadline: socialAssistanceDistributionOrders.submissionDeadline,
        submissionDeadlineExclusive: socialAssistanceDistributionOrders.submissionDeadlineExclusive,
        completionDeadline: socialAssistanceDistributionOrders.completionDeadline,
        completionDeadlineExclusive: socialAssistanceDistributionOrders.completionDeadlineExclusive,
        status: socialAssistanceDistributionOrders.status,
        publishedAt: socialAssistanceDistributionOrders.publishedAt,
        programTitle: socialAssistancePrograms.title
    }).from(socialAssistanceDistributionOrders)
        .leftJoin(socialAssistancePrograms, and(
            eq(socialAssistancePrograms.id, socialAssistanceDistributionOrders.programId),
            eq(socialAssistancePrograms.workspaceId, portal.workspaceId)
        ))
        .where(and(
            eq(socialAssistanceDistributionOrders.workspaceId, portal.workspaceId),
            inArray(socialAssistanceDistributionOrders.status, ["PUBLISHED", "CLOSED"]),
            isNotNull(socialAssistanceDistributionOrders.publishedAt)
        ))
        .orderBy(desc(socialAssistanceDistributionOrders.documentDate));
    const eligible = orders.filter((order) => order.publishedAt && (order.status === "PUBLISHED" || order.status === "CLOSED"));
    if (eligible.length === 0) return [];

    const components = await db.select({
        id: socialAssistanceDistributionComponents.id,
        orderId: socialAssistanceDistributionComponents.orderId,
        name: socialAssistanceDistributionComponents.name,
        unitLabel: socialAssistanceDistributionComponents.unitLabel,
        unitAmount: socialAssistanceDistributionComponents.unitAmount,
        period: socialAssistanceDistributionComponents.period,
        periodCount: socialAssistanceDistributionComponents.periodCount,
        periodStart: socialAssistanceDistributionComponents.periodStart,
        periodEnd: socialAssistanceDistributionComponents.periodEnd,
        declaredTotalQuantity: socialAssistanceDistributionComponents.declaredTotalQuantity,
        declaredTotalAmount: socialAssistanceDistributionComponents.declaredTotalAmount,
        eligibilitySummary: socialAssistanceDistributionComponents.eligibilitySummary
    }).from(socialAssistanceDistributionComponents)
        .where(and(
            eq(socialAssistanceDistributionComponents.workspaceId, portal.workspaceId),
            inArray(socialAssistanceDistributionComponents.orderId, eligible.map((order) => order.id))
        ));
    if (components.length === 0) return [];

    const targets = await db.select({
        componentId: socialAssistanceDistributionTargets.componentId,
        type: socialAssistanceDistributionTargets.type,
        provinceCode: socialAssistanceDistributionTargets.provinceCode,
        wardCode: socialAssistanceDistributionTargets.wardCode,
        allocatedQuantity: socialAssistanceDistributionTargets.allocatedQuantity,
        provinceName: provinces.fullName,
        wardName: wards.fullName,
        organizationName: organizations.name
    }).from(socialAssistanceDistributionTargets)
        .leftJoin(provinces, eq(provinces.code, socialAssistanceDistributionTargets.provinceCode))
        .leftJoin(wards, and(
            eq(wards.code, socialAssistanceDistributionTargets.wardCode),
            eq(wards.provinceCode, socialAssistanceDistributionTargets.provinceCode)
        ))
        .leftJoin(organizations, and(
            eq(organizations.uuid, socialAssistanceDistributionTargets.organizationId),
            eq(organizations.workspaceId, portal.workspaceId)
        ))
        .where(and(
            eq(socialAssistanceDistributionTargets.workspaceId, portal.workspaceId),
            inArray(socialAssistanceDistributionTargets.componentId, components.map((component) => component.id))
        ));

    return eligible.flatMap((order) => {
        const projected = toPublicDistributionOrder({
            ...order,
            components: components.filter((component) => component.orderId === order.id).map((component) => ({
                ...component,
                targets: targets.filter((target) => target.componentId === component.id)
            }))
        });
        return projected ? [projected] : [];
    });
};

export const getDistributionOrder = async (
    workspaceId: string,
    scope: PovertyAccessScope,
    orderId: string
): Promise<DistributionOrderWithComponents | null> => {
    if (!workspaceId || !orderId) return null;
    const [order] = await db.select().from(socialAssistanceDistributionOrders)
        .where(and(
            eq(socialAssistanceDistributionOrders.workspaceId, workspaceId),
            eq(socialAssistanceDistributionOrders.id, orderId)
        ))
        .limit(1);
    if (!order) return null;

    const components = await db.select().from(socialAssistanceDistributionComponents)
        .where(and(
            eq(socialAssistanceDistributionComponents.workspaceId, workspaceId),
            eq(socialAssistanceDistributionComponents.orderId, order.id)
        ));
    if (components.length === 0) return null;
    const targets = await db.select().from(socialAssistanceDistributionTargets)
        .where(and(
            eq(socialAssistanceDistributionTargets.workspaceId, workspaceId),
            inArray(socialAssistanceDistributionTargets.componentId, components.map((component) => component.id))
        ));
    const visibleComponents = components.flatMap((component) => {
        const visibleTargets = targets.filter((target) => target.componentId === component.id && targetIsInScope(target, scope));
        return visibleTargets.length ? [{ ...component, targets: visibleTargets }] : [];
    });
    return visibleComponents.length ? { ...order, components: visibleComponents } : null;
};

export const createDistributionOrder = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    input: DistributionOrderCreateInput
): Promise<DistributionOrder | null> => {
    if (!workspaceId || !actorId) return null;
    const parsed = distributionOrderCreateSchema.safeParse(input);
    if (!parsed.success) return null;
    const validated = parsed.data;
    if (validated.legacyBatchId || validated.supersedesOrderId) return null;

    for (const component of validated.components) {
        for (const target of component.allocations) {
            if (scope.isSuperAdmin) continue;
            if (target.type === "LOCALITY" && !isLocationWithinScope(scope, target)) return null;
            if (target.type === "ORGANIZATION" && !scope.organizationIds.includes(target.organizationId)) return null;
        }
    }

    return db.transaction(async (transaction) => {
        if (validated.programId) {
            const [program] = await transaction.select({ id: socialAssistancePrograms.id })
                .from(socialAssistancePrograms)
                .where(and(eq(socialAssistancePrograms.id, validated.programId), eq(socialAssistancePrograms.workspaceId, workspaceId)))
                .limit(1);
            if (!program) return null;
        }

        for (const component of validated.components) {
            for (const target of component.allocations) {
                if (target.type === "LOCALITY") {
                    const [ward] = await transaction.select({ code: wards.code })
                        .from(wards)
                        .where(and(eq(wards.code, target.wardCode), eq(wards.provinceCode, target.provinceCode)))
                        .limit(1);
                    if (!ward) return null;
                } else {
                    const [organization] = await transaction.select({ uuid: organizations.uuid })
                        .from(organizations)
                        .where(and(eq(organizations.uuid, target.organizationId), eq(organizations.workspaceId, workspaceId)))
                        .limit(1);
                    if (!organization) return null;
                }
            }
        }

        const { components, ...header } = validated;
        const [order] = await transaction.insert(socialAssistanceDistributionOrders)
            .values({ ...header, workspaceId, status: "DRAFT", createdBy: actorId, updatedBy: actorId })
            .returning();
        if (!order) throw new Error("Could not insert distribution order");

        for (const component of components) {
            const { allocations, ...componentValues } = component;
            const [createdComponent] = await transaction.insert(socialAssistanceDistributionComponents)
                .values({ ...componentValues, workspaceId, orderId: order.id })
                .returning();
            if (!createdComponent) throw new Error("Could not insert distribution component");
            await transaction.insert(socialAssistanceDistributionTargets).values(allocations.map((target) => ({
                workspaceId,
                orderId: order.id,
                componentId: createdComponent.id,
                type: target.type,
                allocatedQuantity: target.allocatedQuantity,
                provinceCode: target.type === "LOCALITY" ? target.provinceCode : null,
                wardCode: target.type === "LOCALITY" ? target.wardCode : null,
                organizationId: target.type === "ORGANIZATION" ? target.organizationId : null
            })));
        }
        return order;
    });
};

export const updateDraftDistributionOrder = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    orderId: string,
    input: DistributionOrderCreateInput
): Promise<DistributionOrderWithComponents | null> => {
    const validated = distributionOrderCreateSchema.safeParse(input);
    if (!validated.success || validated.data.legacyBatchId || validated.data.supersedesOrderId) return null;
    for (const component of validated.data.components) {
        for (const target of component.allocations) {
            if (scope.isSuperAdmin) continue;
            if (target.type === "LOCALITY" && !isLocationWithinScope(scope, target)) return null;
            if (target.type === "ORGANIZATION" && !scope.organizationIds.includes(target.organizationId)) return null;
        }
    }

    return db.transaction(async (transaction) => {
        const [current] = await transaction.select().from(socialAssistanceDistributionOrders)
            .where(and(
                eq(socialAssistanceDistributionOrders.id, orderId),
                eq(socialAssistanceDistributionOrders.workspaceId, workspaceId),
                eq(socialAssistanceDistributionOrders.status, "DRAFT")
            ))
            .limit(1)
            .for("update");
        if (!current) return null;

        if (validated.data.programId) {
            const [program] = await transaction.select({ id: socialAssistancePrograms.id })
                .from(socialAssistancePrograms)
                .where(and(eq(socialAssistancePrograms.id, validated.data.programId), eq(socialAssistancePrograms.workspaceId, workspaceId)))
                .limit(1);
            if (!program) return null;
        }

        for (const component of validated.data.components) {
            for (const target of component.allocations) {
                if (target.type === "LOCALITY") {
                    const [ward] = await transaction.select({ code: wards.code })
                        .from(wards)
                        .where(and(eq(wards.code, target.wardCode), eq(wards.provinceCode, target.provinceCode)))
                        .limit(1);
                    if (!ward) return null;
                } else {
                    const [organization] = await transaction.select({ uuid: organizations.uuid })
                        .from(organizations)
                        .where(and(eq(organizations.uuid, target.organizationId), eq(organizations.workspaceId, workspaceId)))
                        .limit(1);
                    if (!organization) return null;
                }
            }
        }

        const { components, ...header } = validated.data;
        const [updated] = await transaction.update(socialAssistanceDistributionOrders)
            .set({ ...header, updatedBy: actorId, updatedAt: new Date() })
            .where(and(
                eq(socialAssistanceDistributionOrders.id, orderId),
                eq(socialAssistanceDistributionOrders.workspaceId, workspaceId),
                eq(socialAssistanceDistributionOrders.status, "DRAFT")
            ))
            .returning();
        if (!updated) return null;

        await transaction.delete(socialAssistanceDistributionTargets)
            .where(and(
                eq(socialAssistanceDistributionTargets.orderId, orderId),
                eq(socialAssistanceDistributionTargets.workspaceId, workspaceId)
            ));
        await transaction.delete(socialAssistanceDistributionComponents)
            .where(and(
                eq(socialAssistanceDistributionComponents.orderId, orderId),
                eq(socialAssistanceDistributionComponents.workspaceId, workspaceId)
            ));

        const visibleComponents: Array<DistributionComponent & { targets: DistributionTarget[] }> = [];
        for (const component of components) {
            const { allocations, ...componentValues } = component;
            const [createdComponent] = await transaction.insert(socialAssistanceDistributionComponents)
                .values({ ...componentValues, workspaceId, orderId })
                .returning();
            if (!createdComponent) throw new Error("Could not replace distribution component");
            const createdTargets = allocations.map((target) => ({
                workspaceId,
                orderId,
                componentId: createdComponent.id,
                type: target.type,
                allocatedQuantity: target.allocatedQuantity,
                provinceCode: target.type === "LOCALITY" ? target.provinceCode : null,
                wardCode: target.type === "LOCALITY" ? target.wardCode : null,
                organizationId: target.type === "ORGANIZATION" ? target.organizationId : null
            }));
            const insertedTargets = await transaction.insert(socialAssistanceDistributionTargets)
                .values(createdTargets)
                .returning();
            visibleComponents.push({ ...createdComponent, targets: insertedTargets });
        }
        return { ...updated, components: visibleComponents };
    });
};

export const publishDistributionOrder = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    orderId: string
): Promise<DistributionOrderWithComponents | null> => db.transaction(async (transaction) => {
    const [order] = await transaction.select().from(socialAssistanceDistributionOrders)
        .where(and(
            eq(socialAssistanceDistributionOrders.id, orderId),
            eq(socialAssistanceDistributionOrders.workspaceId, workspaceId),
            eq(socialAssistanceDistributionOrders.status, "DRAFT")
        ))
        .limit(1)
        .for("update");
    if (!order) return null;

    const item = await getDistributionOrder(workspaceId, scope, orderId);
    if (!item || item.components.length === 0) return null;
    const publishedAt = new Date();
    const [published] = await transaction.update(socialAssistanceDistributionOrders)
        .set({ status: "PUBLISHED", publishedBy: actorId, publishedAt, updatedBy: actorId, updatedAt: publishedAt })
        .where(and(
            eq(socialAssistanceDistributionOrders.id, orderId),
            eq(socialAssistanceDistributionOrders.workspaceId, workspaceId),
            eq(socialAssistanceDistributionOrders.status, "DRAFT")
        ))
        .returning();
    return published ? { ...published, components: item.components } : null;
});

export const closeDistributionOrder = async (
    workspaceId: string,
    actorId: string,
    scope: PovertyAccessScope,
    orderId: string
): Promise<DistributionOrderWithComponents | null> => db.transaction(async (transaction) => {
    const [order] = await transaction.select().from(socialAssistanceDistributionOrders)
        .where(and(
            eq(socialAssistanceDistributionOrders.id, orderId),
            eq(socialAssistanceDistributionOrders.workspaceId, workspaceId),
            eq(socialAssistanceDistributionOrders.status, "PUBLISHED"),
            isNotNull(socialAssistanceDistributionOrders.publishedAt)
        ))
        .limit(1)
        .for("update");
    if (!order) return null;

    const item = await getDistributionOrder(workspaceId, scope, orderId);
    if (!item) return null;
    const closedAt = new Date();
    const [closed] = await transaction.update(socialAssistanceDistributionOrders)
        .set({ status: "CLOSED", closedBy: actorId, closedAt, updatedBy: actorId, updatedAt: closedAt })
        .where(and(
            eq(socialAssistanceDistributionOrders.id, orderId),
            eq(socialAssistanceDistributionOrders.workspaceId, workspaceId),
            eq(socialAssistanceDistributionOrders.status, "PUBLISHED")
        ))
        .returning();
    return closed ? { ...closed, components: item.components } : null;
});