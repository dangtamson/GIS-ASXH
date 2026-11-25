import { z } from "zod";

export const DISTRIBUTION_BATCH_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;

export const distributionBatchStatusSchema = z.enum(DISTRIBUTION_BATCH_STATUSES);

const distributionBatchLineSchema = z.object({
    provinceCode: z.string().trim().min(1).max(20),
    wardCode: z.string().trim().min(1).max(20),
    allocatedQuantity: z.coerce.number().int().positive().max(1_000_000)
}).strict();

export const distributionBatchCreateSchema = z.object({
    programId: z.uuid().nullable().optional(),
    supersedesBatchId: z.uuid().nullable().optional(),
    documentNumber: z.string().trim().min(1).max(100),
    documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().trim().min(1).max(255),
    fundingSourceText: z.string().trim().min(1).max(2000),
    supportItemName: z.string().trim().min(1).max(255),
    unitLabel: z.string().trim().min(1).max(40),
    unitAmount: z.coerce.number().int().positive().max(999_999_999_999),
    declaredTotalQuantity: z.coerce.number().int().positive().max(1_000_000_000),
    declaredTotalAmount: z.coerce.number().int().positive().max(999_999_999_999),
    eligibilitySummary: z.string().trim().min(1).max(4000),
    eligibilityApprovalYear: z.coerce.number().int().min(1900).max(2200).nullable().optional(),
    submissionDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    completionDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    lines: z.array(distributionBatchLineSchema).min(1).max(1000)
}).strict().superRefine((value, context) => {
    const seen = new Set<string>();
    let totalQuantity = 0;

    for (const [index, line] of value.lines.entries()) {
        const key = `${line.provinceCode}:${line.wardCode}`;
        if (seen.has(key)) {
            context.addIssue({
                code: "custom",
                path: ["lines", index, "wardCode"],
                message: "A locality may appear only once in a distribution batch"
            });
        }
        seen.add(key);
        totalQuantity += line.allocatedQuantity;
    }

    if (totalQuantity !== value.declaredTotalQuantity) {
        context.addIssue({
            code: "custom",
            path: ["lines"],
            message: "Locality quantities must equal the declared total quantity"
        });
    }

    const calculatedAmount = BigInt(totalQuantity) * BigInt(value.unitAmount);
    if (calculatedAmount !== BigInt(value.declaredTotalAmount)) {
        context.addIssue({
            code: "custom",
            path: ["declaredTotalAmount"],
            message: "Declared total amount must equal quantity multiplied by unit amount"
        });
    }

    if (value.submissionDeadline && value.completionDeadline && value.completionDeadline < value.submissionDeadline) {
        context.addIssue({
            code: "custom",
            path: ["completionDeadline"],
            message: "Completion deadline cannot be earlier than the submission deadline"
        });
    }
});

export const distributionBatchIdParamSchema = z.object({ id: z.uuid() });
export const distributionBatchSupersedeParamSchema = z.object({ id: z.uuid() });
export const distributionBatchListQuerySchema = z.object({
    status: distributionBatchStatusSchema.optional(),
    programId: z.uuid().optional(),
    documentNumber: z.string().trim().min(1).max(100).optional()
}).strict();
export const publicDistributionBatchListQuerySchema = z.object({
    provinceCode: z.string().trim().min(1).max(20).optional(),
    wardCode: z.string().trim().min(1).max(20).optional()
}).strict();
export type DistributionBatchCreateInput = z.infer<typeof distributionBatchCreateSchema>;
export type DistributionBatchLineInput = z.infer<typeof distributionBatchLineSchema>;
export type DistributionBatchStatus = z.infer<typeof distributionBatchStatusSchema>;
export type DistributionBatchListQuery = z.infer<typeof distributionBatchListQuerySchema>;
export type PublicDistributionBatchListQuery = z.infer<typeof publicDistributionBatchListQuerySchema>;

const DISTRIBUTION_BATCH_TRANSITIONS: Record<DistributionBatchStatus, readonly DistributionBatchStatus[]> = {
    DRAFT: ["PUBLISHED"],
    PUBLISHED: ["CLOSED"],
    CLOSED: []
};

export const canTransitionDistributionBatch = (current: string, next: string): boolean =>
    DISTRIBUTION_BATCH_TRANSITIONS[current as DistributionBatchStatus]?.includes(next as DistributionBatchStatus) ?? false;