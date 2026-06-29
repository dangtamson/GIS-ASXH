import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm/relations";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

export const uuidSchema = z.uuid();
export const uuidObjectSchema = z.object({ uuid: uuidSchema });

export const AccountStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended"
} as const;

export type AccountStatusType = (typeof AccountStatus)[keyof typeof AccountStatus];

// Task Priority Enum
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);
export const TaskPriority = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent"
} as const;
export type TaskPriorityType = (typeof TaskPriority)[keyof typeof TaskPriority];

// Task Status Enum
export const taskStatusEnum = pgEnum("task_status", [
  "new",
  "in_progress",
  "completed",
  "overdue",
  "pending",
  "rejected",
  "approved"
]);
export const TaskStatus = {
  NEW: "new",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  OVERDUE: "overdue"
} as const;
export type TaskStatusType = (typeof TaskStatus)[keyof typeof TaskStatus];

export const accounts = pgTable("accounts", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  phone: varchar("phone", { length: 256 }),
  createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).defaultNow(),
  email: text("email").notNull().unique(),
  isSuperAdmin: boolean("is_super_admin").default(false),
  isAdmin: boolean("is_admin").default(false),
  status: text("status", { enum: ["active", "inactive", "suspended"] })
    .default("active")
    .notNull(),
  // Security policy tracking
  passwordChangeRequired: boolean("password_change_required").default(false),
  lastPasswordChangedAt: timestamp("last_password_changed_at", { precision: 6, withTimezone: true }),
  isLocked: boolean("is_locked").default(false),
  lockedUntil: timestamp("locked_until", { precision: 6, withTimezone: true }),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lastFailedLoginAt: timestamp("last_failed_login_at", { precision: 6, withTimezone: true })
});

export const workspaces = pgTable("workspaces", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).defaultNow(),
  accountId: uuid("account_id").notNull()
});

export const workspaceFeatures = pgTable("workspace_features", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.uuid),
  featureId: uuid("feature_id")
    .notNull()
    .references(() => features.uuid),
  createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).defaultNow()
});

export const systemConfigs = pgTable(
  "system_configs",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.uuid),
    general: jsonb("general").$type<Record<string, unknown>>().notNull().default({}),
    sso: jsonb("sso").$type<Record<string, unknown>>().notNull().default({}),
    email: jsonb("email").$type<Record<string, unknown>>().notNull().default({}),
    smartReader: jsonb("smart_reader").$type<Record<string, unknown>>().default({}),
    openaiConfig: jsonb("openai_config").$type<Record<string, unknown>>().default({}),
    securityPolicy: jsonb("security_policy").$type<Record<string, unknown>>().notNull().default({}),
    updatedBy: uuid("updated_by").references(() => accounts.uuid),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true }).defaultNow()
  },
  (table) => ({
    uniqueWorkspace: unique("system_configs_workspace_id_unique").on(table.workspaceId),
    idxSystemConfigsWorkspace: index("idx_system_configs_workspace").on(table.workspaceId)
  })
);

export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 100 }),
    name: varchar("name", { length: 255 }),
    description: text("description"),
    workspaceId: uuid("workspace_id").references(() => workspaces.uuid),
    createdAt: timestamp("created_at", { precision: 6 }).defaultNow()
  },
  (table) => ({
    uniqueCodeWorkspace: uniqueIndex("roles_code_workspace_id_unique").on(table.workspaceId, table.code)
  })
);

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 150 }).unique(),
  name: varchar("name", { length: 255 }),
  description: text("description")
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => permissions.id)
  },
  (table) => ({
    pk: primaryKey({ name: "role_permissions_pkey", columns: [table.roleId, table.permissionId] })
  })
);

export const roleFeatures = pgTable(
  "role_features",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    featureId: uuid("feature_id")
      .notNull()
      .references(() => features.uuid, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).defaultNow()
  },
  (table) => ({
    pk: primaryKey({ name: "role_features_pkey", columns: [table.roleId, table.featureId] }),
    idxRoleFeaturesRoleId: index("idx_role_features_role_id").on(table.roleId),
    idxRoleFeaturesFeatureId: index("idx_role_features_feature_id").on(table.featureId)
  })
);

export const profiles = pgTable(
  "profiles",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).defaultNow(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.uuid),
    accountId: uuid("account_id")
      .notNull()
      .default("00000000-0000-0000-0000-000000000000")
      .references(() => accounts.uuid)
  },
  (table) => ({
    uniqueAccountWorkspace: unique("unique_account_workspace").on(table.accountId, table.workspaceId),
    accountIdIdx: index("profiles_account_id_idx").on(table.accountId),
    workspaceIdIdx: index("profiles_workspace_id_idx").on(table.workspaceId),
    workspaceAccountIdx: index("profiles_workspace_account_idx").on(table.workspaceId, table.accountId),
    idxProfilesAccount: index("idx_profiles_account").on(table.accountId),
    idxProfilesWorkspace: index("idx_profiles_workspace").on(table.workspaceId)
  })
);

export const organizations = pgTable(
  "organizations",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.uuid),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 100 }),
    parentId: uuid("parent_id").references((): AnyPgColumn => organizations.uuid),
    address: text("address"),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 150 }),
    status: boolean("status").default(true),
    createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 6 }).defaultNow(),
    deletedAt: timestamp("deleted_at", { precision: 6 }),
    sort_order: integer(),
    is_root: boolean()
  },
  (table) => ({
    idxOrgWorkspace: index("idx_org_workspace").on(table.workspaceId)
  })
);

export const categories = pgTable("categories", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.uuid),
  code: varchar("code", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { precision: 6 }).defaultNow()
}, (table) => {
  return {
    uniqueWorkspaceCode: unique().on(table.workspaceId, table.code)
  };
});

export const categoryItems = pgTable(
  "category_items",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").references(() => categories.uuid),
    parentId: uuid("parent_id").references((): AnyPgColumn => categoryItems.uuid),
    code: varchar("code", { length: 100 }),
    name: varchar("name", { length: 255 }),
    sortOrder: integer("sort_order").default(0),
    status: boolean("status").default(true),
    createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
    description: text("description").default("")
  },
  (table) => ({
    idxCategoryItemsCategory: index("idx_category_items_category").on(table.categoryId)
  })
);

export const gisasxhSchema = pgSchema("gisasxh");

export const poorHouseholds = gisasxhSchema.table(
  "poor_households",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code"),
    year: integer("year").notNull(),
    povertyType: text("poverty_type").notNull(),
    status: text("status").default("ACTIVE"),
    provinceName: text("province_name"),
    districtName: text("district_name"),
    wardName: text("ward_name"),
    areaName: text("area_name"),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 6 }).defaultNow()
  },
  (table) => ({
    uniqueCode: unique("poor_households_code_key").on(table.code)
  })
);

export const povertyYearOverviews = gisasxhSchema.table(
  "poverty_year_overviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    year: integer("year").notNull(),
    population: integer("population").notNull().default(0),
    totalHouseholds: integer("total_households").notNull().default(0),
    totalMembers: integer("total_members").notNull().default(0),
    note: text("note"),
    createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 6 }).defaultNow()
  },
  (table) => ({
    uniqueYear: unique("poverty_year_overviews_year_key").on(table.year)
  })
);

export const householdMembers = gisasxhSchema.table("household_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => poorHouseholds.id),
  fullName: text("full_name").notNull(),
  relationship: text("relationship"),
  gender: text("gender"),
  dateOfBirth: date("date_of_birth"),
  ethnicity: text("ethnicity"),
  citizenId: text("citizen_id"),
  phone: text("phone"),
  isHead: boolean("is_head").default(false),
  occupation: text("occupation"),
  note: text("note"),
  createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
  updatedAt: timestamp("updated_at", { precision: 6 }).defaultNow()
});

export const householdChangeLogs = gisasxhSchema.table("household_change_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").references(() => poorHouseholds.id),
  actionType: text("action_type").notNull(),
  objectType: text("object_type").notNull(),
  objectId: uuid("object_id"),
  changedBy: bigint("changed_by", { mode: "number" }),
  oldData: jsonb("old_data").$type<Record<string, unknown>>(),
  newData: jsonb("new_data").$type<Record<string, unknown>>(),
  changeNote: text("change_note"),
  changedAt: timestamp("changed_at", { precision: 6 }).defaultNow()
});

export const householdAssessments = gisasxhSchema.table(
  "household_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => poorHouseholds.id),
    assessmentYear: integer("assessment_year").notNull(),
    povertyType: text("poverty_type").notNull(),
    scoreB1: numeric("score_b1", { mode: "number" }),
    scoreB2: numeric("score_b2", { mode: "number" }),
    decisionNo: text("decision_no"),
    decisionDate: date("decision_date"),
    approvedBy: text("approved_by"),
    note: text("note"),
    createdAt: timestamp("created_at", { precision: 6 }).defaultNow()
  },
  (table) => ({
    uniqueHouseholdYear: unique("household_assessments_household_id_assessment_year_key").on(
      table.householdId,
      table.assessmentYear
    )
  })
);

export const householdSupports = gisasxhSchema.table("household_supports", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => poorHouseholds.id),
  supportDate: date("support_date").notNull(),
  supportTypes: jsonb("support_types").$type<string[]>().notNull().default([]),
  amounts: jsonb("amounts").$type<Record<string, number>>().notNull().default({}),
  content: text("content"),
  supportingUnit: text("supporting_unit"),
  note: text("note"),
  createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
  updatedAt: timestamp("updated_at", { precision: 6 }).defaultNow()
});

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    accountId: uuid("account_id").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.uuid),
    positionId: uuid("position_id").references(() => categoryItems.uuid),
    roleId: integer("role_id").references(() => roles.id),
    isAdmin: boolean("is_admin").default(false),
    status: boolean("status").default(true),
    joinedAt: timestamp("joined_at", { precision: 6 }).defaultNow()
  },
  (table) => ({
    uniqueMembershipPerWorkspace: unique("unique_membership_per_workspace").on(table.accountId, table.workspaceId),
    workspaceMembershipUnique: unique("workspace_membership_unique").on(table.workspaceId, table.accountId),
    accountIdIdx: index("memberships_account_id_idx").on(table.accountId),
    workspaceIdIdx: index("memberships_workspace_id_idx").on(table.workspaceId),
    idxWorkspaceMemberWorkspace: index("idx_workspace_member_workspace").on(table.workspaceId),
    idxWorkspaceMemberAccount: index("idx_workspace_member_account").on(table.accountId),
    idxWorkspaceMemberOrg: index("idx_workspace_member_org").on(table.organizationId),
    idxWorkspaceMemberRole: index("idx_workspace_member_role").on(table.roleId)
  })
);

export const documents = pgTable(
  "documents",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.uuid),
    title: text("title").notNull(),
    documentNumber: varchar("document_number", { length: 100 }),
    documentTypeId: uuid("document_type_id").references(() => categoryItems.uuid),
    fieldId: uuid("field_id").references(() => categoryItems.uuid),
    issuingOrgId: uuid("issuing_org_id").references(() => categoryItems.uuid),
    issuedDate: date("issued_date"),
    effectiveDate: date("effective_date"),
    summary: text("summary"),
    filePath: text("file_path"),
    statusId: uuid("status_id").references(() => categoryItems.uuid),
    createdBy: uuid("created_by").references(() => accounts.uuid),
    createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 6 }).defaultNow(),
    deletedAt: timestamp("deleted_at", { precision: 6 })
  },
  (table) => ({
    idxDocumentNumber: index("idx_document_number").on(table.documentNumber),
    idxDocumentWorkspace: index("idx_document_workspace").on(table.workspaceId)
  })
);

export const ocrResults = pgTable("ocr_results", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  documentId: uuid("document_id").references(() => documents.uuid),
  rawText: text("raw_text"),
  confidence: numeric("confidence"),
  createdAt: timestamp("created_at", { precision: 6 }).defaultNow()
});

export const aiSummary = pgTable("ai_summary", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  documentId: uuid("document_id").references(() => documents.uuid),
  fileId: uuid("file_id").references(() => files.uuid),
  summaryText: text("summary_text"),
  model: varchar("model", { length: 100 }),
  createdAt: timestamp("created_at", { precision: 6 }).defaultNow()
});

export const files = pgTable(
  "files",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: varchar("mime_type", { length: 150 }),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => accounts.uuid),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).defaultNow(),
    deletedAt: timestamp("deleted_at", { precision: 6, withTimezone: true })
  },
  (table) => ({
    idxFilesEntity: index("idx_files_entity").on(table.entityType, table.entityId)
  })
);

export const tasks = pgTable(
  "tasks",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.uuid),
    title: text("title").notNull(),
    description: text("description"),
    documentId: uuid("document_id").references(() => documents.uuid),
    organizationId: uuid("organization_id").references(() => organizations.uuid),
    priority: taskPriorityEnum("priority").default("medium").notNull(),
    status: taskStatusEnum("status").default("new").notNull(),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at", { precision: 6 }),
    createdBy: uuid("created_by").references(() => accounts.uuid),
    createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 6 }).defaultNow(),
    deletedAt: timestamp("deleted_at", { precision: 6 }),
    parentTaskId: uuid("parent_id"),
    warningDeadlineDays: smallint("warning_deadline_days"),
    fieldId: uuid("field_id").references(() => categoryItems.uuid),
    issuedDate: date("issued_date")
  },
  (table) => ({
    idxTasksWorkspace: index("idx_tasks_workspace").on(table.workspaceId),
    idxTasksStatus: index("idx_tasks_status").on(table.status),
    idxTasksPriority: index("idx_tasks_priority").on(table.priority),
    idxTasksDueDate: index("idx_tasks_due_date").on(table.dueDate)
  })
);

export const taskDeployingDocs = pgTable("task_deploying_docs", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.uuid),
  taskId: uuid("task_id").references(() => tasks.uuid),
  documentId: uuid("document_id").references(() => documents.uuid),
  createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
  updatedAt: timestamp("updated_at", { precision: 6 }).defaultNow(),
  deletedAt: timestamp("deleted_at", { precision: 6 })
});

export const taskAssignments = pgTable(
  "task_assignments",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    taskId: uuid("task_id").references(() => tasks.uuid),
    assignedToAccountId: uuid("assigned_to_account_id").references(() => accounts.uuid),
    assignedToOrgId: uuid("assigned_to_org_id").references(() => organizations.uuid),
    assignedBy: uuid("assigned_by").references(() => accounts.uuid),
    assignedAt: timestamp("assigned_at", { precision: 6 }).defaultNow(),
    dueDate: date("due_date"),
    statusId: uuid("status_id").references(() => categoryItems.uuid),
    isCoordination: boolean("is_coordination").default(false),
    startDate: date("start_date"),
    finishDate: date("finish_date"),
    status: taskStatusEnum("status").default("new").notNull()
  },
  (table) => ({
    idxTaskAssignUser: index("idx_task_assign_user").on(table.assignedToAccountId)
  })
);

export const taskProgress = pgTable("task_progress", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  taskId: uuid("task_id").references(() => tasks.uuid),
  progressPercent: integer("progress_percent"),
  comment: text("comment"),
  updatedBy: uuid("updated_by").references(() => accounts.uuid),
  createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
  organizationId: uuid("organization_id").references(() => organizations.uuid)
});

export const taskAssignmentProgress = pgTable("task_assignment_progress", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  taskAssignmentId: uuid("task_assignment_id").references(() => taskAssignments.uuid),
  progressPercent: integer("progress_percent"),
  comment: text("comment"),
  updatedBy: uuid("updated_by").references(() => accounts.uuid),
  createdBy: uuid("created_by").references(() => accounts.uuid),
  createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
  organizationId: uuid("organization_id").references(() => organizations.uuid)
});

export const taskComments = pgTable("task_comments", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  taskId: uuid("task_id").references(() => tasks.uuid),
  accountId: uuid("account_id").references(() => accounts.uuid),
  content: text("content"),
  createdAt: timestamp("created_at", { precision: 6 }).defaultNow()
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    targetId: uuid("target_id"),
    targetEmail: text("target_email"),
    details: jsonb("details"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    workspaceId: uuid("workspace_id"),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).defaultNow()
  },
  (table) => ({
    actionIdx: index("audit_logs_action_idx").on(table.action),
    actorIdIdx: index("audit_logs_actor_id_idx").on(table.actorId),
    entityTypeIdx: index("audit_logs_entity_type_idx").on(table.entityType),
    entityIdIdx: index("audit_logs_entity_id_idx").on(table.entityId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
    workspaceIdIdx: index("audit_logs_workspace_id_idx").on(table.workspaceId)
  })
);

export const notifications = pgTable(
  "notifications",
  {
    uuid: uuid("uuid").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id"),
    title: text("title"),
    message: text("message"),
    created_at: timestamp("created_at", { precision: 6 }).defaultNow(),
    type: varchar("type", { length: 50 }),
    status: varchar("status", { length: 50 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>()
  },
  (table) => ({
    idxNotificationWorkspace: index("idx_notification_workspace").on(table.workspaceId)
  })
);

export const taskNotifications = pgTable(
  "task_notifications",
  {
    uuid: uuid("uuid").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.uuid),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.uuid),
    status: varchar("status", { length: 50 }).default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    workspaceId: uuid("workspace_id")
  },
  (table) => ({
    uniqueTaskNotification: unique("unique_task_notification").on(table.taskId, table.notificationId),
    idxTaskNotificationsTaskId: index("idx_task_notifications_task_id").on(table.taskId),
    idxTaskNotificationsNotificationId: index("idx_task_notifications_notification_id").on(table.notificationId)
  })
);

export const userNotifications = pgTable(
  "user_notifications",
  {
    uuid: uuid("uuid").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => accounts.uuid),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.uuid),
    isRead: boolean("is_read").default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    workspaceId: uuid("workspace_id")
  },
  (table) => ({
    uniqueUserNotification: unique("unique_user_notification").on(table.userId, table.notificationId),
    idxUserNotificationsUserId: index("idx_user_notifications_user_id").on(table.userId),
    idxUserNotificationsIsRead: index("idx_user_notifications_is_read").on(table.isRead),
    idxUserNotificationsUnread: index("idx_user_notifications_unread").on(table.userId, table.isRead)
  })
);

export const notificationJobs = pgTable(
  "notification_jobs",
  {
    uuid: uuid("uuid").primaryKey().defaultRandom(),
    taskId: uuid("task_id").references(() => tasks.uuid),
    notificationType: varchar("notification_type", { length: 50 }).notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    status: varchar("status", { length: 50 }).default("pending"),
    retryCount: integer("retry_count").default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    workspaceId: uuid("workspace_id")
  },
  (table) => ({
    idxNotificationJobsStatus: index("idx_notification_jobs_status").on(table.status),
    idxNotificationJobsScheduledAt: index("idx_notification_jobs_scheduled_at").on(table.scheduledAt)
  })
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.uuid, { onDelete: "cascade" }),
    email: text("email").notNull(),
    success: boolean("success").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    reasonCode: text("reason_code"),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).defaultNow()
  },
  (table) => ({
    idxLoginAttemptsAccountId: index("idx_login_attempts_account_id").on(table.accountId),
    idxLoginAttemptsCreatedAt: index("idx_login_attempts_created_at").on(table.createdAt.desc()),
    idxLoginAttemptsEmail: index("idx_login_attempts_email").on(table.email),
    idxLoginAttemptsSuccess: index("idx_login_attempts_success").on(table.success)
  })
);

export const features = pgTable(
  "features",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.uuid, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    code: varchar("code", { length: 100 }).notNull(),
    icon: varchar("icon", { length: 255 }),
    path: varchar("path", { length: 255 }).notNull(),
    groupName: varchar("group_name", { length: 100 }).notNull(),
    enabled: boolean("enabled").default(true),
    requiredPermissionCode: varchar("required_permission_code", { length: 120 }),
    requiresSuperAdmin: boolean("requires_super_admin").default(false),
    requiresWorkspaceAdmin: boolean("requires_workspace_admin").default(false),
    orderIndex: integer("order_index").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    createdBy: uuid("created_by").references(() => accounts.uuid),
    updatedBy: uuid("updated_by").references(() => accounts.uuid)
  },
  (table) => ({
    idxFeaturesWorkspaceId: index("idx_features_workspace_id").on(table.workspaceId),
    idxFeaturesGroupName: index("idx_features_group_name").on(table.groupName),
    idxFeaturesEnabled: index("idx_features_enabled").on(table.enabled),
    idxFeaturesWorkspaceEnabled: index("idx_features_workspace_enabled").on(table.workspaceId, table.enabled),
    uniqueWorkspaceFeatureCode: unique("unique_workspace_feature_code").on(table.workspaceId, table.code)
  })
);

export const featureSubItems = pgTable(
  "feature_sub_items",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    featureId: uuid("feature_id")
      .notNull()
      .references(() => features.uuid, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    path: varchar("path", { length: 255 }).notNull(),
    orderIndex: integer("order_index").default(0),
    isNew: boolean("is_new").default(false),
    isPro: boolean("is_pro").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
  },
  (table) => ({
    idxFeatureSubItemsFeatureId: index("idx_feature_sub_items_feature_id").on(table.featureId)
  })
);

export const accountRelations = relations(accounts, ({ many }) => ({
  workspaces: many(workspaceMemberships),
  profiles: many(profiles),
  loginAttempts: many(loginAttempts),
  featuresCreated: many(features, { relationName: "createdBy" }),
  featuresUpdated: many(features, { relationName: "updatedBy" })
}));

export const workspaceRelations = relations(workspaces, ({ one, many }) => ({
  account: one(accounts, {
    fields: [workspaces.accountId],
    references: [accounts.uuid]
  }),
  profiles: many(profiles),
  memberships: many(workspaceMemberships),
  features: many(features)
}));

export const profileRelations = relations(profiles, ({ one }) => ({
  account: one(accounts, {
    fields: [profiles.accountId],
    references: [accounts.uuid]
  }),
  workspace: one(workspaces, {
    fields: [profiles.workspaceId],
    references: [workspaces.uuid]
  })
}));

export const workspaceMembershipsRelations = relations(workspaceMemberships, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMemberships.workspaceId],
    references: [workspaces.uuid]
  }),
  account: one(accounts, {
    fields: [workspaceMemberships.accountId],
    references: [accounts.uuid]
  }),
  organization: one(organizations, {
    fields: [workspaceMemberships.organizationId],
    references: [organizations.uuid]
  }),
  position: one(categoryItems, {
    fields: [workspaceMemberships.positionId],
    references: [categoryItems.uuid]
  }),
  role: one(roles, {
    fields: [workspaceMemberships.roleId],
    references: [roles.id]
  })
}));

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  actor: one(accounts, {
    fields: [auditLogs.actorId],
    references: [accounts.uuid]
  }),
  target: one(accounts, {
    fields: [auditLogs.targetId],
    references: [accounts.uuid]
  }),
  workspace: one(workspaces, {
    fields: [auditLogs.workspaceId],
    references: [workspaces.uuid]
  })
}));

export const featureRelations = relations(features, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [features.workspaceId],
    references: [workspaces.uuid]
  }),
  createdByUser: one(accounts, {
    fields: [features.createdBy],
    references: [accounts.uuid],
    relationName: "createdBy"
  }),
  updatedByUser: one(accounts, {
    fields: [features.updatedBy],
    references: [accounts.uuid],
    relationName: "updatedBy"
  }),
  subItems: many(featureSubItems),
  roleFeatures: many(roleFeatures)
}));

export const featureSubItemRelations = relations(featureSubItems, ({ one }) => ({
  feature: one(features, {
    fields: [featureSubItems.featureId],
    references: [features.uuid]
  })
}));

export const roleFeaturesRelations = relations(roleFeatures, ({ one }) => ({
  role: one(roles, {
    fields: [roleFeatures.roleId],
    references: [roles.id]
  }),
  feature: one(features, {
    fields: [roleFeatures.featureId],
    references: [features.uuid]
  })
}));

export const roleRelations = relations(roles, ({ many }) => ({
  roleFeatures: many(roleFeatures),
  rolePermissions: many(rolePermissions)
}));

export const accountInsertSchema = createInsertSchema(accounts);
export const accountSelectSchema = createSelectSchema(accounts);
export const accountUpdateSchema = createUpdateSchema(accounts);

export const workspaceInsertSchema = createInsertSchema(workspaces);
export const workspaceSelectSchema = createSelectSchema(workspaces);

export const profileInsertSchema = createInsertSchema(profiles);
export const profileSelectSchema = createSelectSchema(profiles);

export const workspaceMembershipInsertSchema = createInsertSchema(workspaceMemberships);
export const workspaceMembershipSelectSchema = createSelectSchema(workspaceMemberships);

export const auditLogInsertSchema = createInsertSchema(auditLogs);
export const auditLogSelectSchema = createSelectSchema(auditLogs);

export const systemConfigInsertSchema = createInsertSchema(systemConfigs);
export const systemConfigSelectSchema = createSelectSchema(systemConfigs);

export const loginAttemptInsertSchema = createInsertSchema(loginAttempts);
export const loginAttemptSelectSchema = createSelectSchema(loginAttempts);

export const featureInsertSchema = createInsertSchema(features);
export const featureSelectSchema = createSelectSchema(features);
export const featureUpdateSchema = createUpdateSchema(features);

export const featureSubItemInsertSchema = createInsertSchema(featureSubItems);
export const featureSubItemSelectSchema = createSelectSchema(featureSubItems);
export const featureSubItemUpdateSchema = createUpdateSchema(featureSubItems);

export const roleFeaturesInsertSchema = createInsertSchema(roleFeatures);
export const roleFeaturesSelectSchema = createSelectSchema(roleFeatures);

export type AccountInsertType = InferInsertModel<typeof accounts>;
export type AccountSelectType = InferSelectModel<typeof accounts>;

export type WorkspaceInsertType = InferInsertModel<typeof workspaces>;
export type WorkspaceSelectType = InferSelectModel<typeof workspaces>;

export type ProfileInsertType = InferInsertModel<typeof profiles>;
export type ProfileSelectType = InferSelectModel<typeof profiles>;

export type WorkspaceMembershipInsertType = InferInsertModel<typeof workspaceMemberships>;
export type WorkspaceMembershipSelectType = InferSelectModel<typeof workspaceMemberships>;

export type AuditLogInsertType = InferInsertModel<typeof auditLogs>;
export type AuditLogSelectType = InferSelectModel<typeof auditLogs>;

export type SystemConfigInsertType = InferInsertModel<typeof systemConfigs>;
export type SystemConfigSelectType = InferSelectModel<typeof systemConfigs>;

export type LoginAttemptInsertType = InferInsertModel<typeof loginAttempts>;
export type LoginAttemptSelectType = InferSelectModel<typeof loginAttempts>;

export type FeatureInsertType = InferInsertModel<typeof features>;
export type FeatureSelectType = InferSelectModel<typeof features>;

export type FeatureSubItemInsertType = InferInsertModel<typeof featureSubItems>;
export type FeatureSubItemSelectType = InferSelectModel<typeof featureSubItems>;

export type RoleFeaturesInsertType = InferInsertModel<typeof roleFeatures>;
export type RoleFeaturesSelectType = InferSelectModel<typeof roleFeatures>;

export type AccountWithRelations = AccountSelectType & {
  workspaces: WorkspaceMembershipSelectType[];
  profiles: Pick<ProfileSelectType, "uuid" | "name" | "workspaceId">[];
};
