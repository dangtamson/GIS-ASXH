import { z } from "zod";

export const POVERTY_TYPES = ["POOR", "NEAR_POOR", "NONE"] as const;
export const HOUSEHOLD_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const HOUSEHOLD_SUPPORT_TYPES = ["HOUSING", "CASH", "HEALTHCARE", "EDUCATION", "FOOD", "OTHER"] as const;

export type PovertyType = (typeof POVERTY_TYPES)[number];
export type HouseholdStatus = (typeof HOUSEHOLD_STATUSES)[number];
export type HouseholdSupportType = (typeof HOUSEHOLD_SUPPORT_TYPES)[number];

const optionalText = z.preprocess(
  (value) => (value === null ? undefined : value),
  z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional()
);

const optionalDateText = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .optional();

export const listHouseholdsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().trim().optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  povertyType: z.enum(POVERTY_TYPES).optional(),
  status: z.enum(HOUSEHOLD_STATUSES).optional(),
  provinceCode: z.string().trim().optional(),
  wardCode: z.string().trim().optional(),
  areaId: z.uuid().optional(),
  provinceName: z.string().trim().optional(),
  wardName: z.string().trim().optional(),
  areaName: z.string().trim().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "code", "year", "povertyType"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export const householdIdParamSchema = z.object({
  id: z.uuid()
});

export const memberIdParamSchema = z.object({
  id: z.uuid(),
  memberId: z.uuid()
});

export const assessmentIdParamSchema = z.object({
  id: z.uuid(),
  assessmentId: z.uuid()
});

export const supportIdParamSchema = z.object({
  id: z.uuid(),
  supportId: z.uuid()
});

export const areaIdParamSchema = z.object({
  wardCode: z.string().trim().min(1),
  areaId: z.uuid()
});

export const contextHistoryIdParamSchema = z.object({
  id: z.uuid(),
  contextHistoryId: z.uuid()
});

export const povertyWardOverviewIdParamSchema = z.object({
  id: z.uuid()
});

export const locationProvinceQuerySchema = z.object({
  provinceCode: z.string().trim().min(1).optional()
});

export const locationWardQuerySchema = z.object({
  provinceCode: z.string().trim().min(1)
});

export const locationAreaQuerySchema = z.object({
  wardCode: z.string().trim().min(1)
});

export const householdCreateSchema = z.object({
  code: optionalText,
  year: z.coerce.number().int().min(1900).max(2200),
  povertyType: z.enum(POVERTY_TYPES),
  status: z.enum(HOUSEHOLD_STATUSES).optional().default("ACTIVE"),
  provinceCode: z.string().trim().min(1),
  wardCode: z.string().trim().min(1),
  areaId: z.uuid(),
  provinceName: optionalText,
  wardName: optionalText,
  areaName: optionalText,
  address: optionalText,
  headFullName: optionalText,
  headCitizenId: optionalText,
  memberCount: z.coerce.number().int().min(0).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  changeNote: optionalText
});

export const householdUpdateSchema = householdCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const householdMemberCreateSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  relationship: optionalText,
  gender: optionalText,
  dateOfBirth: optionalDateText,
  ethnicity: optionalText,
  citizenId: optionalText,
  phone: optionalText,
  isHead: z.coerce.boolean().optional().default(false),
  occupation: optionalText,
  note: optionalText,
  changeNote: optionalText
});

export const householdMemberUpdateSchema = householdMemberCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const householdAssessmentCreateSchema = z.object({
  assessmentYear: z.coerce.number().int().min(1900).max(2200),
  povertyType: z.enum(POVERTY_TYPES),
  scoreB1: z.coerce.number().optional(),
  scoreB2: z.coerce.number().optional(),
  decisionNo: optionalText,
  decisionDate: optionalDateText,
  approvedBy: optionalText,
  note: optionalText,
  changeNote: optionalText
});

export const householdAssessmentUpdateSchema = householdAssessmentCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const householdSupportCreateSchema = z.object({
  supportDate: optionalDateText,
  supportTypes: z.array(z.enum(HOUSEHOLD_SUPPORT_TYPES)).min(1),
  amounts: z.record(z.string(), z.coerce.number().min(0)).optional().default({}),
  content: optionalText,
  supportingUnit: optionalText,
  note: optionalText,
  changeNote: optionalText
}).refine((value) => Boolean(value.supportDate), { message: "supportDate is required", path: ["supportDate"] });

export const householdSupportUpdateSchema = householdSupportCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const householdContextHistoryCreateSchema = z.object({
  recordedAt: optionalDateText,
  familySituation: optionalText,
  currentStatus: optionalText,
  note: optionalText,
  changeNote: optionalText
})
  .refine((value) => Boolean(value.recordedAt), { message: "recordedAt is required", path: ["recordedAt"] })
  .refine((value) => Boolean(value.familySituation || value.currentStatus), {
    message: "At least one of familySituation or currentStatus is required",
    path: ["familySituation"]
  });

export const householdContextHistoryUpdateSchema = householdContextHistoryCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" })
  .refine((value) => {
    if ("familySituation" in value || "currentStatus" in value) {
      return Boolean(value.familySituation || value.currentStatus);
    }
    return true;
  }, {
    message: "At least one of familySituation or currentStatus is required",
    path: ["familySituation"]
  });

export const importHouseholdsSchema = z.object({
  fileName: z.string().trim().min(1).optional(),
  fileContentBase64: z.string().trim().min(1)
});

export const reportQuerySchema = listHouseholdsQuerySchema.omit({ page: true, limit: true, sortBy: true, sortOrder: true });
export const reportDetailQuerySchema = reportQuerySchema.extend({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20)
});

export const povertyWardOverviewQuerySchema = z.object({
  provinceCode: z.string().trim().min(1),
  wardCode: z.string().trim().min(1)
});

export const povertyWardPublicLinkQuerySchema = z.object({
  provinceCode: z.string().trim().min(1),
  wardCode: z.string().trim().min(1)
});

export const povertyWardPublicLinkUpsertSchema = z.object({
  provinceCode: z.string().trim().min(1),
  wardCode: z.string().trim().min(1),
  isPublic: z.coerce.boolean()
});

export const povertyWardOverviewUpsertSchema = z.object({
  provinceCode: z.string().trim().min(1),
  wardCode: z.string().trim().min(1),
  year: z.coerce.number().int().min(1900).max(2200),
  population: z.coerce.number().int().min(0).default(0),
  totalHouseholds: z.coerce.number().int().min(0).default(0),
  totalMembers: z.coerce.number().int().min(0).default(0),
  naturalArea: z.coerce.number().min(0),
  note: optionalText
});

export const areaCreateSchema = z.object({
  provinceCode: z.string().trim().min(1),
  wardCode: z.string().trim().min(1),
  code: optionalText,
  name: z.string().trim().min(1).max(255),
  secretaryName: optionalText,
  secretaryPhone: optionalText,
  hamletHeadName: optionalText,
  hamletHeadPhone: optionalText,
  securityTeamLeaderName: optionalText,
  securityTeamLeaderPhone: optionalText,
  naturalArea: z.coerce.number().min(0).optional(),
  description: optionalText,
  note: optionalText,
  status: z.coerce.boolean().optional().default(true)
});

export const areaUpdateSchema = areaCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export type HouseholdCreateInput = z.infer<typeof householdCreateSchema>;
export type HouseholdUpdateInput = z.infer<typeof householdUpdateSchema>;
export type HouseholdMemberCreateInput = z.infer<typeof householdMemberCreateSchema>;
export type HouseholdAssessmentCreateInput = z.infer<typeof householdAssessmentCreateSchema>;
export type HouseholdSupportCreateInput = z.infer<typeof householdSupportCreateSchema>;
export type HouseholdContextHistoryCreateInput = z.infer<typeof householdContextHistoryCreateSchema>;
export type PovertyWardOverviewUpsertInput = z.infer<typeof povertyWardOverviewUpsertSchema>;
export type PovertyWardPublicLinkUpsertInput = z.infer<typeof povertyWardPublicLinkUpsertSchema>;
export type AreaCreateInput = z.infer<typeof areaCreateSchema>;

export type ImportedHouseholdInput = {
  code: string;
  year: number;
  povertyType: PovertyType;
  status?: HouseholdStatus;
  provinceCode?: string;
  wardCode?: string;
  areaId?: string;
  provinceName?: string;
  wardName?: string;
  areaName?: string;
  address?: string;
  headFullName?: string;
  headCitizenId?: string;
  memberCount?: number;
  latitude?: number;
  longitude?: number;
};

const normalizeToken = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const normalizePovertyType = (value: unknown): PovertyType | null => {
  const normalized = normalizeToken(String(value ?? ""));
  if (!normalized) return null;
  if (["poor", "ho ngheo", "ngheo"].includes(normalized)) return "POOR";
  if (["near poor", "ho can ngheo", "can ngheo"].includes(normalized)) return "NEAR_POOR";
  if (["none", "khong ngheo", "khong con ngheo", "thoat ngheo", "khong thuoc dien ngheo", "khong con ngheo can ngheo"].includes(normalized)) return "NONE";
  if (String(value).trim().toUpperCase() === "POOR") return "POOR";
  if (String(value).trim().toUpperCase() === "NEAR_POOR") return "NEAR_POOR";
  if (String(value).trim().toUpperCase() === "NONE") return "NONE";
  return null;
};

export const normalizeHouseholdStatus = (value: unknown): HouseholdStatus | undefined => {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const normalized = normalizeToken(raw);
  if (["active", "hoat dong", "dang hoat dong"].includes(normalized)) return "ACTIVE";
  if (["inactive", "ngung", "ngung hoat dong"].includes(normalized)) return "INACTIVE";
  if (raw.toUpperCase() === "ACTIVE") return "ACTIVE";
  if (raw.toUpperCase() === "INACTIVE") return "INACTIVE";
  return undefined;
};
