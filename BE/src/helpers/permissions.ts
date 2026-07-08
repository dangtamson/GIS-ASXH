import { logger } from "./logger.ts";

export const API_ROUTES = {
  root: "/",
  login: "/login",
  signUp: "/signup",
  ssoEnabled: "/sso/enabled",
  ssoLoginUrl: "/sso/login-url",
  ssoExchange: "/sso/exchange",
  changePassword: "/auth/change-password",
  me: "/me",
  accounts: "/accounts",
  accountById: "/accounts/:id",
  // profiles: "/profiles", // Removed - access through workspace context
  // profileById: "/profiles/:id", // Removed - access through workspace context
  workspaces: "/workspaces",
  workspaceById: "/workspaces/:id",
  workspaceProfile: "/workspaces/:id/profile",
  workspaceEffectivePermissions: "/workspaces/:id/effective-permissions",
  workspaceAccessReport: "/workspaces/:id/access-report",
  workspaceMembers: "/workspaces/:id/members",
  workspaceMemberRole: "/workspaces/:id/members/:memberId/role",
  workspaceMemberRemove: "/workspaces/:id/members/:memberId",
  // Admin routes
  adminAccounts: "/admin/accounts",
  adminAccountById: "/admin/accounts/:id",
  adminAccountRole: "/admin/accounts/:id/role",
  adminAccountStatus: "/admin/accounts/:id/status",
  adminWorkspaces: "/admin/workspaces",
  adminWorkspaceById: "/admin/workspaces/:id",
  adminMemberships: "/admin/memberships",
  adminSystemConfig: "/admin/system-config",
  adminSystemConfigTestEmail: "/admin/system-config/test-email",
  adminCategories: "/admin/categories",
  adminCategoryById: "/admin/categories/:id",
  adminDocuments: "/content/documents",
  adminDocumentById: "/content/documents/:id",
  adminDocumentFiles: "/content/documents/:id/files",
  adminTasks: "/workflow/tasks",
  adminTasksParentOptions: "/workflow/tasks/parent-options",
  adminTasksAssigned: "/workflow/tasks/assigned",
  adminTasksAssignments: "/workflow/tasks/assignments",
  adminTasksReviews: "/workflow/tasks/reviews",
  adminTasksRemind: "/workflow/tasks/reminders",
  adminTaskById: "/workflow/tasks/:id",
  adminTaskReceive: "/workflow/tasks/:id/receive",
  adminTaskSendApprovalData: "/workflow/tasks/:id/send-approval-data",
  adminTaskApproveData: "/workflow/tasks/:id/approve-data",
  adminTaskRejectApprovalData: "/workflow/tasks/:id/reject-approval-data",
  adminTaskSendPromulgateData: "/workflow/tasks/:id/send-promulgate-data",
  adminOrganizations: "/admin/organizations",
  adminOrganizationById: "/admin/organizations/:id",
  adminFiles: "/content/files",
  adminFileById: "/content/files/:id",
  adminFilePreview: "/content/files/:id/preview",
  adminFileSummary: "/content/files/:id/summary",
  adminFileDownload: "/content/files/:id/download",
  // adminAiSummary: "/content/summary",
  // adminAiSummaryById: "/content/summary/:id",
  adminNotifications: "/content/notifications",
  adminNotificationById: "/content/notifications/:id",
  adminNotificationTriggerDueSoon: "/admin/notifications/trigger-due-soon",
  adminNotificationStats: "/admin/notifications/stats",
  adminNotificationMarkRead: "/admin/notifications/mark-read",
  adminCategoryItems: "/admin/category-items",
  adminCategoryItemById: "/admin/category-items/:id",
  adminRoles: "/admin/roles",
  adminRoleById: "/admin/roles/:id",
  adminPermissions: "/admin/permissions",
  adminPermissionById: "/admin/permissions/:id",
  adminRolePermissions: "/admin/role-permissions",
  adminRolePermissionById: "/admin/role-permissions/:roleId/:permissionId",
  adminRoleFeatures: "/admin/roles/:roleId/features",
  adminAvailableFeatures: "/admin/features/available",
  adminTaskComments: "/workflow/task-comments",
  adminTaskCommentById: "/workflow/task-comments/:id",
  adminTaskProgress: "/workflow/task-progress",
  adminTaskProgressById: "/workflow/task-progress/:id",
  adminTaskAssignmentProgress: "/workflow/task-assignment-progress",
  adminTaskAssignmentProgressById: "/workflow/task-assignment-progress/:id",
  adminTaskAssignments: "/workflow/task-assignments",
  adminTaskAssignmentById: "/workflow/task-assignments/:id",
  adminAuditLogs: "/admin/audit-logs",
  adminAuditLogStats: "/admin/audit-logs/stats",
  adminFeatures: "/admin/features",
  adminFeaturesById: "/admin/features/:featureId",
  adminFeaturesByGroup: "/admin/features/group/:groupName",
  adminFeaturesToggle: "/admin/features/:featureId/toggle",
  adminFeaturesReorder: "/admin/features/reorder",
  adminImportTemplate: "/admin/imports/:module/template",
  adminImportPreview: "/admin/imports/:module/preview",
  adminImportCommit: "/admin/imports/:module/commit",
  reportTaskByDocument: "/report/reportTaskByDocument",
  reportTaskByOrganization: "/report/reportTaskByOrganization",
  reportTaskByField: "/report/reportTaskByField",
  reportTaskByDocumentType: "/report/reportTaskByDocumentType",
  reportTaskDetail: "/report/reportTaskDetail",
  reportTaskDetailExportExcel: "/report/reportTaskDetailExportExcel",
  reportTaskDetailExportPdf: "/report/reportTaskDetailExportPdf",
  reportTaskDashboard: "/report/reportTaskDashboard",
  reportTaskDashboardMainWorkload: "/report/reportTaskDashboardMainWorkload",
  reportTaskDashboardCoordinationWorkload: "/report/reportTaskDashboardCoordinationWorkload",
  reportTaskDashboardTotal: "/report/reportTaskDashboardTotal",
  reportTimelineDashboardTotal: "/report/reportTimelineDashboardTotal",
  povertyHouseholds: "/poverty/households",
  povertyHouseholdsFromMap: "/poverty/households/from-map",
  povertyHouseholdById: "/poverty/households/:id",
  povertyHouseholdMembers: "/poverty/households/:id/members",
  povertyHouseholdMemberById: "/poverty/households/:id/members/:memberId",
  povertyHouseholdAssessments: "/poverty/households/:id/assessments",
  povertyHouseholdAssessmentById: "/poverty/households/:id/assessments/:assessmentId",
  povertyHouseholdContextHistories: "/poverty/households/:id/context-histories",
  povertyHouseholdContextHistoryById: "/poverty/households/:id/context-histories/:contextHistoryId",
  povertyHouseholdSupports: "/poverty/households/:id/supports",
  povertyHouseholdSupportById: "/poverty/households/:id/supports/:supportId",
  povertyHouseholdChangeLogs: "/poverty/households/:id/change-logs",
  povertyHouseholdsImport: "/poverty/households/import-excel",
  povertyHouseholdsExport: "/poverty/households/export-excel",
  povertyGisMarkers: "/poverty/gis/markers",
  povertyGisMarkerPosition: "/poverty/gis/markers/:id/position",
  povertyDashboard: "/poverty/dashboard",
  povertyReportSummary: "/poverty/reports/summary",
  povertyReportExportExcel: "/poverty/reports/export-excel",
  povertyReportDetail: "/poverty/reports/detail",
  povertyReportDetailExportExcel: "/poverty/reports/detail/export-excel",
  povertyLocationProvinces: "/poverty/locations/provinces",
  povertyLocationWards: "/poverty/locations/wards",
  povertyLocationAreas: "/poverty/locations/areas",
  povertyWardPublicLinks: "/poverty/ward-public-links",
  povertyWardOverviews: "/poverty/ward-overviews",
  povertyWardOverviewById: "/poverty/ward-overviews/:id",
  povertyWardAreas: "/poverty/wards/:wardCode/areas",
  povertyWardAreaById: "/poverty/wards/:wardCode/areas/:areaId",
  publicPovertyWardBySlug: "/public/poverty/wards/:slug",
  publicPovertyAreaBySlug: "/public/poverty/wards/:slug/areas/:areaSlug",
  publicPovertyHouseholdBySlug: "/public/poverty/wards/:slug/households/:householdId"
} as const;

export type RouteName = keyof typeof API_ROUTES;

export type Route = (typeof API_ROUTES)[RouteName];

export type Routes = Route[];

export const ROLES = {
  Admin: "admin",
  User: "user",
  Owner: "owner"
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES] | "";

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type Claims = [Role, Method];

const buildCrudPermissionCodes = <TResource extends string>(resource: TResource): {
  View: `${TResource}.view`;
  Create: `${TResource}.create`;
  Update: `${TResource}.update`;
  Delete: `${TResource}.delete`;
} => {
  return {
    View: `${resource}.view`,
    Create: `${resource}.create`,
    Update: `${resource}.update`,
    Delete: `${resource}.delete`
  } as const;
};

const buildReadPermissionCode = <TResource extends string>(resource: TResource): {
  Read: `${TResource}.read`;
} => {
  return {
    Read: `${resource}.read`
  } as const;
};

const RESOURCE_PERMISSION_CODES = {
  Category: buildCrudPermissionCodes("category"),
  Document: buildCrudPermissionCodes("document"),
  Task: buildCrudPermissionCodes("task"),
  Organization: buildCrudPermissionCodes("organization"),
  Notification: buildCrudPermissionCodes("notification"),
  File: buildCrudPermissionCodes("file"),
  Workspace: buildCrudPermissionCodes("workspace"),
  WorkspaceMember: buildCrudPermissionCodes("workspace.member"),
  Account: buildCrudPermissionCodes("account"),
  Audit: buildReadPermissionCode("audit"),
  AdminAccount: buildCrudPermissionCodes("admin.account"),
  AdminRbac: buildCrudPermissionCodes("admin.rbac"),
  PovertyHousehold: buildCrudPermissionCodes("poverty.household"),
  PovertyHouseholdDetail: buildCrudPermissionCodes("poverty.household.detail"),
  PovertyWardOverview: buildCrudPermissionCodes("poverty.ward_overview"),
  PovertyWardArea: buildCrudPermissionCodes("poverty.ward_area"),
  PovertyMap: buildReadPermissionCode("poverty.map"),
  PovertyDashboard: buildReadPermissionCode("poverty.dashboard"),
  PovertyReport: buildReadPermissionCode("poverty.report")
} as const;

export const PERMISSION_CODES = {
  WorkspaceView: RESOURCE_PERMISSION_CODES.Workspace.View,
  WorkspaceCreate: RESOURCE_PERMISSION_CODES.Workspace.Create,
  WorkspaceUpdate: RESOURCE_PERMISSION_CODES.Workspace.Update,
  WorkspaceDelete: RESOURCE_PERMISSION_CODES.Workspace.Delete,
  WorkspaceMemberView: RESOURCE_PERMISSION_CODES.WorkspaceMember.View,
  WorkspaceMemberCreate: RESOURCE_PERMISSION_CODES.WorkspaceMember.Create,
  WorkspaceMemberUpdate: RESOURCE_PERMISSION_CODES.WorkspaceMember.Update,
  WorkspaceMemberDelete: RESOURCE_PERMISSION_CODES.WorkspaceMember.Delete,
  AccountView: RESOURCE_PERMISSION_CODES.Account.View,
  AccountCreate: RESOURCE_PERMISSION_CODES.Account.Create,
  AccountUpdate: RESOURCE_PERMISSION_CODES.Account.Update,
  AccountDelete: RESOURCE_PERMISSION_CODES.Account.Delete,
  CategoryView: RESOURCE_PERMISSION_CODES.Category.View,
  CategoryCreate: RESOURCE_PERMISSION_CODES.Category.Create,
  CategoryUpdate: RESOURCE_PERMISSION_CODES.Category.Update,
  CategoryDelete: RESOURCE_PERMISSION_CODES.Category.Delete,
  DocumentView: RESOURCE_PERMISSION_CODES.Document.View,
  DocumentCreate: RESOURCE_PERMISSION_CODES.Document.Create,
  DocumentUpdate: RESOURCE_PERMISSION_CODES.Document.Update,
  DocumentDelete: RESOURCE_PERMISSION_CODES.Document.Delete,
  TaskView: RESOURCE_PERMISSION_CODES.Task.View,
  TaskCreate: RESOURCE_PERMISSION_CODES.Task.Create,
  TaskUpdate: RESOURCE_PERMISSION_CODES.Task.Update,
  TaskDelete: RESOURCE_PERMISSION_CODES.Task.Delete,
  TaskReceive: "task.receive",
  TaskSendApprovalData: "task.send_approval_data",
  TaskApproveData: "task.approve_data",
  TaskRejectApprovalData: "task.reject_approval_data",
  TaskSendPromulgateData: "task.send_promulgate_data",
  OrganizationView: RESOURCE_PERMISSION_CODES.Organization.View,
  OrganizationCreate: RESOURCE_PERMISSION_CODES.Organization.Create,
  OrganizationUpdate: RESOURCE_PERMISSION_CODES.Organization.Update,
  OrganizationDelete: RESOURCE_PERMISSION_CODES.Organization.Delete,
  NotificationView: RESOURCE_PERMISSION_CODES.Notification.View,
  NotificationCreate: RESOURCE_PERMISSION_CODES.Notification.Create,
  NotificationUpdate: RESOURCE_PERMISSION_CODES.Notification.Update,
  NotificationDelete: RESOURCE_PERMISSION_CODES.Notification.Delete,
  FileView: RESOURCE_PERMISSION_CODES.File.View,
  FileCreate: RESOURCE_PERMISSION_CODES.File.Create,
  FileUpdate: RESOURCE_PERMISSION_CODES.File.Update,
  FileDelete: RESOURCE_PERMISSION_CODES.File.Delete,
  AuditRead: RESOURCE_PERMISSION_CODES.Audit.Read,
  AdminAccountView: RESOURCE_PERMISSION_CODES.AdminAccount.View,
  AdminAccountCreate: RESOURCE_PERMISSION_CODES.AdminAccount.Create,
  AdminAccountUpdate: RESOURCE_PERMISSION_CODES.AdminAccount.Update,
  AdminAccountDelete: RESOURCE_PERMISSION_CODES.AdminAccount.Delete,
  AdminRbacView: RESOURCE_PERMISSION_CODES.AdminRbac.View,
  AdminRbacCreate: RESOURCE_PERMISSION_CODES.AdminRbac.Create,
  AdminRbacUpdate: RESOURCE_PERMISSION_CODES.AdminRbac.Update,
  AdminRbacDelete: RESOURCE_PERMISSION_CODES.AdminRbac.Delete,
  PovertyHouseholdView: RESOURCE_PERMISSION_CODES.PovertyHousehold.View,
  PovertyHouseholdCreate: RESOURCE_PERMISSION_CODES.PovertyHousehold.Create,
  PovertyHouseholdUpdate: RESOURCE_PERMISSION_CODES.PovertyHousehold.Update,
  PovertyHouseholdDelete: RESOURCE_PERMISSION_CODES.PovertyHousehold.Delete,
  PovertyHouseholdImport: "poverty.household.import",
  PovertyHouseholdExport: "poverty.household.export",
  PovertyHouseholdDetailView: RESOURCE_PERMISSION_CODES.PovertyHouseholdDetail.View,
  PovertyHouseholdDetailUpdate: RESOURCE_PERMISSION_CODES.PovertyHouseholdDetail.Update,
  PovertyWardOverviewView: RESOURCE_PERMISSION_CODES.PovertyWardOverview.View,
  PovertyWardOverviewCreate: RESOURCE_PERMISSION_CODES.PovertyWardOverview.Create,
  PovertyWardOverviewUpdate: RESOURCE_PERMISSION_CODES.PovertyWardOverview.Update,
  PovertyWardOverviewDelete: RESOURCE_PERMISSION_CODES.PovertyWardOverview.Delete,
  PovertyWardAreaView: RESOURCE_PERMISSION_CODES.PovertyWardArea.View,
  PovertyWardAreaCreate: RESOURCE_PERMISSION_CODES.PovertyWardArea.Create,
  PovertyWardAreaUpdate: RESOURCE_PERMISSION_CODES.PovertyWardArea.Update,
  PovertyWardAreaDelete: RESOURCE_PERMISSION_CODES.PovertyWardArea.Delete,
  PovertyMapView: RESOURCE_PERMISSION_CODES.PovertyMap.Read,
  PovertyMapCreateHousehold: "poverty.map.create_household",
  PovertyMapUpdatePosition: "poverty.map.update_position",
  PovertyDashboardView: RESOURCE_PERMISSION_CODES.PovertyDashboard.Read,
  PovertyReportView: RESOURCE_PERMISSION_CODES.PovertyReport.Read,
  PovertyReportExport: "poverty.report.export",
  OwnerOnly: "owner"
} as const;

export type ResourcePermissions = {
  [Method: string]: string;
};

export type ResourceMetadata = {
  authenticated: boolean;
  super?: boolean;
  workspaceScoped?: boolean;
  admin?: boolean;
};

export type ResourceWithMeta = {
  permissions: ResourcePermissions;
} & ResourceMetadata;

export type PermissionsMap = Map<Route, ResourceWithMeta>;

export const permissions: PermissionsMap = new Map();

permissions.set(API_ROUTES.root, { permissions: {}, authenticated: false });
permissions.set(API_ROUTES.login, { permissions: {}, authenticated: false });
permissions.set(API_ROUTES.signUp, { permissions: {}, authenticated: false });
permissions.set(API_ROUTES.ssoEnabled, { permissions: {}, authenticated: false });
permissions.set(API_ROUTES.ssoLoginUrl, { permissions: {}, authenticated: false });
permissions.set(API_ROUTES.ssoExchange, { permissions: {}, authenticated: false });
permissions.set(API_ROUTES.changePassword, {
  permissions: { POST: "" },
  authenticated: true
});

permissions.set(API_ROUTES.me, {
  permissions: { GET: "" },
  authenticated: true
});

permissions.set(API_ROUTES.accounts, {
  permissions: {
    GET: PERMISSION_CODES.AdminAccountView,
    POST: PERMISSION_CODES.AdminAccountCreate
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.accountById, {
  permissions: { GET: PERMISSION_CODES.OwnerOnly, PATCH: PERMISSION_CODES.OwnerOnly },
  authenticated: true
});


permissions.set(API_ROUTES.workspaces, {
  permissions: { GET: "", POST: "" },
  authenticated: true
});

permissions.set(API_ROUTES.workspaceById, {
  permissions: {
    GET: PERMISSION_CODES.WorkspaceView,
    PATCH: PERMISSION_CODES.WorkspaceUpdate,
    DELETE: PERMISSION_CODES.WorkspaceDelete
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminNotificationTriggerDueSoon, {
  permissions: {
    POST: PERMISSION_CODES.NotificationCreate
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminNotificationStats, {
  permissions: {
    GET: PERMISSION_CODES.NotificationView
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminNotificationMarkRead, {
  permissions: {
    POST: PERMISSION_CODES.NotificationUpdate
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.workspaceProfile, {
  permissions: { PATCH: PERMISSION_CODES.WorkspaceUpdate },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.workspaceEffectivePermissions, {
  permissions: { GET: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.workspaceAccessReport, {
  permissions: { GET: PERMISSION_CODES.WorkspaceMemberView },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.workspaceMembers, {
  permissions: {
    GET: '',
    POST: PERMISSION_CODES.WorkspaceMemberCreate
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.workspaceMemberRole, {
  permissions: { PUT: '' },
  authenticated: true,
  workspaceScoped: true,
  admin: true,
});

permissions.set(API_ROUTES.workspaceMemberRemove, {
  permissions: { DELETE: PERMISSION_CODES.WorkspaceMemberDelete },
  authenticated: true,
  workspaceScoped: true
});

// Admin routes - all require SuperAdmin
permissions.set(API_ROUTES.adminAccounts, {
  permissions: {
    GET: PERMISSION_CODES.AdminAccountView,
    POST: PERMISSION_CODES.AdminAccountCreate
  },
  authenticated: true
});

permissions.set(API_ROUTES.adminAccountById, {
  permissions: { PATCH: PERMISSION_CODES.AdminAccountUpdate },
  authenticated: true
});

permissions.set(API_ROUTES.adminAccountRole, {
  permissions: { PUT: PERMISSION_CODES.AdminAccountUpdate },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminAccountStatus, {
  permissions: { PUT: PERMISSION_CODES.AdminAccountUpdate },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminWorkspaces, {
  permissions: {
    GET: '',
    // GET: PERMISSION_CODES.WorkspaceView,
    POST: PERMISSION_CODES.WorkspaceUpdate
  },
  authenticated: true,
  workspaceScoped: true
  // super: true
});

permissions.set(API_ROUTES.adminWorkspaceById, {
  permissions: {
    PATCH: PERMISSION_CODES.WorkspaceUpdate,
    DELETE: PERMISSION_CODES.WorkspaceUpdate
  },
  authenticated: true,
  workspaceScoped: true
  // super: true
});

permissions.set(API_ROUTES.adminMemberships, {
  permissions: { GET: '' },
  authenticated: true,
  workspaceScoped: true
  // super: true
});

permissions.set(API_ROUTES.adminSystemConfig, {
  permissions: {
    GET: '',
    PUT: PERMISSION_CODES.AdminRbacUpdate
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminSystemConfigTestEmail, {
  permissions: {
    POST: PERMISSION_CODES.AdminRbacUpdate
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminCategories, {
  permissions: {
    GET: PERMISSION_CODES.CategoryView,
    POST: PERMISSION_CODES.CategoryCreate
  },
  authenticated: true,
  // super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminCategoryById, {
  permissions: {
    GET: PERMISSION_CODES.CategoryView,
    PATCH: PERMISSION_CODES.CategoryUpdate,
    DELETE: PERMISSION_CODES.CategoryDelete
  },
  authenticated: true,
  // super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminDocuments, {
  permissions: {
    GET: PERMISSION_CODES.DocumentView,
    POST: PERMISSION_CODES.DocumentCreate
  },
  authenticated: true,
  // super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminDocumentById, {
  permissions: {
    GET: PERMISSION_CODES.DocumentView,
    PATCH: PERMISSION_CODES.DocumentUpdate,
    DELETE: PERMISSION_CODES.DocumentDelete
  },
  authenticated: true,
  // super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminDocumentFiles, {
  permissions: {
    GET: PERMISSION_CODES.DocumentView
  },
  authenticated: true,
  super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminTasks, {
  permissions: {
    GET: PERMISSION_CODES.TaskView,
    POST: PERMISSION_CODES.TaskCreate
  },
  authenticated: true,
  // super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminTasksParentOptions, {
  permissions: {
    GET: PERMISSION_CODES.TaskCreate
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminTasksAssignments, {
  permissions: {
    GET: PERMISSION_CODES.TaskView
  },
  authenticated: true,
  workspaceScoped: true
})

permissions.set(API_ROUTES.adminTasksAssigned, {
  permissions: {
    GET: PERMISSION_CODES.TaskView
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminTaskById, {
  permissions: {
    GET: PERMISSION_CODES.TaskView,
    PATCH: PERMISSION_CODES.TaskUpdate,
    DELETE: PERMISSION_CODES.TaskDelete
  },
  authenticated: true,
  // super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminTaskReceive, {
  permissions: {
    POST: PERMISSION_CODES.TaskReceive
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminTasksRemind, {
  permissions: {
  },
  authenticated: true,
  workspaceScoped: true
})

permissions.set(API_ROUTES.adminTaskSendApprovalData, {
  permissions: {
    POST: PERMISSION_CODES.TaskSendApprovalData
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminTaskApproveData, {
  permissions: {
    POST: PERMISSION_CODES.TaskApproveData
  },
  authenticated: true,
  workspaceScoped: true
});


permissions.set(API_ROUTES.adminTasksReviews, {
  permissions: {
    POST: PERMISSION_CODES.TaskApproveData
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminTaskRejectApprovalData, {
  permissions: {
    POST: PERMISSION_CODES.TaskRejectApprovalData
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminTaskSendPromulgateData, {
  permissions: {
    POST: PERMISSION_CODES.TaskSendPromulgateData
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminOrganizations, {
  permissions: {
    GET: PERMISSION_CODES.OrganizationView,
    POST: PERMISSION_CODES.OrganizationCreate
  },
  authenticated: true,
  // super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminOrganizationById, {
  permissions: {
    GET: PERMISSION_CODES.OrganizationView,
    PATCH: PERMISSION_CODES.OrganizationUpdate,
    DELETE: PERMISSION_CODES.OrganizationDelete
  },
  authenticated: true,
  // super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminFiles, {
  permissions: {
    GET: PERMISSION_CODES.FileView,
    POST: PERMISSION_CODES.FileCreate
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminFileById, {
  permissions: {
    GET: PERMISSION_CODES.FileView,
    PATCH: PERMISSION_CODES.FileUpdate,
    DELETE: PERMISSION_CODES.FileDelete
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminFilePreview, {
  permissions: {
    GET: ""
  },
  authenticated: true,
});

permissions.set(API_ROUTES.adminFileSummary, {
  permissions: {
    POST: PERMISSION_CODES.FileView,
  },
  authenticated: true,
  super: true
});

permissions.set(API_ROUTES.adminFileDownload, {
  permissions: {
    GET: PERMISSION_CODES.FileView
  },
  authenticated: true,
  super: true
});

// permissions.set(API_ROUTES.adminAiSummary, {
//   permissions: {
//     GET: PERMISSION_CODES.FileView,
//     POST: PERMISSION_CODES.FileCreate
//   },
//   authenticated: true,
//   super: true
// });

// permissions.set(API_ROUTES.adminAiSummaryById, {
//   permissions: {
//     PATCH: PERMISSION_CODES.FileUpdate
//   },
//   authenticated: true,
//   super: true
// });

permissions.set(API_ROUTES.adminNotifications, {
  permissions: {
    GET: PERMISSION_CODES.NotificationView,
    POST: PERMISSION_CODES.NotificationCreate
  },
  authenticated: true,
  // super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminNotificationById, {
  permissions: {
    GET: PERMISSION_CODES.NotificationView,
    PATCH: PERMISSION_CODES.NotificationUpdate,
    DELETE: PERMISSION_CODES.NotificationDelete
  },
  authenticated: true,
  // super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminCategoryItems, {
  permissions: {
    GET: PERMISSION_CODES.CategoryView,
    POST: PERMISSION_CODES.CategoryCreate
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminCategoryItemById, {
  permissions: {
    GET: PERMISSION_CODES.CategoryView,
    PATCH: PERMISSION_CODES.CategoryUpdate,
    DELETE: PERMISSION_CODES.CategoryDelete
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminRoles, {
  permissions: {
    GET: PERMISSION_CODES.AdminRbacView,
    POST: PERMISSION_CODES.AdminRbacCreate
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminRoleById, {
  permissions: {
    GET: PERMISSION_CODES.AdminRbacView,
    PATCH: PERMISSION_CODES.AdminRbacUpdate,
    DELETE: PERMISSION_CODES.AdminRbacDelete
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminPermissions, {
  permissions: {
    GET: PERMISSION_CODES.AdminRbacView,
    POST: PERMISSION_CODES.AdminRbacCreate
  },
  authenticated: true,
});

permissions.set(API_ROUTES.adminPermissionById, {
  permissions: {
    GET: PERMISSION_CODES.AdminRbacView,
    PATCH: PERMISSION_CODES.AdminRbacUpdate,
    DELETE: PERMISSION_CODES.AdminRbacDelete
  },
  authenticated: true,
  super: true
});

permissions.set(API_ROUTES.adminRolePermissions, {
  permissions: {
    GET: PERMISSION_CODES.AdminRbacView,
    POST: PERMISSION_CODES.AdminRbacCreate
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminRolePermissionById, {
  permissions: {
    GET: PERMISSION_CODES.AdminRbacView,
    PATCH: PERMISSION_CODES.AdminRbacUpdate,
    DELETE: PERMISSION_CODES.AdminRbacDelete
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminRoleFeatures, {
  permissions: {
    PUT: PERMISSION_CODES.AdminRbacUpdate
  },
  authenticated: true,
  workspaceScoped: true,
});

permissions.set(API_ROUTES.adminAvailableFeatures, {
  permissions: {
    GET: PERMISSION_CODES.AdminRbacView
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminTaskComments, {
  permissions: {
    GET: PERMISSION_CODES.TaskView,
    POST: PERMISSION_CODES.TaskCreate
  },
  authenticated: true
  // super: true
});

permissions.set(API_ROUTES.adminTaskCommentById, {
  permissions: {
    GET: PERMISSION_CODES.TaskView,
    PATCH: PERMISSION_CODES.TaskUpdate,
    DELETE: PERMISSION_CODES.TaskDelete
  },
  authenticated: true
  // super: true
});

permissions.set(API_ROUTES.adminTaskProgress, {
  permissions: {
    GET: PERMISSION_CODES.TaskView,
    POST: PERMISSION_CODES.TaskCreate
  },
  authenticated: true
  // super: true
});

permissions.set(API_ROUTES.adminTaskProgressById, {
  permissions: {
    GET: PERMISSION_CODES.TaskView,
    PATCH: PERMISSION_CODES.TaskUpdate,
    DELETE: PERMISSION_CODES.TaskDelete
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminTaskAssignmentProgress, {
  permissions: {
    GET: PERMISSION_CODES.TaskView,
    POST: PERMISSION_CODES.TaskCreate
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminTaskAssignmentProgressById, {
  permissions: {
    GET: PERMISSION_CODES.TaskView,
    PATCH: PERMISSION_CODES.TaskUpdate,
    DELETE: PERMISSION_CODES.TaskDelete
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminTaskAssignments, {
  permissions: {
    GET: PERMISSION_CODES.TaskView,
    POST: PERMISSION_CODES.TaskCreate
  },
  authenticated: true
  // super: true
});

permissions.set(API_ROUTES.adminTaskAssignmentById, {
  permissions: {
    GET: PERMISSION_CODES.TaskView,
    PATCH: PERMISSION_CODES.TaskUpdate,
    DELETE: PERMISSION_CODES.TaskDelete
  },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminAuditLogs, {
  permissions: { GET: PERMISSION_CODES.AuditRead },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminAuditLogStats, {
  permissions: { GET: PERMISSION_CODES.AuditRead },
  authenticated: true,
  // super: true
});

permissions.set(API_ROUTES.adminFeatures, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  // super: true,
  workspaceScoped: true,
  admin: true
});

permissions.set(API_ROUTES.adminFeaturesById, {
  permissions: { GET: "", PUT: "", PATCH: "", DELETE: "" },
  authenticated: true,
  super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminFeaturesByGroup, {
  permissions: { GET: "" },
  authenticated: true,
  super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminFeaturesToggle, {
  permissions: { PATCH: "" },
  authenticated: true,
  super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminFeaturesReorder, {
  permissions: { POST: "" },
  authenticated: true,
  super: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminImportTemplate, {
  permissions: { GET: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminImportPreview, {
  permissions: { POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.adminImportCommit, {
  permissions: { POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTaskByDocument, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTaskByOrganization, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTaskByField, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTaskByDocumentType, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTaskDetail, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTaskDetailExportExcel, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTaskDetailExportPdf, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTaskDashboard, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTaskDashboardMainWorkload, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTaskDashboardCoordinationWorkload, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTaskDashboardTotal, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.reportTimelineDashboardTotal, {
  permissions: { GET: "", POST: "" },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholds, {
  permissions: { GET: PERMISSION_CODES.PovertyHouseholdView, POST: PERMISSION_CODES.PovertyHouseholdCreate },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdsFromMap, {
  permissions: { POST: PERMISSION_CODES.PovertyMapCreateHousehold },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdById, {
  permissions: {
    GET: PERMISSION_CODES.PovertyHouseholdDetailView,
    PATCH: PERMISSION_CODES.PovertyHouseholdUpdate,
    DELETE: PERMISSION_CODES.PovertyHouseholdDelete
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdMembers, {
  permissions: { GET: PERMISSION_CODES.PovertyHouseholdDetailView, POST: PERMISSION_CODES.PovertyHouseholdDetailUpdate },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdMemberById, {
  permissions: {
    PATCH: PERMISSION_CODES.PovertyHouseholdDetailUpdate,
    DELETE: PERMISSION_CODES.PovertyHouseholdDetailUpdate
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdAssessments, {
  permissions: { GET: PERMISSION_CODES.PovertyHouseholdDetailView, POST: PERMISSION_CODES.PovertyHouseholdDetailUpdate },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdAssessmentById, {
  permissions: {
    PATCH: PERMISSION_CODES.PovertyHouseholdDetailUpdate,
    DELETE: PERMISSION_CODES.PovertyHouseholdDetailUpdate
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdContextHistories, {
  permissions: { GET: PERMISSION_CODES.PovertyHouseholdDetailView, POST: PERMISSION_CODES.PovertyHouseholdDetailUpdate },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdContextHistoryById, {
  permissions: {
    PATCH: PERMISSION_CODES.PovertyHouseholdDetailUpdate,
    DELETE: PERMISSION_CODES.PovertyHouseholdDetailUpdate
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdSupports, {
  permissions: { GET: PERMISSION_CODES.PovertyHouseholdDetailView, POST: PERMISSION_CODES.PovertyHouseholdDetailUpdate },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdSupportById, {
  permissions: {
    PATCH: PERMISSION_CODES.PovertyHouseholdDetailUpdate,
    DELETE: PERMISSION_CODES.PovertyHouseholdDetailUpdate
  },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdChangeLogs, {
  permissions: { GET: PERMISSION_CODES.PovertyHouseholdDetailView },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdsImport, {
  permissions: { POST: PERMISSION_CODES.PovertyHouseholdImport },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyHouseholdsExport, {
  permissions: { GET: PERMISSION_CODES.PovertyHouseholdExport },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyGisMarkers, {
  permissions: { GET: PERMISSION_CODES.PovertyMapView },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyGisMarkerPosition, {
  permissions: { PATCH: PERMISSION_CODES.PovertyMapUpdatePosition },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyDashboard, {
  permissions: { GET: PERMISSION_CODES.PovertyDashboardView },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyReportSummary, {
  permissions: { GET: PERMISSION_CODES.PovertyReportView },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyReportExportExcel, {
  permissions: { GET: PERMISSION_CODES.PovertyReportExport },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyReportDetail, {
  permissions: { GET: PERMISSION_CODES.PovertyReportView },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyReportDetailExportExcel, {
  permissions: { GET: PERMISSION_CODES.PovertyReportExport },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyLocationProvinces, {
  permissions: { GET: PERMISSION_CODES.PovertyHouseholdView },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyLocationWards, {
  permissions: { GET: PERMISSION_CODES.PovertyHouseholdView },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyLocationAreas, {
  permissions: { GET: PERMISSION_CODES.PovertyHouseholdView },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyWardPublicLinks, {
  permissions: { GET: PERMISSION_CODES.PovertyWardOverviewView, PUT: PERMISSION_CODES.PovertyWardOverviewUpdate },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyWardOverviews, {
  permissions: { GET: PERMISSION_CODES.PovertyWardOverviewView, PUT: PERMISSION_CODES.PovertyWardOverviewUpdate },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyWardOverviewById, {
  permissions: { DELETE: PERMISSION_CODES.PovertyWardOverviewDelete },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyWardAreas, {
  permissions: { GET: PERMISSION_CODES.PovertyWardAreaView, POST: PERMISSION_CODES.PovertyWardAreaCreate },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.povertyWardAreaById, {
  permissions: { PATCH: PERMISSION_CODES.PovertyWardAreaUpdate, DELETE: PERMISSION_CODES.PovertyWardAreaDelete },
  authenticated: true,
  workspaceScoped: true
});

permissions.set(API_ROUTES.publicPovertyWardBySlug, {
  permissions: {},
  authenticated: false
});

permissions.set(API_ROUTES.publicPovertyAreaBySlug, {
  permissions: {},
  authenticated: false
});

permissions.set(API_ROUTES.publicPovertyHouseholdBySlug, {
  permissions: {},
  authenticated: false
});


logger.info(permissions, "route permissions set");

/**
 * This validates that permissions are set for all routes
 * in the permissions map.
 */
export const hasRoutesWithNoPermissionsSet = (routes: Routes, permissions: PermissionsMap): boolean => {
  const permissionRoutes = [...permissions.keys()];

  const hasInvalidRoute = routes.some((route) => {
    return !permissionRoutes.includes(route);
  });

  return hasInvalidRoute;
};

const hasInvalidRoute = hasRoutesWithNoPermissionsSet(Object.values(API_ROUTES), permissions);

if (hasInvalidRoute) {
  throw new Error("There are routes without permissions set.");
}
