import {
  createTaskAdmin,
  createTaskAssignmentAdmin,
  createTaskCommentAdmin,
  createTaskProgressAdmin,
  deleteTaskAdminById,
  deleteTaskAssignmentAdminById,
  deleteTaskCommentAdminById,
  deleteTaskProgressAdminById,
  getTaskAdminById,
  receiveTaskById,
  sendTaskApprovalDataById,
  approveTaskDataById,
  rejectTaskApprovalDataById,
  sendTaskPromulgateDataById,
  getTaskAssignmentAdminById,
  getTaskCommentAdminById,
  getTaskProgressAdminById,
  listTaskAssignmentsAdmin,
  listTaskCommentsAdmin,
  listTaskProgressAdmin,
  updateTaskAdminById,
  updateTaskAssignmentAdminById,
  updateTaskCommentAdminById,
  updateTaskProgressAdminById,
  createTaskAssignmentProgressAdmin,
  deleteTaskAssignmentProgressAdminById,
  updateTaskAssignmentProgressAdminById,
  getTaskAssignmentProgressAdminById,
  listTaskAssignmentProgressAdmin,
  getTaskAdminReminder,
  listTasksAssignmentAdmin,
  listTasksAssignedAdmin,
  listTasksParentOptionsAdmin,
  listTasksReviewAdmin
} from "@/handlers/admin/resources/workflow/index.ts";
import type { Application, RequestHandler } from "express";
import { API_ROUTES } from "@/helpers/permissions.ts";

export function registerWorkflowAdminRoutes(app: Application, guards: readonly RequestHandler[]): void {
  app.get(API_ROUTES.adminTasksParentOptions, ...guards, listTasksParentOptionsAdmin);
  app.get(API_ROUTES.adminTasksAssignments, ...guards, listTasksAssignmentAdmin);
  app.get(API_ROUTES.adminTasksAssigned, ...guards, listTasksAssignedAdmin);
  app.get(API_ROUTES.adminTasksReviews, ...guards, listTasksReviewAdmin);
  app.post(API_ROUTES.adminTasks, ...guards, createTaskAdmin);
  app.get(API_ROUTES.adminTasksRemind, ...guards, getTaskAdminReminder);
  app.get(API_ROUTES.adminTaskById, ...guards, getTaskAdminById);
  app.patch(API_ROUTES.adminTaskById, ...guards, updateTaskAdminById);
  app.delete(API_ROUTES.adminTaskById, ...guards, deleteTaskAdminById);
  app.post(API_ROUTES.adminTaskReceive, ...guards, receiveTaskById);
  app.post(API_ROUTES.adminTaskSendApprovalData, ...guards, sendTaskApprovalDataById);
  app.post(API_ROUTES.adminTaskApproveData, ...guards, approveTaskDataById);
  app.post(API_ROUTES.adminTaskRejectApprovalData, ...guards, rejectTaskApprovalDataById);
  app.post(API_ROUTES.adminTaskSendPromulgateData, ...guards, sendTaskPromulgateDataById);

  app.get(API_ROUTES.adminTaskComments, ...guards, listTaskCommentsAdmin);
  app.post(API_ROUTES.adminTaskComments, ...guards, createTaskCommentAdmin);
  app.get(API_ROUTES.adminTaskCommentById, ...guards, getTaskCommentAdminById);
  app.patch(API_ROUTES.adminTaskCommentById, ...guards, updateTaskCommentAdminById);
  app.delete(API_ROUTES.adminTaskCommentById, ...guards, deleteTaskCommentAdminById);

  app.get(API_ROUTES.adminTaskProgress, ...guards, listTaskProgressAdmin);
  app.post(API_ROUTES.adminTaskProgress, ...guards, createTaskProgressAdmin);
  app.get(API_ROUTES.adminTaskProgressById, ...guards, getTaskProgressAdminById);
  app.patch(API_ROUTES.adminTaskProgressById, ...guards, updateTaskProgressAdminById);
  app.delete(API_ROUTES.adminTaskProgressById, ...guards, deleteTaskProgressAdminById);

  app.get(API_ROUTES.adminTaskAssignmentProgress, ...guards, listTaskAssignmentProgressAdmin);
  app.post(API_ROUTES.adminTaskAssignmentProgress, ...guards, createTaskAssignmentProgressAdmin);
  app.get(API_ROUTES.adminTaskAssignmentProgressById, ...guards, getTaskAssignmentProgressAdminById);
  app.patch(API_ROUTES.adminTaskAssignmentProgressById, ...guards, updateTaskAssignmentProgressAdminById);
  app.delete(API_ROUTES.adminTaskAssignmentProgressById, ...guards, deleteTaskAssignmentProgressAdminById);

  app.get(API_ROUTES.adminTaskAssignments, ...guards, listTaskAssignmentsAdmin);
  app.post(API_ROUTES.adminTaskAssignments, ...guards, createTaskAssignmentAdmin);
  app.get(API_ROUTES.adminTaskAssignmentById, ...guards, getTaskAssignmentAdminById);
  app.patch(API_ROUTES.adminTaskAssignmentById, ...guards, updateTaskAssignmentAdminById);
  app.delete(API_ROUTES.adminTaskAssignmentById, ...guards, deleteTaskAssignmentAdminById);
}
