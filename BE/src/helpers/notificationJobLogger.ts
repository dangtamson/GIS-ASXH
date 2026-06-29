// src/helpers/notificationJobLogger.ts
/**
 * Structured logging for notification jobs
 * Provides consistent log format across worker, service, and admin operations
 */

import pino from 'pino';

export interface JobLogContext {
    jobId?: string;
    taskId?: string;
    workspaceId: string;
    userId?: string;
    operation: 'query' | 'create' | 'process' | 'claim' | 'complete' | 'fail';
}

export class NotificationJobLogger {
    private logger: pino.Logger;

    constructor(logger: pino.Logger) {
        this.logger = logger;
    }

    /**
     * Log job operation with context
     */
    log(context: JobLogContext, message: string, data?: any) {
        this.logger.info({
            jobId: context.jobId,
            taskId: context.taskId,
            workspaceId: context.workspaceId,
            userId: context.userId,
            operation: context.operation,
            ...data,
        }, message);
    }

    /**
     * Log job error
     */
    error(context: JobLogContext, message: string, error?: Error | any) {
        this.logger.error({
            jobId: context.jobId,
            taskId: context.taskId,
            workspaceId: context.workspaceId,
            userId: context.userId,
            operation: context.operation,
            error: error?.message || error,
            stack: error?.stack,
        }, message);
    }

    /**
     * Log job debug info
     */
    debug(context: JobLogContext, message: string, data?: any) {
        this.logger.debug({
            jobId: context.jobId,
            taskId: context.taskId,
            workspaceId: context.workspaceId,
            userId: context.userId,
            operation: context.operation,
            ...data,
        }, message);
    }

    /**
     * Log job completion with metrics
     */
    logCompletion(
        context: JobLogContext,
        metrics: {
            duration: number; // ms
            recipientCount: number;
            emailsSent: number;
            status: 'success' | 'partial' | 'failed';
            error?: string;
        }
    ) {
        this.log(
            { ...context, operation: 'complete' },
            'Job completed',
            metrics
        );
    }

    /**
     * Log retry attempt
     */
    logRetry(
        context: JobLogContext,
        retryCount: number,
        nextRetryAt: Date
    ) {
        this.log(
            { ...context, operation: 'fail' },
            `Job failed, retry attempt ${retryCount}`,
            {
                retryCount,
                nextRetryAt: nextRetryAt.toISOString(),
                backoffMs: this.calculateBackoffMs(retryCount),
            }
        );
    }

    /**
     * Calculate backoff milliseconds for retry attempt
     * Exponential backoff: 1m → 2m → 4m
     */
    private calculateBackoffMs(retryCount: number): number {
        return Math.pow(2, retryCount) * 60000;
    }
}

export const createNotificationJobLogger = (logger: pino.Logger) => {
    return new NotificationJobLogger(logger);
};
