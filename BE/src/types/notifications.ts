/**
 * Notification System Type Definitions
 * Provides comprehensive typing for notification pipeline, jobs, and admin operations
 */

export interface INotification {
    id: string; // UUID
    workspace_id: string;
    title: string;
    message: string;
    type: 'due_soon' | 'overdue' | 'custom';
    status: 'pending' | 'sent' | 'failed';
    metadata: Record<string, unknown>; // JSONB - task details, priority, etc.
    created_at: Date;
    updated_at?: Date;
}

export interface ITaskNotification {
    id: string; // UUID
    task_id: string;
    notification_id: string;
    status: 'pending' | 'sent';
    sent_at?: Date;
    workspace_id: string;
    created_at: Date;
}

export interface IUserNotification {
    id: string; // UUID
    user_id: string;
    notification_id: string;
    is_read: boolean;
    read_at?: Date;
    workspace_id: string;
    created_at: Date;
}

export interface INotificationJob {
    id: string; // UUID
    task_id: string;
    notification_type: 'due_soon' | 'email' | 'custom';
    scheduled_at: Date;
    processed_at?: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    retry_count: number; // 0-3
    error?: string; // Error message if failed
    workspace_id: string;
    created_at: Date;
    updated_at?: Date;
}

/**
 * Pipeline Context - carries state through notification processing
 */
export interface NotificationPipelineContext {
    workspaceId: string;
    dryRun: boolean;
    batchSize: number;
    logger: any; // pino.Logger
    startTime: Date;
}

/**
 * Result from processing a single task notification
 */
export interface NotificationJobResult {
    success: boolean;
    jobId?: string;
    taskId: string;
    recipientCount: number;
    emailsSent: number;
    error?: string;
}

/**
 * Stats for a workspace's notification system
 */
export interface INotificationStats {
    workspaceId: string;
    pendingJobs: number; // Jobs waiting to be processed
    failedJobs: number; // Jobs that failed all retries
    unreadNotifications: number; // User notifications not yet marked read
}

/**
 * Admin trigger operation request
 */
export interface AdminTriggerRequest {
    workspaceId?: string; // Uses header if omitted
    dryRun?: boolean; // Default: false
    batchSize?: number; // Default: 50
}

/**
 * Admin trigger operation response
 */
export interface AdminTriggerResponse {
    mode: 'dry-run' | 'live';
    workspaceId: string;
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    results: NotificationJobResult[];
}

/**
 * Email configuration from systemConfigs
 */
export interface IEmailConfig {
    senderName: string;
    senderEmail: string;
    replyTo?: string;
    smtpHost: string;
    smtpPort: number;
    username: string;
    password: string;
    useTls?: boolean;
    useSsl?: boolean;
    allowInvalidCert?: boolean;
}

/**
 * Notification metadata - stored as JSONB in notifications.metadata
 */
export interface INotificationMetadata {
    taskId?: string;
    taskTitle?: string;
    dueDate?: string; // ISO date
    priority?: 'low' | 'medium' | 'high';
    assignedBy?: string; // User ID
    customData?: Record<string, unknown>;
}

/**
 * Task assignment for notification delivery
 */
export interface ITaskAssignment {
    id: string;
    task_id: string;
    user_id: string;
    workspace_id: string;
    assigned_at: Date;
}

/**
 * User account for email delivery
 */
export interface IAccount {
    id: string;
    workspace_id: string;
    email: string;
    full_name?: string;
    created_at: Date;
}

/**
 * Task for notification processing
 */
export interface ITask {
    uuid: string; // Task ID
    workspace_id: string;
    title: string;
    due_date: Date;
    warning_deadline_days: number; // Days before due date to alert
    status: string;
    deleted_at?: Date;
}

/**
 * Worker/Job configuration
 */
export interface WorkerConfig {
    workspaceId?: string; // If provided, process only this workspace
    pollIntervalMs: number; // How often to check for pending jobs
    batchSize: number; // How many tasks to process per cycle
    maxRetries: number; // Max retry attempts before failing
    dryRun: boolean; // If true, don't actually send emails
    once: boolean; // If true, run one cycle and exit
}

/**
 * Repository functions signature (for type safety)
 */
export interface INotificationRepository {
    queryTasksDueSoon: (
        workspaceId: string,
        batchSize: number
    ) => Promise<ITask[]>;

    getTaskAssignees: (taskId: string) => Promise<IAccount[]>;

    createNotificationWithIdempotency: (
        notification: Omit<INotification, 'id' | 'created_at'>
    ) => Promise<INotification>;

    linkTaskNotification: (
        taskId: string,
        notificationId: string,
        workspaceId: string
    ) => Promise<void>;

    linkUserNotification: (
        userId: string,
        notificationId: string,
        workspaceId: string
    ) => Promise<void>;

    createNotificationJob: (
        job: Omit<INotificationJob, 'id' | 'created_at' | 'updated_at'>
    ) => Promise<INotificationJob>;

    claimNotificationJob: (jobId: string) => Promise<boolean>;

    markJobProcessed: (
        jobId: string,
        recipientCount: number
    ) => Promise<void>;

    markJobFailed: (jobId: string, error: string) => Promise<void>;

    getPendingJobsDue: (
        workspaceId: string,
        batchSize: number
    ) => Promise<INotificationJob[]>;

    getFailedJobs: (workspaceId: string) => Promise<INotificationJob[]>;

    markUserNotificationRead: (
        userId: string,
        notificationId: string
    ) => Promise<void>;

    getNotificationStats: (workspaceId: string) => Promise<INotificationStats>;
}

/**
 * Service functions signature (for type safety)
 */
export interface INotificationService {
    processDueSoonNotifications: (
        context: NotificationPipelineContext
    ) => Promise<NotificationJobResult[]>;

    processSingleTaskNotification: (
        task: ITask,
        context: NotificationPipelineContext
    ) => Promise<NotificationJobResult>;

    processPendingEmailJobs: (
        workspaceId: string,
        dryRun?: boolean
    ) => Promise<void>;

    getNotificationStats: (workspaceId: string) => Promise<INotificationStats>;
}

/**
 * Express Request extensions for type safety
 */
export interface AuthenticatedRequest {
    user: {
        id: string;
        email: string;
        role: string;
    };
    workspace?: {
        id: string;
        name: string;
    };
}
