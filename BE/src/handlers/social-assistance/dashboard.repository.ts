import { and, eq, gte, inArray, lt, or, type SQL } from "drizzle-orm";
import type { PovertyAccessScope } from "@/handlers/admin/resources/poverty/poverty.scope.ts";
import { socialAssistanceAllocations, socialAssistancePledges, socialAssistancePrograms, socialAssistanceRequests } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import type { SocialAssistanceDashboardFilters } from "./dashboard.schemas.ts";

type DashboardRequestRow = {
    id: string;
    status: string;
    provinceCode: string;
    wardCode: string;
    areaId: string | null;
    phone: string;
};

type DashboardPledgeRow = {
    programId: string;
    pledgeType: string;
    pledgedAmount: number | null;
    receivedAmount: number | null;
    status: string;
};

type DashboardAllocationRow = {
    requestId: string;
    programId: string;
    plannedCashAmount: number | null;
    deliveredCashAmount: number | null;
    status: string;
};

const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    return digits.startsWith("84") && digits.length >= 10 ? `0${digits.slice(2)}` : digits;
};

const addAmount = (current: number, amount: number | null): number => current + (amount ?? 0);

export const aggregateSocialAssistanceDashboard = (
    requests: DashboardRequestRow[],
    pledges: DashboardPledgeRow[],
    allocations: DashboardAllocationRow[]
) => {
    const allocationsByRequest = new Map<string, DashboardAllocationRow[]>();
    for (const allocation of allocations) {
        const rows = allocationsByRequest.get(allocation.requestId) ?? [];
        rows.push(allocation);
        allocationsByRequest.set(allocation.requestId, rows);
    }

    const duplicateGroups = new Map<string, string[]>();
    for (const request of requests) {
        if (request.status === "REJECTED") continue;
        const phone = normalizePhone(request.phone);
        if (phone.length < 8) continue;
        const key = `${request.provinceCode}:${request.wardCode}:${phone}`;
        const ids = duplicateGroups.get(key) ?? [];
        ids.push(request.id);
        duplicateGroups.set(key, ids);
    }
    const duplicateReviewIds = new Set(
        [...duplicateGroups.values()].filter((ids) => ids.length > 1).flat()
    );

    const summary = {
        requestsReceived: requests.length,
        requestsVerified: requests.filter((request) => request.status === "VERIFIED").length,
        awaitingAllocation: requests.filter(
            (request) => request.status === "VERIFIED" && !allocationsByRequest.has(request.id)
        ).length,
        allocatedCases: allocationsByRequest.size,
        completedCases: [...allocationsByRequest.values()].filter((requestAllocations) =>
            requestAllocations.every((allocation) => allocation.status === "DELIVERED" || allocation.status === "RECONCILED")
        ).length,
        openReviewBacklog: requests.filter(
            (request) => request.status === "RECEIVED" || request.status === "IN_REVIEW" || request.status === "NEEDS_INFORMATION"
        ).length,
        duplicateReviewCount: duplicateReviewIds.size,
        pledgeCount: pledges.length,
        inKindPledgeCount: pledges.filter((pledge) => pledge.pledgeType === "IN_KIND").length,
        pledgedCashAmount: pledges.reduce(
            (total, pledge) => pledge.pledgeType === "CASH" ? addAmount(total, pledge.pledgedAmount) : total,
            0
        ),
        receivedCashAmount: pledges.reduce(
            (total, pledge) => pledge.pledgeType === "CASH" && (pledge.status === "RECEIVED" || pledge.status === "RECONCILED")
                ? addAmount(total, pledge.receivedAmount)
                : total,
            0
        ),
        allocatedCashAmount: allocations.reduce((total, allocation) => addAmount(total, allocation.plannedCashAmount), 0),
        deliveredCashAmount: allocations.reduce((total, allocation) => addAmount(total, allocation.deliveredCashAmount), 0)
    };

    const programs = new Map<string, {
        programId: string;
        pledgeCount: number;
        pledgedCashAmount: number;
        receivedCashAmount: number;
        allocatedCashAmount: number;
        deliveredCashAmount: number;
    }>();
    const getProgram = (programId: string) => {
        let program = programs.get(programId);
        if (!program) {
            program = {
                programId,
                pledgeCount: 0,
                pledgedCashAmount: 0,
                receivedCashAmount: 0,
                allocatedCashAmount: 0,
                deliveredCashAmount: 0
            };
            programs.set(programId, program);
        }
        return program;
    };

    for (const pledge of pledges) {
        const program = getProgram(pledge.programId);
        program.pledgeCount += 1;
        if (pledge.pledgeType === "CASH") {
            program.pledgedCashAmount = addAmount(program.pledgedCashAmount, pledge.pledgedAmount);
            if (pledge.status === "RECEIVED" || pledge.status === "RECONCILED") {
                program.receivedCashAmount = addAmount(program.receivedCashAmount, pledge.receivedAmount);
            }
        }
    }
    for (const allocation of allocations) {
        const program = getProgram(allocation.programId);
        program.allocatedCashAmount = addAmount(program.allocatedCashAmount, allocation.plannedCashAmount);
        program.deliveredCashAmount = addAmount(program.deliveredCashAmount, allocation.deliveredCashAmount);
    }

    const geography = new Map<string, {
        provinceCode: string;
        wardCode: string;
        requestsReceived: number;
        requestsVerified: number;
        allocatedCashAmount: number;
        deliveredCashAmount: number;
    }>();
    const requestGeography = new Map<string, string>();
    const getGeography = (provinceCode: string, wardCode: string) => {
        const key = `${provinceCode}:${wardCode}`;
        let ward = geography.get(key);
        if (!ward) {
            ward = { provinceCode, wardCode, requestsReceived: 0, requestsVerified: 0, allocatedCashAmount: 0, deliveredCashAmount: 0 };
            geography.set(key, ward);
        }
        return { key, ward };
    };
    for (const request of requests) {
        const { key, ward } = getGeography(request.provinceCode, request.wardCode);
        requestGeography.set(request.id, key);
        ward.requestsReceived += 1;
        if (request.status === "VERIFIED") ward.requestsVerified += 1;
    }
    for (const allocation of allocations) {
        const key = requestGeography.get(allocation.requestId);
        const ward = key ? geography.get(key) : undefined;
        if (!ward) continue;
        ward.allocatedCashAmount = addAmount(ward.allocatedCashAmount, allocation.plannedCashAmount);
        ward.deliveredCashAmount = addAmount(ward.deliveredCashAmount, allocation.deliveredCashAmount);
    }

    return {
        summary,
        byProgram: [...programs.values()].sort((left, right) => left.programId.localeCompare(right.programId)),
        byGeography: [...geography.values()].sort(
            (left, right) => left.provinceCode.localeCompare(right.provinceCode) || left.wardCode.localeCompare(right.wardCode)
        )
    };
};

const nextDay = (date: string): Date => {
    const result = new Date(`${date}T00:00:00.000Z`);
    result.setUTCDate(result.getUTCDate() + 1);
    return result;
};

export const getSocialAssistanceDashboard = async (
    workspaceId: string,
    scope: PovertyAccessScope,
    filters: SocialAssistanceDashboardFilters
) => {
    if (!scope.isSuperAdmin && !scope.hasScope) return aggregateSocialAssistanceDashboard([], [], []);

    const requestConditions: SQL[] = [eq(socialAssistanceRequests.workspaceId, workspaceId)];
    if (!scope.isSuperAdmin) {
        const locationConditions: SQL[] = [];
        if (scope.areaIds.length > 0) locationConditions.push(inArray(socialAssistanceRequests.areaId, scope.areaIds));
        if (scope.wardCodes.length > 0) locationConditions.push(inArray(socialAssistanceRequests.wardCode, scope.wardCodes));
        if (scope.provinceCodes.length > 0) {
            locationConditions.push(inArray(socialAssistanceRequests.provinceCode, scope.provinceCodes));
        }
        if (locationConditions.length === 0) return aggregateSocialAssistanceDashboard([], [], []);
        requestConditions.push(or(...locationConditions)!);
    }
    if (filters.from) requestConditions.push(gte(socialAssistanceRequests.createdAt, new Date(`${filters.from}T00:00:00.000Z`)));
    if (filters.to) requestConditions.push(lt(socialAssistanceRequests.createdAt, nextDay(filters.to)));
    if (filters.provinceCode) requestConditions.push(eq(socialAssistanceRequests.provinceCode, filters.provinceCode));
    if (filters.wardCode) requestConditions.push(eq(socialAssistanceRequests.wardCode, filters.wardCode));
    if (filters.areaId) requestConditions.push(eq(socialAssistanceRequests.areaId, filters.areaId));
    if (filters.requestStatus) requestConditions.push(eq(socialAssistanceRequests.status, filters.requestStatus));

    const requests = await db
        .select({
            id: socialAssistanceRequests.id,
            status: socialAssistanceRequests.status,
            provinceCode: socialAssistanceRequests.provinceCode,
            wardCode: socialAssistanceRequests.wardCode,
            areaId: socialAssistanceRequests.areaId,
            phone: socialAssistanceRequests.phone
        })
        .from(socialAssistanceRequests)
        .where(and(...requestConditions));

    const pledgeConditions: SQL[] = [eq(socialAssistancePledges.workspaceId, workspaceId)];
    if (filters.from) pledgeConditions.push(gte(socialAssistancePledges.createdAt, new Date(`${filters.from}T00:00:00.000Z`)));
    if (filters.to) pledgeConditions.push(lt(socialAssistancePledges.createdAt, nextDay(filters.to)));
    if (filters.programId) pledgeConditions.push(eq(socialAssistancePledges.programId, filters.programId));
    const pledges = await db
        .select({
            programId: socialAssistancePledges.programId,
            pledgeType: socialAssistancePledges.pledgeType,
            pledgedAmount: socialAssistancePledges.pledgedAmount,
            receivedAmount: socialAssistancePledges.receivedAmount,
            status: socialAssistancePledges.status
        })
        .from(socialAssistancePledges)
        .where(and(...pledgeConditions));

    let allocations: DashboardAllocationRow[] = [];
    if (requests.length > 0) {
        const allocationConditions: SQL[] = [
            eq(socialAssistanceAllocations.workspaceId, workspaceId),
            inArray(socialAssistanceAllocations.requestId, requests.map((request) => request.id))
        ];
        if (filters.from) {
            allocationConditions.push(gte(socialAssistanceAllocations.createdAt, new Date(`${filters.from}T00:00:00.000Z`)));
        }
        if (filters.to) allocationConditions.push(lt(socialAssistanceAllocations.createdAt, nextDay(filters.to)));
        if (filters.programId) allocationConditions.push(eq(socialAssistanceAllocations.programId, filters.programId));
        allocations = await db
            .select({
                requestId: socialAssistanceAllocations.requestId,
                programId: socialAssistanceAllocations.programId,
                plannedCashAmount: socialAssistanceAllocations.plannedCashAmount,
                deliveredCashAmount: socialAssistanceAllocations.deliveredCashAmount,
                status: socialAssistanceAllocations.status
            })
            .from(socialAssistanceAllocations)
            .where(and(...allocationConditions));
    }

    const programConditions: SQL[] = [eq(socialAssistancePrograms.workspaceId, workspaceId)];
    if (filters.programId) programConditions.push(eq(socialAssistancePrograms.id, filters.programId));
    const programOptions = await db
        .select({ id: socialAssistancePrograms.id, title: socialAssistancePrograms.title })
        .from(socialAssistancePrograms)
        .where(and(...programConditions));

    return {
        ...aggregateSocialAssistanceDashboard(requests, pledges, allocations),
        programOptions
    };
};