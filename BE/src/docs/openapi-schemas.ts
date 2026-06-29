import {
  accountInsertSchema,
  accountSelectSchema,
  auditLogSelectSchema,
  profileInsertSchema,
  profileSelectSchema,
  workspaceInsertSchema,
  workspaceMembershipSelectSchema,
  workspaceSelectSchema
} from "@/schema.ts";
import { accountEmailInputSchema } from "@/helpers/accountEmail.ts";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Extend Zod with OpenAPI functionality
extendZodWithOpenApi(z);

// Reuse drizzle-zod schemas as the foundation for OpenAPI schemas
// This eliminates duplication and ensures consistency with database schema
// We need to wrap them with z.object() to get the .openapi() method

export const AccountSchema = z.object(accountSelectSchema.shape).openapi("Account");

// Account creation (omit server-controlled fields)
export const AccountCreateSchema = z
  .object(accountInsertSchema.shape)
  .omit({ uuid: true, createdAt: true, isSuperAdmin: true })
  .extend({
    password: z.string().min(6).describe("Initial password for Supabase authentication")
  })
  .openapi("AccountCreate");

export const WorkspaceSchema = z.object(workspaceSelectSchema.shape).openapi("Workspace");

export const WorkspaceCreateSchema = z
  .object(workspaceInsertSchema.shape)
  .omit({ uuid: true, createdAt: true, accountId: true })
  .openapi("WorkspaceCreate");

export const ProfileSchema = z.object(profileSelectSchema.shape).openapi("Profile");

export const MembershipSchema = z.object(workspaceMembershipSelectSchema.shape).openapi("Membership");

// Custom schemas for API operations (not direct DB operations)
// Use drizzle-zod as foundation but customize for API needs
export const MemberCreateSchema = z
  .object({
    email: accountEmailInputSchema.describe("Email or account alias of existing account to add"),
    role: z
      .union([
        z.number().int().positive().describe("Role ID in the workspace"),
        z.string().trim().min(1).describe("Role code in the workspace")
      ])
      .describe("Role in the workspace"),
    organizationId: z.uuid().optional().describe("Organization unit ID in the workspace"),
    profileName: z.string().optional().describe("Profile name for the workspace"),
    isAdmin: z.boolean().optional()
  })
  .openapi("MemberCreate");

export const ProfileUpdateSchema = z.object(profileInsertSchema.shape).pick({ name: true }).openapi("ProfileUpdate");

// Response schemas - matches actual gatewayResponse helper output
export const SuccessResponseSchema = z
  .object({
    code: z.number().describe("HTTP status code"),
    message: z.string().describe("Success message"),
    data: z.unknown().describe("Response data")
  })
  .openapi("SuccessResponse");

export const ErrorResponseSchema = z
  .object({
    code: z.number().describe("HTTP status code"),
    message: z.string().describe("Error message"),
    error: z.string().describe("Error details")
  })
  .openapi("ErrorResponse");

// TODO I think we need a filter model schema... maybe align with ag-grid? or create an adapter for ag-Grid.
export const PaginationSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().min(0),
    pages: z.number().int().min(0)
  })
  .openapi("Pagination");

export const AuditLogSchema = z.object(auditLogSelectSchema.shape).openapi("AuditLog");

// Parameter schemas
export const PaginationQuerySchema = z
  .object({
    page: z.number().int().positive().default(1).openapi({ description: "Page number for pagination" }),
    limit: z.number().int().min(1).max(100).default(20).openapi({ description: "Number of items per page" })
  })
  .openapi("PaginationQuery");

export const UuidParamSchema = z
  .object({
    id: z.uuid().openapi({ description: "UUID identifier" })
  })
  .openapi("UuidParam");

export const AuditLogStatsSchema = z
  .object({
    period: z.string(),
    startDate: z.iso.datetime(),
    endDate: z.iso.datetime(),
    actionStats: z.array(
      z.object({
        action: z.string(),
        count: z.number()
      })
    ),
    entityTypeStats: z.array(
      z.object({
        entityType: z.string(),
        count: z.number()
      })
    ),
    topActors: z.array(
      z.object({
        actorId: z.uuid(),
        actorEmail: z.string(),
        count: z.number()
      })
    ),
    dailyActivity: z.array(
      z.object({
        date: z.string(),
        count: z.number()
      })
    )
  })
  .openapi("AuditLogStats");

// Common parameter schemas
export const UuidParamOnlySchema = z
  .object({
    id: z.uuid().describe("UUID identifier")
  })
  .openapi("UuidParamOnly");

export const WorkspaceHeaderSchema = z
  .object({
    "x-workspace-id": z.uuid().describe("Workspace ID for context")
  })
  .openapi("WorkspaceHeader");

export const UuidParamsWithMemberSchema = z
  .object({
    id: z.uuid().describe("Workspace ID"),
    memberId: z.uuid().describe("Member ID")
  })
  .openapi("UuidParamsWithMember");

// Authentication request schemas
export const LoginRequestSchema = z
  .object({
    email: accountEmailInputSchema.describe("User email address or account alias"),
    password: z.string().min(6).describe("User password")
  })
  .openapi("LoginRequest");

export const SignupRequestSchema = z
  .object({
    email: accountEmailInputSchema.describe("User email address or account alias"),
    password: z.string().min(6).describe("User password"),
    fullName: z.string().min(1).describe("User full name"),
    phone: z.string().optional().describe("User phone number")
  })
  .openapi("SignupRequest");

// Role update schemas
export const MemberRoleUpdateSchema = z
  .object({
    role: z
      .union([
        z.number().int().positive().describe("Role ID in the workspace"),
        z.string().trim().min(1).describe("Role code in the workspace")
      ])
      .describe("New role for the member"),
    organizationId: z.uuid().optional().describe("Organization unit ID in the workspace"),
    isAdmin: z.boolean().optional()
  })
  .openapi("MemberRoleUpdate");

export const AdminRoleUpdateSchema = z
  .object({
    isSuperAdmin: z.boolean().describe("Whether the account should be a SuperAdmin")
  })
  .openapi("AdminRoleUpdate");

export const AccountStatusUpdateSchema = z
  .object({
    status: z.enum(["active", "inactive", "suspended"]).describe("New account status")
  })
  .openapi("AccountStatusUpdate");

// Common response data schemas
export const MessageResponseDataSchema = z
  .object({
    message: z.string().describe("Response message")
  })
  .openapi("MessageResponseData");

export const AccountResponseDataSchema = z
  .object({
    account: AccountSchema
  })
  .openapi("AccountResponseData");

export const WorkspaceResponseDataSchema = z
  .object({
    workspace: WorkspaceSchema
  })
  .openapi("WorkspaceResponseData");

export const ProfileResponseDataSchema = z
  .object({
    profile: ProfileSchema
  })
  .openapi("ProfileResponseData");

export const MembershipResponseDataSchema = z
  .object({
    membership: MembershipSchema
  })
  .openapi("MembershipResponseData");

// Authentication response data schemas
export const AuthTokenDataSchema = z
  .object({
    token: z.string().describe("JWT access token"),
    account: AccountSchema
  })
  .openapi("AuthTokenData");

export const LoginAuthUserSchema = z
  .object({
    id: z.uuid().describe("Authenticated user id"),
    email: z.string().nullable().optional().describe("Authenticated user email")
  })
  .passthrough()
  .openapi("LoginAuthUser");

export const LoginAuthSessionSchema = z
  .object({
    access_token: z.string().describe("Supabase access token"),
    refresh_token: z.string().describe("Supabase refresh token"),
    expires_in: z.number().describe("Token expiration in seconds"),
    token_type: z.string().describe("Token type"),
    user: LoginAuthUserSchema
  })
  .passthrough()
  .openapi("LoginAuthSession");

export const LoginWorkspaceInfoSchema = z
  .object({
    workspace: z.object({
      uuid: z.uuid(),
      name: z.string(),
      description: z.string().nullable(),
      createdAt: z.string().datetime(),
      ownerId: z.uuid()
    }),
    profile: z.object({
      uuid: z.uuid(),
      name: z.string(),
      createdAt: z.string().datetime()
    }),
    membership: z.object({
      uuid: z.uuid()
    }),
    role: z.object({
      id: z.number().int(),
      code: z.string().nullable(),
      name: z.string().nullable()
    })
  })
  .openapi("LoginWorkspaceInfo");

export const LoginResponseDataSchema = z
  .object({
    user: LoginAuthUserSchema.nullable(),
    session: LoginAuthSessionSchema.nullable(),
    account: AccountSchema,
    workspaces: z.array(LoginWorkspaceInfoSchema),
    workspaceCount: z.number().int().min(0)
  })
  .openapi("LoginResponseData");

// Complex composite schemas
export const WorkspaceMemberSchema = z
  .object({
    account: AccountSchema,
    profile: ProfileSchema,
    membership: MembershipSchema
  })
  .openapi("WorkspaceMember");

export const UserWorkspaceInfoSchema = z
  .object({
    workspace: WorkspaceSchema,
    profile: ProfileSchema,
    membership: MembershipSchema
  })
  .openapi("UserWorkspaceInfo");

export const WorkspaceWithMembersDataSchema = z
  .object({
    workspace: WorkspaceSchema,
    members: z.array(WorkspaceMemberSchema),
    memberCount: z.number().describe("Total number of workspace members")
  })
  .openapi("WorkspaceWithMembersData");

export const WorkspaceMembersDataSchema = z
  .object({
    members: z.array(WorkspaceMemberSchema),
    memberCount: z.number().describe("Total number of workspace members")
  })
  .openapi("WorkspaceMembersData");

export const CreateWorkspaceDataSchema = z
  .object({
    workspace: WorkspaceSchema,
    profile: ProfileSchema,
    membership: MembershipSchema
  })
  .openapi("CreateWorkspaceData");

export const UserProfileDataSchema = z
  .object({
    account: AccountSchema,
    workspaces: z.array(UserWorkspaceInfoSchema),
    workspaceCount: z.number().describe("Total number of user workspaces")
  })
  .openapi("UserProfileData");

// Admin query filters
export const AdminPaginationQuerySchema = z
  .object({
    page: z.number().int().positive().default(1).describe("Page number for pagination"),
    limit: z.number().int().min(1).max(100).default(20).describe("Number of items per page")
  })
  .openapi("AdminPaginationQuery");

export const AdminMembershipQuerySchema = z
  .object({
    page: z.number().int().positive().default(1).describe("Page number for pagination"),
    limit: z.number().int().min(1).max(100).default(20).describe("Number of items per page"),
    workspaceId: z.uuid().optional().describe("Filter by workspace ID"),
    accountId: z.uuid().optional().describe("Filter by account ID")
  })
  .openapi("AdminMembershipQuery");

export const AuditLogQuerySchema = z
  .object({
    page: z.number().int().positive().default(1).describe("Page number for pagination"),
    limit: z.number().int().min(1).max(100).default(50).describe("Number of items per page"),
    action: z.string().optional().describe("Filter by action type"),
    entityType: z.string().optional().describe("Filter by entity type"),
    actorId: z.uuid().optional().describe("Filter by actor ID"),
    entityId: z.uuid().optional().describe("Filter by entity ID"),
    workspaceId: z.uuid().optional().describe("Filter by workspace ID"),
    startDate: z.string().optional().describe("Filter by start date (ISO 8601)"),
    endDate: z.string().optional().describe("Filter by end date (ISO 8601)")
  })
  .openapi("AuditLogQuery");

export const AuditLogStatsQuerySchema = z
  .object({
    days: z.number().int().min(1).max(365).default(30).describe("Number of days to analyze")
  })
  .openapi("AuditLogStatsQuery");

// Simplified reference schemas for admin endpoints
export const SimpleAccountSchema = z
  .object({
    uuid: z.uuid(),
    email: z.email(),
    fullName: z.string()
  })
  .openapi("SimpleAccount");

export const SimpleWorkspaceSchema = z
  .object({
    uuid: z.uuid(),
    name: z.string()
  })
  .openapi("SimpleWorkspace");

// Standardized success response patterns
export const AccountsWithPaginationDataSchema = z
  .object({
    accounts: z.array(AccountSchema),
    pagination: PaginationSchema
  })
  .openapi("AccountsWithPaginationData");

export const WorkspacesWithPaginationDataSchema = z
  .object({
    workspaces: z.array(
      WorkspaceSchema.extend({
        memberCount: z.number().describe("Number of workspace members")
      })
    ),
    pagination: PaginationSchema
  })
  .openapi("WorkspacesWithPaginationData");

export const WorkspacesListDataSchema = z
  .object({
    data: z.array(WorkspaceSchema)
  })
  .openapi("WorkspacesListData");

// Audit log response schemas
export const AuditLogWithDetailsSchema = z
  .object({
    auditLog: AuditLogSchema,
    actor: SimpleAccountSchema.nullable(),
    target: SimpleAccountSchema.nullable(),
    workspace: SimpleWorkspaceSchema.nullable()
  })
  .openapi("AuditLogWithDetails");

export const AuditLogsWithPaginationDataSchema = z
  .object({
    auditLogs: z.array(AuditLogWithDetailsSchema),
    pagination: PaginationSchema,
    filters: z.object({
      action: z.string().nullable(),
      entityType: z.string().nullable(),
      actorId: z.uuid().nullable(),
      entityId: z.uuid().nullable(),
      workspaceId: z.uuid().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable()
    })
  })
  .openapi("AuditLogsWithPaginationData");

// Membership response schemas
export const MembershipWithDetailsSchema = z
  .object({
    membership: MembershipSchema,
    workspace: SimpleWorkspaceSchema,
    account: SimpleAccountSchema
  })
  .openapi("MembershipWithDetails");

export const MembershipsWithPaginationDataSchema = z
  .object({
    memberships: z.array(MembershipWithDetailsSchema),
    pagination: PaginationSchema
  })
  .openapi("MembershipsWithPaginationData");

export const CategorySchema = z
  .object({
    uuid: z.uuid(),
    workspaceId: z.uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.string().datetime().nullable()
  })
  .openapi("Category");

export const CategoryCreateSchema = z
  .object({
    code: z.string().min(1).max(100),
    name: z.string().min(1).max(255),
    description: z.string().optional()
  })
  .openapi("CategoryCreate");

export const CategoryUpdateSchema = CategoryCreateSchema.partial().openapi("CategoryUpdate");

export const CategoryListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    sortBy: z.enum(["createdAt", "name", "code"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .openapi("CategoryListQuery");

export const CategoriesListResponseDataSchema = z
  .object({
    items: z.array(CategorySchema),
    pagination: PaginationSchema,
    filters: z.object({
      workspaceId: z.uuid(),
      search: z.string().nullable(),
      createdFrom: z.string().nullable(),
      createdTo: z.string().nullable(),
      sortBy: z.enum(["createdAt", "name", "code"]),
      sortOrder: z.enum(["asc", "desc"])
    })
  })
  .openapi("CategoriesListResponseData");

export const DocumentSchema = z
  .object({
    uuid: z.uuid(),
    workspaceId: z.uuid(),
    title: z.string(),
    documentNumber: z.string().nullable(),
    documentTypeId: z.uuid().nullable(),
    fieldId: z.uuid().nullable(),
    issuingOrgId: z.uuid().nullable(),
    issuedDate: z.string().nullable(),
    effectiveDate: z.string().nullable(),
    summary: z.string().nullable(),
    filePath: z.string().nullable(),
    statusId: z.uuid().nullable(),
    createdBy: z.uuid().nullable(),
    createdAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime().nullable(),
    deletedAt: z.string().datetime().nullable()
  })
  .openapi("Document");

export const FileAttachmentInputSchema = z
  .object({
    fileName: z.string().min(1),
    fileContentBase64: z.string().min(1),
    mimeType: z.string().max(150).optional(),
    fileSize: z.number().int().nonnegative().optional(),
    storageBucket: z.string().min(1).optional(),
    storagePath: z.string().min(1).optional(),
    uploadedBy: z.uuid().optional()
  })
  .openapi("FileAttachmentInput");

export const DocumentCreateSchema = z
  .object({
    title: z.string().min(1),
    documentNumber: z.string().max(100).optional(),
    documentTypeId: z.uuid().optional(),
    fieldId: z.uuid().optional(),
    issuingOrgId: z.uuid().optional(),
    issuedDate: z.string().date().optional(),
    effectiveDate: z.string().date().optional(),
    summary: z.string().optional(),
    filePath: z.string().optional(),
    statusId: z.uuid().optional(),
    createdBy: z.uuid().optional(),
    attachments: z.array(FileAttachmentInputSchema).max(20).optional()
  })
  .openapi("DocumentCreate");

export const DocumentUpdateAttachmentSchema = z
  .object({
    uuid: z.uuid().optional(),
    fileName: z.string().min(1).optional(),
    fileContentBase64: z.string().min(1).optional(),
    mimeType: z.string().max(150).optional(),
    fileSize: z.number().int().nonnegative().optional(),
    storageBucket: z.string().min(1).optional(),
    storagePath: z.string().min(1).optional(),
    uploadedBy: z.uuid().optional()
  })
  .refine((value) => Boolean(value.uuid || value.fileContentBase64), {
    message: "Attachment uuid or fileContentBase64 is required"
  })
  .openapi("DocumentUpdateAttachment");

export const DocumentUpdateSchema = z
  .object({
    title: z.string().min(1).optional(),
    documentNumber: z.string().max(100).optional(),
    documentTypeId: z.uuid().optional(),
    fieldId: z.uuid().optional(),
    issuingOrgId: z.uuid().optional(),
    issuedDate: z.string().date().optional(),
    effectiveDate: z.string().date().optional(),
    summary: z.string().optional(),
    filePath: z.string().optional(),
    statusId: z.uuid().optional(),
    createdBy: z.uuid().optional(),
    attachments: z.array(DocumentUpdateAttachmentSchema).max(20).optional()
  })
  .openapi("DocumentUpdate");

export const DocumentListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    statusId: z.uuid().optional(),
    documentNumber: z.string().max(100).optional(),
    summary: z.string().optional(),
    organizationId: z.uuid().optional(),
    documentTypeId: z.uuid().optional(),
    fieldId: z.uuid().optional(),
    issuedDate: z.string().date().optional(),
    search: z.string().optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "title", "issuedDate"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .openapi("DocumentListQuery");

export const TaskSchema = z
  .object({
    uuid: z.uuid(),
    workspaceId: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    documentId: z.uuid().nullable(),
    organizationId: z.uuid().nullable(),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    status: z.enum(["new", "in_progress", "completed", "overdue"]),
    startDate: z.string().nullable(),
    dueDate: z.string().nullable(),
    completedAt: z.string().datetime().nullable(),
    createdBy: z.uuid().nullable(),
    createdAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime().nullable(),
    deletedAt: z.string().datetime().nullable()
  })
  .openapi("Task");

export const TaskCreateSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    documentId: z.uuid().optional(),
    organizationId: z.uuid().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    status: z.enum(["new", "in_progress", "completed", "overdue"]).default("new"),
    startDate: z.string().date().optional(),
    dueDate: z.string().date().optional(),
    completedAt: z.string().datetime().optional(),
    createdBy: z.uuid().optional(),
    attachments: z.array(FileAttachmentInputSchema).max(20).optional()
  })
  .openapi("TaskCreate");

export const TaskUpdateSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    documentId: z.uuid().optional(),
    organizationId: z.uuid().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    status: z.enum(["new", "in_progress", "completed", "overdue"]).optional(),
    startDate: z.string().date().optional(),
    dueDate: z.string().date().optional(),
    completedAt: z.string().datetime().optional()
  })
  .openapi("TaskUpdate");

export const TaskListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    status: z.enum(["new", "in_progress", "completed", "overdue"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    organizationId: z.uuid().optional(),
    search: z.string().optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    dueFrom: z.string().date().optional(),
    dueTo: z.string().date().optional(),
    sortBy: z
      .enum(["createdAt", "updatedAt", "dueDate", "startDate", "title", "priority", "status"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .openapi("TaskListQuery");

export const TasksListResponseDataSchema = z
  .object({
    items: z.array(TaskSchema),
    pagination: PaginationSchema,
    filters: z.object({
      workspaceId: z.uuid(),
      status: z.enum(["new", "in_progress", "completed", "overdue"]).nullable(),
      priority: z.enum(["low", "medium", "high", "urgent"]).nullable(),
      organizationId: z.uuid().nullable(),
      search: z.string().nullable(),
      createdFrom: z.string().nullable(),
      createdTo: z.string().nullable(),
      dueFrom: z.string().nullable(),
      dueTo: z.string().nullable(),
      sortBy: z.enum(["createdAt", "updatedAt", "dueDate", "startDate", "title", "priority", "status"]),
      sortOrder: z.enum(["asc", "desc"])
    })
  })
  .openapi("TasksListResponseData");

export const OrganizationSchema = z
  .object({
    uuid: z.uuid(),
    workspaceId: z.uuid(),
    name: z.string(),
    code: z.string().nullable(),
    parentId: z.uuid().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    status: z.boolean().nullable(),
    sortOrder: z.number().nullable().optional(),
    createdAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime().nullable(),
    deletedAt: z.string().datetime().nullable()
  })
  .openapi("Organization");

export const OrganizationCreateSchema = z
  .object({
    name: z.string().min(1).max(255),
    code: z.string().max(100).optional(),
    parentId: z.uuid().optional(),
    address: z.string().optional(),
    phone: z.string().max(50).optional(),
    email: z.union([z.email(), z.literal("")]).optional(),
    status: z.boolean().optional(),
    sortOrder: z.number().int().optional()
  })
  .openapi("OrganizationCreate");

export const OrganizationUpdateSchema = OrganizationCreateSchema.partial().openapi("OrganizationUpdate");

export const OrganizationListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(1000).default(1000),
    parentId: z.uuid().optional(),
    status: z.boolean().optional(),
    search: z.string().optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "name", "code", "sortOrder"]).default("sortOrder"),
    sortOrder: z.enum(["asc", "desc"]).default("asc")
  })
  .openapi("OrganizationListQuery");

export const OrganizationsListResponseDataSchema = z
  .object({
    items: z.array(OrganizationSchema),
    pagination: PaginationSchema,
    filters: z.object({
      workspaceId: z.uuid(),
      parentId: z.uuid().nullable(),
    status: z.boolean().nullable(),
    search: z.string().nullable(),
    createdFrom: z.string().nullable(),
    createdTo: z.string().nullable(),
      sortBy: z.enum(["createdAt", "updatedAt", "name", "code", "sortOrder"]),
      sortOrder: z.enum(["asc", "desc"])
    })
  })
  .openapi("OrganizationsListResponseData");

export const FileSchema = z
  .object({
    uuid: z.uuid(),
    fileName: z.string(),
    filePath: z.string(),
    fileSize: z.number().nullable(),
    mimeType: z.string().nullable(),
    entityType: z.string(),
    entityId: z.uuid(),
    uploadedBy: z.uuid().nullable(),
    createdAt: z.string().datetime().nullable()
  })
  .openapi("FileResource");

export const DocumentListItemSchema = DocumentSchema.extend({
  issuingOrgName: z.string().nullable(),
  documentTypeName: z.string().nullable(),
  fieldName: z.string().nullable(),
  files: z.array(FileSchema),
  attachmentsCount: z.number().int().min(0).optional()
}).openapi("DocumentListItem");

export const DocumentsListResponseDataSchema = z
  .object({
    items: z.array(DocumentListItemSchema),
    pagination: PaginationSchema,
    filters: z.object({
      workspaceId: z.uuid(),
      statusId: z.uuid().nullable(),
      documentNumber: z.string().nullable(),
      summary: z.string().nullable(),
      organizationId: z.uuid().nullable(),
      documentTypeId: z.uuid().nullable(),
      fieldId: z.uuid().nullable(),
      issuedDate: z.string().nullable(),
      search: z.string().nullable(),
      createdFrom: z.string().nullable(),
      createdTo: z.string().nullable(),
      sortBy: z.enum(["createdAt", "updatedAt", "title", "issuedDate"]),
      sortOrder: z.enum(["asc", "desc"])
    })
  })
  .openapi("DocumentsListResponseData");

export const FileCreateSchema = z
  .object({
    fileName: z.string().min(1),
    filePath: z.string().min(1),
    fileSize: z.number().int().nonnegative().optional(),
    mimeType: z.string().max(150).optional(),
    entityType: z.string().min(1).max(50),
    entityId: z.uuid(),
    uploadedBy: z.uuid().optional()
  })
  .openapi("FileCreate");

export const FileUpdateSchema = FileCreateSchema.partial().openapi("FileUpdate");

export const FileListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    entityType: z.string().optional(),
    entityId: z.uuid().optional(),
    uploadedBy: z.uuid().optional(),
    mimeType: z.string().optional(),
    search: z.string().optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    sortBy: z.enum(["createdAt", "fileName", "fileSize"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .openapi("FileListQuery");

export const FilesListResponseDataSchema = z
  .object({
    items: z.array(FileSchema),
    pagination: PaginationSchema,
    filters: z.record(z.string(), z.unknown())
  })
  .openapi("FilesListResponseData");

export const FileDownloadResponseDataSchema = z
  .object({
    item: FileSchema,
    downloadUrl: z.string().url(),
    expiresIn: z.number().int().min(60).max(86400)
  })
  .openapi("FileDownloadResponseData");

export const FilePreviewResponseDataSchema = z
  .object({
    item: FileSchema,
    previewType: z.enum(["pdf", "image", "file"]),
    previewUrl: z.string().nullable(),
    htmlContent: z.string().nullable(),
    expiresIn: z.number().int().min(60).max(86400)
  })
  .openapi("FilePreviewResponseData");

export const FileSummaryRequestSchema = z
  .object({
    details: z.boolean().default(true)
  })
  .openapi("FileSummaryRequest");

export const FileSummaryResponseDataSchema = z
  .object({
    item: FileSchema,
    summary: z.string(),
    summarySource: z.literal("smart-reader"),
    smartReader: z.object({
      fileHash: z.string(),
      scanTable: z.record(z.string(), z.unknown()),
      summary: z.record(z.string(), z.unknown())
    })
  })
  .openapi("FileSummaryResponseData");

export const DocumentDetailResponseDataSchema = z
  .object({
    item: DocumentSchema,
    files: z.array(FileSchema)
  })
  .openapi("DocumentDetailResponseData");

export const DocumentFilesResponseDataSchema = z
  .object({
    item: DocumentSchema,
    files: z.array(FileSchema),
    attachmentsCount: z.number().int().min(0)
  })
  .openapi("DocumentFilesResponseData");

export const DocumentSummaryRequestSchema = z
  .object({
    fileId: z.uuid().optional(),
    details: z.boolean().default(true)
  })
  .openapi("DocumentSummaryRequest");

export const DocumentSummaryResponseDataSchema = z
  .object({
    item: DocumentSchema,
    file: FileSchema,
    summary: z.string(),
    summarySource: z.literal("smart-reader"),
    smartReader: z.object({
      fileHash: z.string(),
      scanTable: z.record(z.string(), z.unknown()),
      summary: z.record(z.string(), z.unknown())
    })
  })
  .openapi("DocumentSummaryResponseData");

export const TaskDetailResponseDataSchema = z
  .object({
    item: TaskSchema,
    files: z.array(FileSchema)
  })
  .openapi("TaskDetailResponseData");

export const NotificationSchema = z
  .object({
    uuid: z.uuid(),
    workspaceId: z.uuid(),
    accountId: z.uuid().nullable(),
    title: z.string().nullable(),
    message: z.string().nullable(),
    typeId: z.uuid().nullable(),
    statusId: z.uuid().nullable(),
    createdAt: z.string().datetime().nullable()
  })
  .openapi("Notification");

export const NotificationCreateSchema = z
  .object({
    accountId: z.uuid().optional(),
    title: z.string().optional(),
    message: z.string().optional(),
    typeId: z.uuid().optional(),
    statusId: z.uuid().optional()
  })
  .openapi("NotificationCreate");

export const NotificationUpdateSchema = NotificationCreateSchema.partial().openapi("NotificationUpdate");

export const NotificationListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    accountId: z.uuid().optional(),
    typeId: z.uuid().optional(),
    statusId: z.uuid().optional(),
    search: z.string().optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    sortBy: z.enum(["createdAt", "title"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .openapi("NotificationListQuery");

export const NotificationsListResponseDataSchema = z
  .object({
    items: z.array(NotificationSchema),
    pagination: PaginationSchema,
    filters: z.record(z.string(), z.unknown())
  })
  .openapi("NotificationsListResponseData");

export const CategoryItemSchema = z
  .object({
    uuid: z.uuid(),
    categoryId: z.uuid().nullable(),
    parentId: z.uuid().nullable(),
    code: z.string().nullable(),
    name: z.string().nullable(),
    sortOrder: z.number().nullable(),
    status: z.boolean().nullable(),
    createdAt: z.string().datetime().nullable()
  })
  .openapi("CategoryItem");

export const CategoryItemCreateSchema = z
  .object({
    categoryId: z.uuid().optional(),
    parentId: z.uuid().optional(),
    code: z.string().max(100).optional(),
    name: z.string().max(255).optional(),
    sortOrder: z.number().int().optional(),
    status: z.boolean().optional()
  })
  .openapi("CategoryItemCreate");

export const CategoryItemUpdateSchema = CategoryItemCreateSchema.partial().openapi("CategoryItemUpdate");

export const CategoryItemListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    categoryId: z.uuid().optional(),
    parentId: z.uuid().optional(),
    status: z.boolean().optional(),
    search: z.string().optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    sortBy: z.enum(["createdAt", "name", "sortOrder"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .openapi("CategoryItemListQuery");

export const CategoryItemsListResponseDataSchema = z
  .object({
    items: z.array(CategoryItemSchema),
    pagination: PaginationSchema,
    filters: z.record(z.string(), z.unknown())
  })
  .openapi("CategoryItemsListResponseData");

export const RoleSchema = z
  .object({
    id: z.number().int(),
    code: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    createdAt: z.string().datetime().nullable()
  })
  .openapi("RoleResource");

export const RoleCreateSchema = z
  .object({
    code: z.string().min(1).max(100).optional(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional()
  })
  .openapi("RoleCreate");

export const RoleUpdateSchema = RoleCreateSchema.partial().openapi("RoleUpdate");

export const RoleListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    sortBy: z.enum(["id", "code", "name", "createdAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .openapi("RoleListQuery");

export const RolesListResponseDataSchema = z
  .object({
    items: z.array(RoleSchema),
    pagination: PaginationSchema,
    filters: z.object({
      search: z.string().nullable(),
      sortBy: z.enum(["id", "code", "name", "createdAt"]),
      sortOrder: z.enum(["asc", "desc"])
    })
  })
  .openapi("RolesListResponseData");

export const PermissionSchema = z
  .object({
    id: z.number().int(),
    code: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable()
  })
  .openapi("PermissionResource");

export const PermissionCreateSchema = z
  .object({
    code: z.string().min(1).max(150).optional(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional()
  })
  .openapi("PermissionCreate");

export const PermissionUpdateSchema = PermissionCreateSchema.partial().openapi("PermissionUpdate");

export const PermissionListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    sortBy: z.enum(["id", "code", "name"]).default("id"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .openapi("PermissionListQuery");

export const PermissionsListResponseDataSchema = z
  .object({
    items: z.array(PermissionSchema),
    pagination: PaginationSchema,
    filters: z.object({
      search: z.string().nullable(),
      sortBy: z.enum(["id", "code", "name"]),
      sortOrder: z.enum(["asc", "desc"])
    })
  })
  .openapi("PermissionsListResponseData");

export const RolePermissionSchema = z
  .object({
    roleId: z.number().int(),
    permissionId: z.number().int()
  })
  .openapi("RolePermissionResource");

export const RolePermissionCreateSchema = z
  .object({
    roleId: z.number().int().positive(),
    permissionId: z.number().int().positive()
  })
  .openapi("RolePermissionCreate");

export const RolePermissionUpdateSchema = z
  .object({
    roleId: z.number().int().positive().optional(),
    permissionId: z.number().int().positive().optional()
  })
  .openapi("RolePermissionUpdate");

export const RolePermissionListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    roleId: z.number().int().positive().optional(),
    permissionId: z.number().int().positive().optional(),
    sortBy: z.enum(["roleId", "permissionId"]).default("roleId"),
    sortOrder: z.enum(["asc", "desc"]).default("asc")
  })
  .openapi("RolePermissionListQuery");

export const RolePermissionsListResponseDataSchema = z
  .object({
    items: z.array(RolePermissionSchema),
    pagination: PaginationSchema,
    filters: z.object({
      roleId: z.number().int().nullable(),
      permissionId: z.number().int().nullable(),
      sortBy: z.enum(["roleId", "permissionId"]),
      sortOrder: z.enum(["asc", "desc"])
    })
  })
  .openapi("RolePermissionsListResponseData");

export const TaskCommentSchema = z
  .object({
    uuid: z.uuid(),
    taskId: z.uuid().nullable(),
    accountId: z.uuid().nullable(),
    content: z.string().nullable(),
    createdAt: z.string().datetime().nullable()
  })
  .openapi("TaskComment");

export const TaskCommentCreateSchema = z
  .object({
    taskId: z.uuid().optional(),
    accountId: z.uuid().optional(),
    content: z.string().optional()
  })
  .openapi("TaskCommentCreate");

export const TaskCommentUpdateSchema = TaskCommentCreateSchema.partial().openapi("TaskCommentUpdate");

export const TaskCommentListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    taskId: z.uuid().optional(),
    accountId: z.uuid().optional(),
    search: z.string().optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    sortBy: z.enum(["createdAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .openapi("TaskCommentListQuery");

export const TaskCommentsListResponseDataSchema = z
  .object({
    items: z.array(TaskCommentSchema),
    pagination: PaginationSchema,
    filters: z.record(z.string(), z.unknown())
  })
  .openapi("TaskCommentsListResponseData");

export const TaskProgressSchema = z
  .object({
    uuid: z.uuid(),
    taskId: z.uuid().nullable(),
    progressPercent: z.number().nullable(),
    comment: z.string().nullable(),
    updatedBy: z.uuid().nullable(),
    createdAt: z.string().datetime().nullable()
  })
  .openapi("TaskProgress");

export const TaskProgressCreateSchema = z
  .object({
    taskId: z.uuid().optional(),
    progressPercent: z.number().int().min(0).max(100).optional(),
    comment: z.string().optional(),
    updatedBy: z.uuid().optional()
  })
  .openapi("TaskProgressCreate");

export const TaskProgressUpdateSchema = TaskProgressCreateSchema.partial().openapi("TaskProgressUpdate");

export const TaskProgressListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    taskId: z.uuid().optional(),
    updatedBy: z.uuid().optional(),
    progressMin: z.number().int().min(0).max(100).optional(),
    progressMax: z.number().int().min(0).max(100).optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    sortBy: z.enum(["createdAt", "progressPercent"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .openapi("TaskProgressListQuery");

export const TaskProgressListResponseDataSchema = z
  .object({
    items: z.array(TaskProgressSchema),
    pagination: PaginationSchema,
    filters: z.record(z.string(), z.unknown())
  })
  .openapi("TaskProgressListResponseData");

export const TaskAssignmentSchema = z
  .object({
    uuid: z.uuid(),
    taskId: z.uuid().nullable(),
    assignedToAccountId: z.uuid().nullable(),
    assignedToOrgId: z.uuid().nullable(),
    assignedBy: z.uuid().nullable(),
    assignedAt: z.string().datetime().nullable(),
    statusId: z.uuid().nullable()
  })
  .openapi("TaskAssignment");

export const TaskAssignmentCreateSchema = z
  .object({
    taskId: z.uuid().optional(),
    assignedToAccountId: z.uuid().optional(),
    assignedToOrgId: z.uuid().optional(),
    assignedBy: z.uuid().optional(),
    assignedAt: z.string().datetime().optional(),
    statusId: z.uuid().optional()
  })
  .openapi("TaskAssignmentCreate");

export const TaskAssignmentUpdateSchema = TaskAssignmentCreateSchema.partial().openapi("TaskAssignmentUpdate");

export const TaskAssignmentListQuerySchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    taskId: z.uuid().optional(),
    assignedToAccountId: z.uuid().optional(),
    assignedToOrgId: z.uuid().optional(),
    assignedBy: z.uuid().optional(),
    statusId: z.uuid().optional(),
    assignedFrom: z.string().datetime().optional(),
    assignedTo: z.string().datetime().optional(),
    sortBy: z.enum(["assignedAt"]).default("assignedAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .openapi("TaskAssignmentListQuery");

export const TaskAssignmentsListResponseDataSchema = z
  .object({
    items: z.array(TaskAssignmentSchema),
    pagination: PaginationSchema,
    filters: z.record(z.string(), z.unknown())
  })
  .openapi("TaskAssignmentsListResponseData");

