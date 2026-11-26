import { z } from "zod";

export const calculateDistributionComponentAmount = (component: {
    unitAmount: number;
    periodCount: number;
    declaredTotalQuantity: number;
}): number => component.unitAmount * component.periodCount * component.declaredTotalQuantity;

const allocationSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("LOCALITY"),
        provinceCode: z.string().trim().min(1).max(20),
        wardCode: z.string().trim().min(1).max(20),
        allocatedQuantity: z.number().int().positive().max(1_000_000)
    }).strict(),
    z.object({
        type: z.literal("ORGANIZATION"),
        organizationId: z.uuid(),
        allocatedQuantity: z.number().int().positive().max(1_000_000)
    }).strict()
]);

const componentSchema = z.object({
    name: z.string().trim().min(1).max(255),
    unitLabel: z.string().trim().min(1).max(40),
    unitAmount: z.number().int().positive().max(999_999_999_999),
    period: z.enum(["ONCE", "MONTHLY"]),
    periodCount: z.number().int().positive().max(120),
    periodStart: z.iso.date().nullable().optional(),
    periodEnd: z.iso.date().nullable().optional(),
    declaredTotalQuantity: z.number().int().positive().max(1_000_000_000),
    declaredTotalAmount: z.number().int().positive().max(999_999_999_999).nullable(),
    eligibilitySummary: z.string().trim().min(1).max(4000),
    allocations: z.array(allocationSchema).min(1).max(1000)
}).strict().superRefine((component, context) => {
    const seen = new Set<string>();
    let totalQuantity = 0;
    for (const [index, allocation] of component.allocations.entries()) {
        const key = allocation.type === "LOCALITY"
            ? `locality:${allocation.provinceCode}:${allocation.wardCode}`
            : `organization:${allocation.organizationId}`;
        if (seen.has(key)) {
            context.addIssue({ code: "custom", path: ["allocations", index], message: "Duplicate allocation target" });
        }
        seen.add(key);
        totalQuantity += allocation.allocatedQuantity;
    }
    if (totalQuantity !== component.declaredTotalQuantity) {
        context.addIssue({ code: "custom", path: ["allocations"], message: "Allocations must equal declared quantity" });
    }
    if (component.period === "ONCE" && component.periodCount !== 1) {
        context.addIssue({ code: "custom", path: ["periodCount"], message: "One-time support has one period" });
    }
    if (component.periodStart && component.periodEnd && component.periodEnd < component.periodStart) {
        context.addIssue({ code: "custom", path: ["periodEnd"], message: "Support period cannot end before it starts" });
    }
    const calculatedAmount = BigInt(totalQuantity) * BigInt(component.unitAmount) * BigInt(component.periodCount);
    if (calculatedAmount > 999_999_999_999n) {
        context.addIssue({ code: "custom", path: ["unitAmount"], message: "Calculated amount exceeds supported range" });
    }
    if (component.declaredTotalAmount !== null && calculatedAmount !== BigInt(component.declaredTotalAmount)) {
        context.addIssue({ code: "custom", path: ["declaredTotalAmount"], message: "Declared amount must match calculated amount" });
    }
});

export const distributionOrderCreateSchema = z.object({
    programId: z.uuid().nullable().optional(),
    legacyBatchId: z.uuid().nullable().optional(),
    supersedesOrderId: z.uuid().nullable().optional(),
    documentNumber: z.string().trim().min(1).max(100),
    documentDate: z.iso.date(),
    title: z.string().trim().min(1).max(255),
    fundingSourceText: z.string().trim().min(1).max(2000),
    submissionDeadline: z.iso.date().nullable().optional(),
    submissionDeadlineExclusive: z.boolean().optional(),
    completionDeadline: z.iso.date().nullable().optional(),
    completionDeadlineExclusive: z.boolean().optional(),
    components: z.array(componentSchema).min(1).max(100)
}).strict().superRefine((order, context) => {
    if (order.submissionDeadlineExclusive && !order.submissionDeadline) {
        context.addIssue({ code: "custom", path: ["submissionDeadline"], message: "An exclusive deadline requires a date" });
    }
    if (order.completionDeadlineExclusive && !order.completionDeadline) {
        context.addIssue({ code: "custom", path: ["completionDeadline"], message: "An exclusive deadline requires a date" });
    }
    if (order.submissionDeadline && order.completionDeadline && order.completionDeadline < order.submissionDeadline) {
        context.addIssue({ code: "custom", path: ["completionDeadline"], message: "Completion deadline cannot precede submission deadline" });
    }
});

export const distributionBeneficiaryCreateSchema = z.object({
    componentId: z.uuid(),
    targetId: z.uuid(),
    fullName: z.string().trim().min(1).max(255),
    birthYear: z.number().int().min(1900).max(2200).optional(),
    householdId: z.uuid().optional(),
    localityDetails: z.string().trim().max(1000).optional(),
    eligibilityDetails: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional(),
    status: z.enum(["PROPOSED", "APPROVED", "REJECTED"]).default("PROPOSED")
}).strict();

export type DistributionOrderCreateInput = z.infer<typeof distributionOrderCreateSchema>;
export type DistributionBeneficiaryCreateInput = z.infer<typeof distributionBeneficiaryCreateSchema>;