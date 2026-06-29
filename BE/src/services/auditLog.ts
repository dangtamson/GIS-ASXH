import { db } from "@/services/db/drizzle.ts";
import { auditLogs, accounts } from "@/schema.ts";
import { logger } from "@/helpers/index.ts";
import { getIpFromRequest } from "@/helpers/request.ts";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { type DbTransaction } from "@/types/database.ts";

export interface AuditLogData {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  targetId?: string;
  details?: Record<string, unknown>;
  workspaceId?: string;
}

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  actorEmail?: string;
  targetEmail?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  data: AuditLogData,
  req?: Request,
  context?: Partial<AuditContext>,
  tx?: DbTransaction
): Promise<void> {
  try {
    // Extract context from request if provided
    const ipAddress = req ? getIpFromRequest(req) : context?.ipAddress;
    const userAgent = req?.headers["user-agent"] || context?.userAgent;

    // Get actor email if not provided
    let actorEmail = context?.actorEmail;
    if (!actorEmail && data.actorId) {
      const [actor] = await db
        .select({ email: accounts.email })
        .from(accounts)
        .where(eq(accounts.uuid, data.actorId))
        .limit(1);
      actorEmail = actor?.email;
    }

    // Get target email if not provided
    let targetEmail = context?.targetEmail;
    if (!targetEmail && data.targetId) {
      const [target] = await db
        .select({ email: accounts.email })
        .from(accounts)
        .where(eq(accounts.uuid, data.targetId))
        .limit(1);
      targetEmail = target?.email;
    }

    // Create audit log entry
    const database = tx || db;
    await database.insert(auditLogs).values({
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      actorId: data.actorId,
      actorEmail: actorEmail || "unknown",
      targetId: data.targetId,
      targetEmail,
      details: data.details,
      ipAddress,
      userAgent,
      workspaceId: data.workspaceId
    });

    logger.info({
      msg: "Audit log created",
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      actorId: data.actorId,
      targetId: data.targetId,
      workspaceId: data.workspaceId
    });
  } catch (error) {
    logger.error({
      msg: "Failed to create audit log",
      error,
      data
    });
    // Don't throw - audit logging failure shouldn't break the main operation
  }
}

/**
 * Predefined audit actions for consistency
 */
export const AUDIT_ACTIONS = {
  // Account actions
  ACCOUNT_CREATED: "account_created",
  ACCOUNT_STATUS_UPDATED: "account_status_updated",
  ACCOUNT_ROLE_UPDATED: "account_role_updated",
  ACCOUNT_UPDATED: "account_updated",

  // Workspace actions
  WORKSPACE_CREATED: "workspace_created",
  WORKSPACE_UPDATED: "workspace_updated",
  WORKSPACE_DELETED: "workspace_deleted",

  // Membership actions
  MEMBER_ADDED: "member_added",
  MEMBER_REMOVED: "member_removed",
  MEMBER_ROLE_UPDATED: "member_role_updated",

  // Authentication actions
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILED: "login_failed",
  SIGNUP_SUCCESS: "signup_success",

  // Admin actions
  ADMIN_ACCESS: "admin_access",
  BULK_OPERATION: "bulk_operation",

  //Content actions
  DOCUMENT_CREATED: "document_created",
  DOCUMENT_UPDATED: "document_updated",
  DOCUMENT_DELETED: "document_deleted",

  // Profile
  PROFILE_CREATED: "profile_created",
  PROFILE_UPDATED: "profile_updated",
  PROFILE_DELETED: "profile_deleted",

  // Organization
  ORGANIZATION_CREATED: "organization_created",
  ORGANIZATION_UPDATED: "organization_updated",
  ORGANIZATION_DELETED: "organization_deleted",

  // Category / Category Item
  CATEGORY_CREATED: "category_created",
  CATEGORY_UPDATED: "category_updated",
  CATEGORY_DELETED: "category_deleted",

  CATEGORY_ITEM_CREATED: "category_item_created",
  CATEGORY_ITEM_UPDATED: "category_item_updated",
  CATEGORY_ITEM_DELETED: "category_item_deleted",

  // Task
  TASK_CREATED: "task_created",
  TASK_UPDATED: "task_updated",
  TASK_DELETED: "task_deleted",
  TASK_STATUS_UPDATED: "task_status_updated",

  // Task Assignment
  TASK_ASSIGNED: "task_assigned",
  TASK_UNASSIGNED: "task_unassigned",

  // Task Progress
  TASK_PROGRESS_UPDATED: "task_progress_updated",

  // Task Comment
  TASK_COMMENT_ADDED: "task_comment_added",
  TASK_COMMENT_DELETED: "task_comment_deleted",

  // File / Upload
  FILE_UPLOADED: "file_uploaded",
  FILE_DELETED: "file_deleted",

  // OCR / AI
  OCR_PROCESSED: "ocr_processed",
  AI_SUMMARY_GENERATED: "ai_summary_generated",

  // Feature
  FEATURE_CREATED: "feature_created",
  FEATURE_UPDATED: "feature_updated",
  FEATURE_DELETED: "feature_deleted",

  // Notification
  NOTIFICATION_CREATED: "notification_created",
  NOTIFICATION_SENT: "notification_sent",
  NOTIFICATION_READ: "notification_read",

  // System config
  SYSTEM_CONFIG_UPDATED: "system_config_updated"
} as const;

/**
 * Entity types for audit logs
 */
export const ENTITY_TYPES = {
  ACCOUNT: "account",
  WORKSPACE: "workspace",
  MEMBERSHIP: "membership",
  PROFILE: "profile",
  AUDIT_LOG: "audit_log",
  DOCUMENT: "document",
  ORGANIZATION: "organization",
  CATEGORY: "category",
  CATEGORY_ITEM: "category_item",

  TASK: "task",
  TASK_ASSIGNMENT: "task_assignment",
  TASK_PROGRESS: "task_progress",
  TASK_COMMENT: "task_comment",

  FILE: "file",
  OCR_RESULT: "ocr_result",
  AI_SUMMARY: "ai_summary",

  FEATURE: "feature",
  FEATURE_SUB_ITEM: "feature_sub_item",

  NOTIFICATION: "notification",
  USER_NOTIFICATION: "user_notification",
  TASK_NOTIFICATION: "task_notification",

  SYSTEM_CONFIG: "system_config"
} as const;

/**
 * Convenience functions for common audit operations
 */
export const auditHelpers = {
  /**
   * Log account status change
   */
  accountStatusChanged: async (
    actorId: string,
    targetId: string,
    oldStatus: string,
    newStatus: string,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.ACCOUNT_STATUS_UPDATED,
        entityType: ENTITY_TYPES.ACCOUNT,
        entityId: targetId,
        actorId,
        targetId,
        details: { oldStatus, newStatus }
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log role change
   */
  roleChanged: async (
    actorId: string,
    targetId: string,
    oldRole: boolean,
    newRole: boolean,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.ACCOUNT_ROLE_UPDATED,
        entityType: ENTITY_TYPES.ACCOUNT,
        entityId: targetId,
        actorId,
        targetId,
        details: {
          oldRole: oldRole ? "SuperAdmin" : "User",
          newRole: newRole ? "SuperAdmin" : "User"
        }
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log workspace member role change
   */
  memberRoleChanged: async (
    actorId: string,
    targetId: string,
    workspaceId: string,
    oldRole: string,
    newRole: string,
    req?: Request
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.MEMBER_ROLE_UPDATED,
        entityType: ENTITY_TYPES.MEMBERSHIP,
        entityId: `${workspaceId}-${targetId}`, // Composite identifier
        actorId,
        targetId,
        workspaceId,
        details: { oldRole, newRole }
      },
      req
    );
  },

  /**
   * Log document creation
   */
  documentCreated: async (
    actorId: string,
    documentId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.DOCUMENT_CREATED,
        entityType: ENTITY_TYPES.DOCUMENT,
        entityId: documentId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log document update
   */
  documentUpdated: async (
    actorId: string,
    documentId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.DOCUMENT_UPDATED,
        entityType: ENTITY_TYPES.DOCUMENT,
        entityId: documentId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log document deletion
   */
  documentDeleted: async (
    actorId: string,
    documentId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.DOCUMENT_DELETED,
        entityType: ENTITY_TYPES.DOCUMENT,
        entityId: documentId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log category creation
   */
  categoryCreated: async (
    actorId: string,
    categoryId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.CATEGORY_CREATED,
        entityType: ENTITY_TYPES.CATEGORY,
        entityId: categoryId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log category update
   */
  categoryUpdated: async (
    actorId: string,
    categoryId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.CATEGORY_UPDATED,
        entityType: ENTITY_TYPES.CATEGORY,
        entityId: categoryId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log category deletion
   */
  categoryDeleted: async (
    actorId: string,
    categoryId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.CATEGORY_DELETED,
        entityType: ENTITY_TYPES.CATEGORY,
        entityId: categoryId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log category item creation
   */
  categoryItemCreated: async (
    actorId: string,
    categoryItemId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.CATEGORY_ITEM_CREATED,
        entityType: ENTITY_TYPES.CATEGORY_ITEM,
        entityId: categoryItemId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log category item update
   */
  categoryItemUpdated: async (
    actorId: string,
    categoryItemId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.CATEGORY_ITEM_UPDATED,
        entityType: ENTITY_TYPES.CATEGORY_ITEM,
        entityId: categoryItemId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log category item deletion
   */
  categoryItemDeleted: async (
    actorId: string,
    categoryItemId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.CATEGORY_ITEM_DELETED,
        entityType: ENTITY_TYPES.CATEGORY_ITEM,
        entityId: categoryItemId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log organization creation
   */
  organizationCreated: async (
    actorId: string,
    organizationId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.ORGANIZATION_CREATED,
        entityType: ENTITY_TYPES.ORGANIZATION,
        entityId: organizationId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log organization update
   */
  organizationUpdated: async (
    actorId: string,
    organizationId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.ORGANIZATION_UPDATED,
        entityType: ENTITY_TYPES.ORGANIZATION,
        entityId: organizationId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  },

  /**
   * Log organization deletion
   */
  organizationDeleted: async (
    actorId: string,
    organizationId: string,
    workspaceId: string,
    details?: Record<string, unknown>,
    req?: Request,
    tx?: DbTransaction
  ): Promise<void> => {
    await createAuditLog(
      {
        action: AUDIT_ACTIONS.ORGANIZATION_DELETED,
        entityType: ENTITY_TYPES.ORGANIZATION,
        entityId: organizationId,
        actorId,
        workspaceId,
        details
      },
      req,
      undefined,
      tx
    );
  }
};
