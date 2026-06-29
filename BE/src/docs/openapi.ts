import { config } from "@/config.ts";
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  AccountCreateSchema,
  AccountResponseDataSchema,
  AccountSchema,
  AccountStatusUpdateSchema,
  // Standardized response patterns
  AccountsWithPaginationDataSchema,
  AdminMembershipQuerySchema,
  AdminPaginationQuerySchema,
  AdminRoleUpdateSchema,
  AuditLogQuerySchema,
  AuditLogSchema,
  AuditLogStatsQuerySchema,
  AuditLogStatsSchema,
  AuditLogWithDetailsSchema,
  AuditLogsWithPaginationDataSchema,
  AuthTokenDataSchema,
  CategoriesListResponseDataSchema,
  CategoryCreateSchema,
  CategoryItemCreateSchema,
  CategoryItemListQuerySchema,
  CategoryItemSchema,
  CategoryItemUpdateSchema,
  CategoryItemsListResponseDataSchema,
  CategoryListQuerySchema,
  CategorySchema,
  CategoryUpdateSchema,
  CreateWorkspaceDataSchema,
  // Query schemas
  DocumentCreateSchema,
  DocumentDetailResponseDataSchema,
  DocumentListQuerySchema,
  DocumentSchema,
  DocumentUpdateSchema,
  DocumentsListResponseDataSchema,
  ErrorResponseSchema,
  FileAttachmentInputSchema,
  FileCreateSchema,
  FileListQuerySchema,
  FileSchema,
  FileUpdateSchema,
  FilesListResponseDataSchema,
  // Request schemas
  LoginRequestSchema,
  LoginResponseDataSchema,
  MemberCreateSchema,
  MemberRoleUpdateSchema,
  MembershipResponseDataSchema,
  MembershipSchema,
  MembershipWithDetailsSchema,
  MembershipsWithPaginationDataSchema,
  // Response data schemas
  MessageResponseDataSchema,
  NotificationCreateSchema,
  NotificationListQuerySchema,
  NotificationSchema,
  NotificationUpdateSchema,
  NotificationsListResponseDataSchema,
  OrganizationCreateSchema,
  OrganizationListQuerySchema,
  OrganizationSchema,
  OrganizationUpdateSchema,
  OrganizationsListResponseDataSchema,
  PaginationQuerySchema,
  PaginationSchema,
  PermissionCreateSchema,
  PermissionListQuerySchema,
  PermissionSchema,
  PermissionUpdateSchema,
  PermissionsListResponseDataSchema,
  ProfileResponseDataSchema,
  ProfileSchema,
  ProfileUpdateSchema,
  RoleCreateSchema,
  RoleListQuerySchema,
  RolePermissionCreateSchema,
  RolePermissionListQuerySchema,
  RolePermissionSchema,
  RolePermissionUpdateSchema,
  RolePermissionsListResponseDataSchema,
  RoleSchema,
  RoleUpdateSchema,
  RolesListResponseDataSchema,
  SignupRequestSchema,
  // Simple reference schemas
  SimpleAccountSchema,
  SimpleWorkspaceSchema,
  SuccessResponseSchema,
  TaskAssignmentCreateSchema,
  TaskAssignmentListQuerySchema,
  TaskAssignmentSchema,
  TaskAssignmentUpdateSchema,
  TaskAssignmentsListResponseDataSchema,
  TaskCommentCreateSchema,
  TaskCommentListQuerySchema,
  TaskCommentSchema,
  TaskCommentUpdateSchema,
  TaskCommentsListResponseDataSchema,
  TaskCreateSchema,
  TaskDetailResponseDataSchema,
  TaskListQuerySchema,
  TaskProgressCreateSchema,
  TaskProgressListQuerySchema,
  TaskProgressListResponseDataSchema,
  TaskProgressSchema,
  TaskProgressUpdateSchema,
  TaskSchema,
  TaskUpdateSchema,
  TasksListResponseDataSchema,
  UserProfileDataSchema,
  UserWorkspaceInfoSchema,
  // Parameter schemas
  UuidParamOnlySchema,
  UuidParamSchema,
  UuidParamsWithMemberSchema,
  WorkspaceCreateSchema,
  WorkspaceHeaderSchema,
  // Complex composite schemas
  WorkspaceMemberSchema,
  WorkspaceMembersDataSchema,
  WorkspaceResponseDataSchema,
  WorkspaceSchema,
  WorkspaceWithMembersDataSchema,
  WorkspacesListDataSchema,
  WorkspacesWithPaginationDataSchema,
  DocumentUpdateAttachmentSchema,
  DocumentFilesResponseDataSchema,
  FileDownloadResponseDataSchema,
  FilePreviewResponseDataSchema,
  FileSummaryRequestSchema,
  FileSummaryResponseDataSchema,
} from "./openapi-schemas.ts";

const registry = new OpenAPIRegistry();

// Register all schemas
registry.register("Account", AccountSchema);
registry.register("AccountCreate", AccountCreateSchema);
registry.register("PaginationQuery", PaginationQuerySchema);
registry.register("UuidParam", UuidParamSchema);
registry.register("Workspace", WorkspaceSchema);
registry.register("WorkspaceCreate", WorkspaceCreateSchema);
registry.register("Profile", ProfileSchema);
registry.register("ProfileUpdate", ProfileUpdateSchema);
registry.register("Membership", MembershipSchema);
registry.register("MemberCreate", MemberCreateSchema);
registry.register("SuccessResponse", SuccessResponseSchema);
registry.register("ErrorResponse", ErrorResponseSchema);
registry.register("Pagination", PaginationSchema);
registry.register("AuditLog", AuditLogSchema);
registry.register("AuditLogStats", AuditLogStatsSchema);

// Register parameter schemas
registry.register("UuidParamOnly", UuidParamOnlySchema);
registry.register("WorkspaceHeader", WorkspaceHeaderSchema);
registry.register("UuidParamsWithMember", UuidParamsWithMemberSchema);

// Register request schemas
registry.register("LoginRequest", LoginRequestSchema);
registry.register("SignupRequest", SignupRequestSchema);
registry.register("MemberRoleUpdate", MemberRoleUpdateSchema);
registry.register("AdminRoleUpdate", AdminRoleUpdateSchema);
registry.register("AccountStatusUpdate", AccountStatusUpdateSchema);

// Register response data schemas
registry.register("MessageResponseData", MessageResponseDataSchema);
registry.register("AccountResponseData", AccountResponseDataSchema);
registry.register("WorkspaceResponseData", WorkspaceResponseDataSchema);
registry.register("ProfileResponseData", ProfileResponseDataSchema);
registry.register("MembershipResponseData", MembershipResponseDataSchema);
registry.register("AuthTokenData", AuthTokenDataSchema);
registry.register("LoginResponseData", LoginResponseDataSchema);

// Register complex composite schemas
registry.register("WorkspaceMember", WorkspaceMemberSchema);
registry.register("UserWorkspaceInfo", UserWorkspaceInfoSchema);
registry.register("WorkspaceWithMembersData", WorkspaceWithMembersDataSchema);
registry.register("WorkspaceMembersData", WorkspaceMembersDataSchema);
registry.register("CreateWorkspaceData", CreateWorkspaceDataSchema);
registry.register("UserProfileData", UserProfileDataSchema);

// Register query schemas
registry.register("AdminPaginationQuery", AdminPaginationQuerySchema);
registry.register("AdminMembershipQuery", AdminMembershipQuerySchema);
registry.register("AuditLogQuery", AuditLogQuerySchema);
registry.register("AuditLogStatsQuery", AuditLogStatsQuerySchema);

// Register simple reference schemas
registry.register("SimpleAccount", SimpleAccountSchema);
registry.register("SimpleWorkspace", SimpleWorkspaceSchema);

// Register standardized response patterns
registry.register("AccountsWithPaginationData", AccountsWithPaginationDataSchema);
registry.register("WorkspacesWithPaginationData", WorkspacesWithPaginationDataSchema);
registry.register("WorkspacesListData", WorkspacesListDataSchema);
registry.register("AuditLogWithDetails", AuditLogWithDetailsSchema);
registry.register("AuditLogsWithPaginationData", AuditLogsWithPaginationDataSchema);
registry.register("MembershipWithDetails", MembershipWithDetailsSchema);
registry.register("MembershipsWithPaginationData", MembershipsWithPaginationDataSchema);
registry.register("Category", CategorySchema);
registry.register("CategoryCreate", CategoryCreateSchema);
registry.register("CategoryUpdate", CategoryUpdateSchema);
registry.register("CategoryListQuery", CategoryListQuerySchema);
registry.register("CategoriesListResponseData", CategoriesListResponseDataSchema);
registry.register("Document", DocumentSchema);
registry.register("DocumentCreate", DocumentCreateSchema);
registry.register("DocumentUpdateAttachment", DocumentUpdateAttachmentSchema);
registry.register("DocumentUpdate", DocumentUpdateSchema);
registry.register("DocumentListQuery", DocumentListQuerySchema);
registry.register("DocumentsListResponseData", DocumentsListResponseDataSchema);
registry.register("DocumentDetailResponseData", DocumentDetailResponseDataSchema);
registry.register("DocumentFilesResponseData", DocumentFilesResponseDataSchema);
registry.register("Task", TaskSchema);
registry.register("TaskCreate", TaskCreateSchema);
registry.register("TaskUpdate", TaskUpdateSchema);
registry.register("TaskListQuery", TaskListQuerySchema);
registry.register("TasksListResponseData", TasksListResponseDataSchema);
registry.register("TaskDetailResponseData", TaskDetailResponseDataSchema);
registry.register("Organization", OrganizationSchema);
registry.register("OrganizationCreate", OrganizationCreateSchema);
registry.register("OrganizationUpdate", OrganizationUpdateSchema);
registry.register("OrganizationListQuery", OrganizationListQuerySchema);
registry.register("OrganizationsListResponseData", OrganizationsListResponseDataSchema);
registry.register("FileResource", FileSchema);
registry.register("FileCreate", FileCreateSchema);
registry.register("FileUpdate", FileUpdateSchema);
registry.register("FileListQuery", FileListQuerySchema);
registry.register("FilesListResponseData", FilesListResponseDataSchema);
registry.register("FileAttachmentInput", FileAttachmentInputSchema);
registry.register("FileDownloadResponseData", FileDownloadResponseDataSchema);
registry.register("FilePreviewResponseData", FilePreviewResponseDataSchema);
registry.register("FileSummaryRequest", FileSummaryRequestSchema);
registry.register("FileSummaryResponseData", FileSummaryResponseDataSchema);
registry.register("Notification", NotificationSchema);
registry.register("NotificationCreate", NotificationCreateSchema);
registry.register("NotificationUpdate", NotificationUpdateSchema);
registry.register("NotificationListQuery", NotificationListQuerySchema);
registry.register("NotificationsListResponseData", NotificationsListResponseDataSchema);
registry.register("CategoryItem", CategoryItemSchema);
registry.register("CategoryItemCreate", CategoryItemCreateSchema);
registry.register("CategoryItemUpdate", CategoryItemUpdateSchema);
registry.register("CategoryItemListQuery", CategoryItemListQuerySchema);
registry.register("CategoryItemsListResponseData", CategoryItemsListResponseDataSchema);
registry.register("RoleResource", RoleSchema);
registry.register("RoleCreate", RoleCreateSchema);
registry.register("RoleUpdate", RoleUpdateSchema);
registry.register("RoleListQuery", RoleListQuerySchema);
registry.register("RolesListResponseData", RolesListResponseDataSchema);
registry.register("PermissionResource", PermissionSchema);
registry.register("PermissionCreate", PermissionCreateSchema);
registry.register("PermissionUpdate", PermissionUpdateSchema);
registry.register("PermissionListQuery", PermissionListQuerySchema);
registry.register("PermissionsListResponseData", PermissionsListResponseDataSchema);
registry.register("RolePermissionResource", RolePermissionSchema);
registry.register("RolePermissionCreate", RolePermissionCreateSchema);
registry.register("RolePermissionUpdate", RolePermissionUpdateSchema);
registry.register("RolePermissionListQuery", RolePermissionListQuerySchema);
registry.register("RolePermissionsListResponseData", RolePermissionsListResponseDataSchema);
registry.register("TaskComment", TaskCommentSchema);
registry.register("TaskCommentCreate", TaskCommentCreateSchema);
registry.register("TaskCommentUpdate", TaskCommentUpdateSchema);
registry.register("TaskCommentListQuery", TaskCommentListQuerySchema);
registry.register("TaskCommentsListResponseData", TaskCommentsListResponseDataSchema);
registry.register("TaskProgress", TaskProgressSchema);
registry.register("TaskProgressCreate", TaskProgressCreateSchema);
registry.register("TaskProgressUpdate", TaskProgressUpdateSchema);
registry.register("TaskProgressListQuery", TaskProgressListQuerySchema);
registry.register("TaskProgressListResponseData", TaskProgressListResponseDataSchema);
registry.register("TaskAssignment", TaskAssignmentSchema);
registry.register("TaskAssignmentCreate", TaskAssignmentCreateSchema);
registry.register("TaskAssignmentUpdate", TaskAssignmentUpdateSchema);
registry.register("TaskAssignmentListQuery", TaskAssignmentListQuerySchema);
registry.register("TaskAssignmentsListResponseData", TaskAssignmentsListResponseDataSchema);

// Security scheme for JWT Bearer token
registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT"
});

// Authentication routes
registry.registerPath({
  method: "post",
  path: "/login",
  summary: "User login",
  description: "Authenticate user with email and password",
  tags: ["Authentication"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Login successful",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: LoginResponseDataSchema
          })
        }
      }
    },
    400: {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/signup",
  summary: "User registration",
  description: "Create a new user account",
  tags: ["Authentication"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SignupRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "Account created successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: AuthTokenDataSchema
          })
        }
      }
    },
    400: {
      description: "Invalid input or email already exists",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

// Register API routes using Zod schemas
registry.registerPath({
  method: "get",
  path: "/me",
  summary: "Get current user profile",
  description: "Returns the current user's account information and all workspaces they belong to",
  security: [{ bearerAuth: [] }],
  tags: ["User"],
  responses: {
    200: {
      description: "Current user profile retrieved successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: UserProfileDataSchema
          })
        }
      }
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/workspaces",
  summary: "List available workspaces",
  description:
    "Return all workspaces for SuperAdmin; return only workspaces where current user is a member for non-SuperAdmin users",
  security: [{ bearerAuth: [] }],
  tags: ["Workspaces"],
  responses: {
    200: {
      description: "List of user workspaces",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.array(WorkspaceSchema)
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/workspaces",
  summary: "Create new workspace",
  description: "Create a new workspace for the current user",
  security: [{ bearerAuth: [] }],
  tags: ["Workspaces"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: WorkspaceCreateSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Workspace created successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: CreateWorkspaceDataSchema
          })
        }
      }
    }
  }
});

// Individual workspace operations
registry.registerPath({
  method: "get",
  path: "/workspaces/{id}",
  summary: "Get workspace details",
  description: "Get details of a specific workspace including all members",
  security: [{ bearerAuth: [] }],
  tags: ["Workspaces"],
  request: {
    params: UuidParamOnlySchema,
    headers: WorkspaceHeaderSchema
  },
  responses: {
    200: {
      description: "Workspace details retrieved successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: WorkspaceWithMembersDataSchema
          })
        }
      }
    },
    404: {
      description: "Workspace not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "patch",
  path: "/workspaces/{id}",
  summary: "Update workspace",
  description: "Update workspace details (Admin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Workspaces"],
  request: {
    params: z.object({
      id: z.uuid()
    }),
    headers: z.object({
      "x-workspace-id": z.uuid()
    }),
    body: {
      content: {
        "application/json": {
          schema: WorkspaceCreateSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Workspace updated successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              workspace: WorkspaceSchema
            })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/workspaces/{id}",
  summary: "Delete workspace",
  description: "Delete a workspace and all its data (Admin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Workspaces"],
  request: {
    params: z.object({
      id: z.uuid()
    }),
    headers: z.object({
      "x-workspace-id": z.uuid()
    })
  },
  responses: {
    200: {
      description: "Workspace deleted successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              message: z.string()
            })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "patch",
  path: "/workspaces/{id}/profile",
  summary: "Update workspace profile",
  description: "Update the current user's profile name within a workspace. Users can only update their own profile.",
  security: [{ bearerAuth: [] }],
  tags: ["Workspaces"],
  request: {
    params: z.object({
      id: z.uuid().describe("Workspace ID")
    }),
    headers: z.object({
      "x-workspace-id": z.uuid().describe("Workspace ID for context")
    }),
    body: {
      content: {
        "application/json": {
          schema: ProfileUpdateSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Profile updated successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              profile: ProfileSchema
            })
          })
        }
      }
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: "Profile not found in workspace",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "put",
  path: "/workspaces/{id}/members/{memberId}/role",
  summary: "Update member role",
  description: "Update a workspace member's role (Admin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Members"],
  request: {
    params: UuidParamsWithMemberSchema,
    headers: WorkspaceHeaderSchema,
    body: {
      content: {
        "application/json": {
          schema: MemberRoleUpdateSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Member role updated successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              membership: MembershipSchema
            })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/workspaces/{id}/members/{memberId}",
  summary: "Remove workspace member",
  description: "Remove a member from the workspace (Admin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Members"],
  request: {
    params: UuidParamsWithMemberSchema,
    headers: WorkspaceHeaderSchema
  },
  responses: {
    200: {
      description: "Member removed successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              message: z.string()
            })
          })
        }
      }
    }
  }
});

// Admin routes using Zod schemas
registry.registerPath({
  method: "get",
  path: "/admin/accounts",
  summary: "List all accounts (SuperAdmin only)",
  description: "Get a paginated list of all accounts in the system (SuperAdmin only, requires permission: admin.account.read)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    query: AdminPaginationQuerySchema
  },
  responses: {
    200: {
      description: "List of accounts with pagination",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: AccountsWithPaginationDataSchema
          })
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/admin/accounts",
  summary: "Create account for user (SuperAdmin only)",
  description: "Create a new account for an existing user (SuperAdmin only, requires permission: admin.account.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: AccountCreateSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "Account created successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              account: AccountSchema
            })
          })
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/workspaces",
  summary: "List all workspaces (SuperAdmin only)",
  description: "Get a paginated list of all workspaces in the system",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    query: AdminPaginationQuerySchema
  },
  responses: {
    200: {
      description: "List of workspaces with pagination",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: WorkspacesWithPaginationDataSchema
          })
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/workspaces/{id}/members",
  summary: "List workspace members",
  description: "Get all members of a specific workspace",
  security: [{ bearerAuth: [] }],
  tags: ["Members"],
  request: {
    params: z.object({
      id: z.uuid()
    }),
    headers: z.object({
      "x-workspace-id": z.uuid()
    })
  },
  responses: {
    200: {
      description: "List of workspace members",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              members: z.array(
                z.object({
                  account: AccountSchema,
                  profile: ProfileSchema,
                  membership: MembershipSchema
                })
              ),
              memberCount: z.number()
            })
          })
        }
      }
    },
    404: {
      description: "Workspace not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/workspaces/{id}/access-report",
  summary: "Workspace access report",
  description: "Return RBAC access report by role, member and permission for a workspace",
  security: [{ bearerAuth: [] }],
  tags: ["Members"],
  request: {
    params: z.object({
      id: z.uuid()
    }),
    headers: z.object({
      "x-workspace-id": z.uuid()
    })
  },
  responses: {
    200: {
      description: "Workspace access report generated",
      content: {
        "application/json": {
          schema: SuccessResponseSchema
        }
      }
    },
    404: {
      description: "Workspace or membership not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/workspaces/{id}/members",
  summary: "Add workspace member",
  description: "Add a new member to a workspace",
  security: [{ bearerAuth: [] }],
  tags: ["Members"],
  request: {
    params: z.object({
      id: z.uuid()
    }),
    headers: z.object({
      "x-workspace-id": z.uuid()
    }),
    body: {
      content: {
        "application/json": {
          schema: MemberCreateSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "Member added successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              account: AccountSchema,
              profile: ProfileSchema,
              membership: MembershipSchema
            })
          })
        }
      }
    },
    404: {
      description: "Workspace or account not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "put",
  path: "/admin/accounts/{id}/role",
  summary: "Update account SuperAdmin status",
  description: "Promote or demote an account's SuperAdmin status (SuperAdmin only, requires permission: admin.account.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    params: z.object({
      id: z.uuid()
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            isSuperAdmin: z.boolean().describe("Whether the account should be a SuperAdmin")
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: "Account role updated successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              account: AccountSchema
            })
          })
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "put",
  path: "/admin/accounts/{id}/status",
  summary: "Update account status",
  description: "Activate, deactivate, or suspend an account (SuperAdmin only, requires permission: admin.account.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    params: z.object({
      id: z.uuid()
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.enum(["active", "inactive", "suspended"]).describe("New account status")
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: "Account status updated successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              account: AccountSchema
            })
          })
        }
      }
    },
    400: {
      description: "Invalid status value",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: "Account not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

// SuperAdmin workspace control endpoints removed - users manage their own workspaces

registry.registerPath({
  method: "get",
  path: "/admin/memberships",
  summary: "List all memberships",
  description: "Get all workspace memberships with optional filtering (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    query: AdminMembershipQuerySchema
  },
  responses: {
    200: {
      description: "List of memberships with pagination",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: MembershipsWithPaginationDataSchema
          })
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/categories",
  summary: "List categories",
  description: "Get categories with filter/search/sort and pagination in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    headers: WorkspaceHeaderSchema,
    query: CategoryListQuerySchema
  },
  responses: {
    200: {
      description: "Category list fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: CategoriesListResponseDataSchema
          }),
          examples: {
            default: {
              value: {
                code: 200,
                message: "Categories retrieved successfully",
                data: {
                  items: [
                    {
                      uuid: "11111111-1111-1111-1111-111111111111",
                      workspaceId: "22222222-2222-2222-2222-222222222222",
                      code: "DOC_STATUS",
                      name: "Document Status",
                      description: "Status dictionary",
                      createdAt: "2026-03-17T10:00:00.000Z"
                    }
                  ],
                  pagination: { page: 1, limit: 20, total: 1, pages: 1 },
                  filters: {
                    workspaceId: "22222222-2222-2222-2222-222222222222",
                    search: "status",
                    createdFrom: null,
                    createdTo: null,
                    sortBy: "createdAt",
                    sortOrder: "desc"
                  }
                }
              }
            }
          }
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/admin/categories",
  summary: "Create category",
  description: "Create a category in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    headers: WorkspaceHeaderSchema,
    body: {
      content: {
        "application/json": {
          schema: CategoryCreateSchema,
          examples: {
            default: {
              value: {
                code: "TASK_PRIORITY",
                name: "Task Priority",
                description: "Priority values"
              }
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: "Category created successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: CategorySchema })
          })
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/categories/{id}",
  summary: "Get category by id",
  description: "Get category detail by UUID in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    headers: WorkspaceHeaderSchema,
    params: z.object({
      id: z.uuid()
    })
  },
  responses: {
    200: {
      description: "Category fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: CategorySchema })
          })
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: "Record not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "patch",
  path: "/admin/categories/{id}",
  summary: "Update category",
  description: "Update category by UUID in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    headers: WorkspaceHeaderSchema,
    params: z.object({
      id: z.uuid()
    }),
    body: {
      content: {
        "application/json": {
          schema: CategoryUpdateSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Category updated successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: CategorySchema })
          })
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: "Record not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/admin/categories/{id}",
  summary: "Delete category",
  description: "Delete category by UUID in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    headers: WorkspaceHeaderSchema,
    params: z.object({
      id: z.uuid()
    })
  },
  responses: {
    200: {
      description: "Category deleted successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: CategorySchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/content/documents",
  summary: "List documents",
  description: "Get documents with filter/search/sort and pagination in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Content"],
  request: {
    headers: WorkspaceHeaderSchema,
    query: DocumentListQuerySchema
  },
  responses: {
    200: {
      description: "Document list fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: DocumentsListResponseDataSchema
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/roles",
  summary: "List roles",
  description: "Get roles with filter/search/sort and pagination (SuperAdmin only, requires permission: admin.rbac.read)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    query: RoleListQuerySchema
  },
  responses: {
    200: {
      description: "Role list fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: RolesListResponseDataSchema
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/admin/roles",
  summary: "Create role",
  description: "Create role record (SuperAdmin only, requires permission: admin.rbac.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: RoleCreateSchema,
          examples: {
            default: {
              value: {
                code: "editor",
                name: "Editor",
                description: "Can edit workspace content"
              }
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: "Role created successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: RoleSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/roles/{id}",
  summary: "Get role by id",
  description: "Get role detail by id (SuperAdmin only, requires permission: admin.rbac.read)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    params: z.object({ id: z.number().int().positive() })
  },
  responses: {
    200: {
      description: "Role fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: RoleSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "patch",
  path: "/admin/roles/{id}",
  summary: "Update role",
  description: "Update role by id (SuperAdmin only, requires permission: admin.rbac.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    params: z.object({ id: z.number().int().positive() }),
    body: {
      content: {
        "application/json": {
          schema: RoleUpdateSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Role updated successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: RoleSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/admin/roles/{id}",
  summary: "Delete role",
  description: "Delete role by id (SuperAdmin only, requires permission: admin.rbac.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    params: z.object({ id: z.number().int().positive() })
  },
  responses: {
    200: {
      description: "Role deleted successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: RoleSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/permissions",
  summary: "List permissions",
  description: "Get permissions with filter/search/sort and pagination (SuperAdmin only, requires permission: admin.rbac.read)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    query: PermissionListQuerySchema
  },
  responses: {
    200: {
      description: "Permission list fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: PermissionsListResponseDataSchema
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/admin/permissions",
  summary: "Create permission",
  description: "Create permission record (SuperAdmin only, requires permission: admin.rbac.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: PermissionCreateSchema,
          examples: {
            default: {
              value: {
                code: "document.view",
                name: "View documents",
                description: "Allows reading documents"
              }
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: "Permission created successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: PermissionSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/permissions/{id}",
  summary: "Get permission by id",
  description: "Get permission detail by id (SuperAdmin only, requires permission: admin.rbac.read)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    params: z.object({ id: z.number().int().positive() })
  },
  responses: {
    200: {
      description: "Permission fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: PermissionSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "patch",
  path: "/admin/permissions/{id}",
  summary: "Update permission",
  description: "Update permission by id (SuperAdmin only, requires permission: admin.rbac.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    params: z.object({ id: z.number().int().positive() }),
    body: {
      content: {
        "application/json": {
          schema: PermissionUpdateSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Permission updated successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: PermissionSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/admin/permissions/{id}",
  summary: "Delete permission",
  description: "Delete permission by id (SuperAdmin only, requires permission: admin.rbac.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    params: z.object({ id: z.number().int().positive() })
  },
  responses: {
    200: {
      description: "Permission deleted successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: PermissionSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/role-permissions",
  summary: "List role permissions",
  description: "Get role-permission mappings with filtering and pagination (SuperAdmin only, requires permission: admin.rbac.read)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    query: RolePermissionListQuerySchema
  },
  responses: {
    200: {
      description: "Role permission list fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: RolePermissionsListResponseDataSchema
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/admin/role-permissions",
  summary: "Create role permission",
  description: "Create role-permission mapping (SuperAdmin only, requires permission: admin.rbac.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: RolePermissionCreateSchema,
          examples: {
            default: {
              value: {
                roleId: 2,
                permissionId: 10
              }
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: "Role permission created successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: RolePermissionSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/role-permissions/{roleId}/{permissionId}",
  summary: "Get role permission by composite key",
  description: "Get one role-permission mapping by roleId and permissionId (SuperAdmin only, requires permission: admin.rbac.read)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    params: z.object({
      roleId: z.number().int().positive(),
      permissionId: z.number().int().positive()
    })
  },
  responses: {
    200: {
      description: "Role permission fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: RolePermissionSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "patch",
  path: "/admin/role-permissions/{roleId}/{permissionId}",
  summary: "Update role permission",
  description: "Update role-permission mapping by composite key (SuperAdmin only, requires permission: admin.rbac.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    params: z.object({
      roleId: z.number().int().positive(),
      permissionId: z.number().int().positive()
    }),
    body: {
      content: {
        "application/json": {
          schema: RolePermissionUpdateSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Role permission updated successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: RolePermissionSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/admin/role-permissions/{roleId}/{permissionId}",
  summary: "Delete role permission",
  description: "Delete role-permission mapping by composite key (SuperAdmin only, requires permission: admin.rbac.write)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    params: z.object({
      roleId: z.number().int().positive(),
      permissionId: z.number().int().positive()
    })
  },
  responses: {
    200: {
      description: "Role permission deleted successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: RolePermissionSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/content/documents",
  summary: "Create document",
  description: "Create document in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Content"],
  request: {
    headers: WorkspaceHeaderSchema,
    body: {
      content: {
        "application/json": {
          schema: DocumentCreateSchema,
          examples: {
            default: {
              value: {
                title: "Internal policy 2026",
                documentNumber: "POL-2026-001",
                summary: "Policy summary",
                attachments: [
                  {
                    fileName: "policy-appendix.pdf",
                    fileContentBase64: "JVBERi0xLjQK...",
                    mimeType: "application/pdf"
                  }
                ]
              }
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: "Document created successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: DocumentDetailResponseDataSchema
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/content/documents/{id}",
  summary: "Get document by id",
  description: "Get document detail by UUID in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Content"],
  request: {
    headers: WorkspaceHeaderSchema,
    params: z.object({ id: z.uuid() })
  },
  responses: {
    200: {
      description: "Document fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: DocumentSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "patch",
  path: "/content/documents/{id}",
  summary: "Update document",
  description: "Update document by UUID in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Content"],
  request: {
    headers: WorkspaceHeaderSchema,
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": {
          schema: DocumentUpdateSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Document updated successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: DocumentSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/content/documents/{id}",
  summary: "Delete document",
  description: "Delete document by UUID in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Content"],
  request: {
    headers: WorkspaceHeaderSchema,
    params: z.object({ id: z.uuid() })
  },
  responses: {
    200: {
      description: "Document deleted successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: DocumentSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/workflow/tasks",
  summary: "List tasks",
  description: "Get tasks with filter/search/sort and pagination in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Workflow"],
  request: {
    headers: WorkspaceHeaderSchema,
    query: TaskListQuerySchema
  },
  responses: {
    200: {
      description: "Task list fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: TasksListResponseDataSchema
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/workflow/tasks",
  summary: "Create task",
  description: "Create task in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Workflow"],
  request: {
    headers: WorkspaceHeaderSchema,
    body: {
      content: {
        "application/json": {
          schema: TaskCreateSchema,
          examples: {
            default: {
              value: {
                title: "Review legal document",
                dueDate: "2026-03-30",
                description: "Review and finalize",
                attachments: [
                  {
                    fileName: "review-notes.txt",
                    fileContentBase64: "VHJhY2sgY2hhbmdlcyBiZWZvcmUgYXBwcm92YWwu",
                    mimeType: "text/plain"
                  }
                ]
              }
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: "Task created successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: TaskDetailResponseDataSchema
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/workflow/tasks/{id}",
  summary: "Get task by id",
  description: "Get task detail by UUID in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Workflow"],
  request: {
    headers: WorkspaceHeaderSchema,
    params: z.object({ id: z.uuid() })
  },
  responses: {
    200: {
      description: "Task fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: TaskSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "patch",
  path: "/workflow/tasks/{id}",
  summary: "Update task",
  description: "Update task by UUID in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Workflow"],
  request: {
    headers: WorkspaceHeaderSchema,
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": {
          schema: TaskUpdateSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Task updated successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: TaskSchema })
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/workflow/tasks/{id}",
  summary: "Delete task",
  description: "Delete task by UUID in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Workflow"],
  request: {
    headers: WorkspaceHeaderSchema,
    params: z.object({ id: z.uuid() })
  },
  responses: {
    200: {
      description: "Task deleted successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: z.object({ item: TaskSchema })
          })
        }
      }
    }
  }
});

function registerAdminCrudPaths(config: {
  basePath: string;
  tag: string;
  entityName: string;
  listQuery: z.ZodObject<z.ZodRawShape>;
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
  itemSchema: z.ZodTypeAny;
  listDataSchema: z.ZodTypeAny;
  createExample: Record<string, unknown>;
  requiresWorkspaceHeader?: boolean;
  permissionByMethod?: Partial<Record<"GET" | "POST" | "PATCH" | "DELETE", string>>;
}): void {
  const workspaceRequest = config.requiresWorkspaceHeader ? { headers: WorkspaceHeaderSchema } : {};
  const workspaceSuffix = config.requiresWorkspaceHeader
    ? " in the workspace context from x-workspace-id header"
    : "";
  const permissionSuffix = (method: "GET" | "POST" | "PATCH" | "DELETE"): string => {
    const permissionCode = config.permissionByMethod?.[method];
    return permissionCode ? `, requires permission: ${permissionCode}` : "";
  };

  registry.registerPath({
    method: "get",
    path: config.basePath,
    summary: `List ${config.entityName}`,
    description: `Get ${config.entityName} with filter/search/sort and pagination${workspaceSuffix} (SuperAdmin only${permissionSuffix("GET")})`,
    security: [{ bearerAuth: [] }],
    tags: [config.tag],
    request: {
      ...workspaceRequest,
      query: config.listQuery
    },
    responses: {
      200: {
        description: `${config.entityName} list fetched successfully`,
        content: {
          "application/json": {
            schema: SuccessResponseSchema.extend({
              data: config.listDataSchema
            })
          }
        }
      }
    }
  });

  registry.registerPath({
    method: "post",
    path: config.basePath,
    summary: `Create ${config.entityName.slice(0, -1)}`,
    description: `Create ${config.entityName.slice(0, -1)} record${workspaceSuffix} (SuperAdmin only${permissionSuffix("POST")})`,
    security: [{ bearerAuth: [] }],
    tags: [config.tag],
    request: {
      ...workspaceRequest,
      body: {
        content: {
          "application/json": {
            schema: config.createSchema,
            examples: {
              default: {
                value: config.createExample
              }
            }
          }
        }
      }
    },
    responses: {
      201: {
        description: `${config.entityName.slice(0, -1)} created successfully`,
        content: {
          "application/json": {
            schema: SuccessResponseSchema.extend({
              data: z.object({ item: config.itemSchema })
            })
          }
        }
      }
    }
  });

  registry.registerPath({
    method: "get",
    path: `${config.basePath}/{id}`,
    summary: `Get ${config.entityName.slice(0, -1)} by id`,
    description: `Get ${config.entityName.slice(0, -1)} detail by UUID${workspaceSuffix} (SuperAdmin only${permissionSuffix("GET")})`,
    security: [{ bearerAuth: [] }],
    tags: [config.tag],
    request: {
      ...workspaceRequest,
      params: z.object({ id: z.uuid() })
    },
    responses: {
      200: {
        description: `${config.entityName.slice(0, -1)} fetched successfully`,
        content: {
          "application/json": {
            schema: SuccessResponseSchema.extend({
              data: z.object({ item: config.itemSchema })
            })
          }
        }
      }
    }
  });

  registry.registerPath({
    method: "patch",
    path: `${config.basePath}/{id}`,
    summary: `Update ${config.entityName.slice(0, -1)}`,
    description: `Update ${config.entityName.slice(0, -1)} by UUID${workspaceSuffix} (SuperAdmin only${permissionSuffix("PATCH")})`,
    security: [{ bearerAuth: [] }],
    tags: [config.tag],
    request: {
      ...workspaceRequest,
      params: z.object({ id: z.uuid() }),
      body: {
        content: {
          "application/json": {
            schema: config.updateSchema
          }
        }
      }
    },
    responses: {
      200: {
        description: `${config.entityName.slice(0, -1)} updated successfully`,
        content: {
          "application/json": {
            schema: SuccessResponseSchema.extend({
              data: z.object({ item: config.itemSchema })
            })
          }
        }
      }
    }
  });

  registry.registerPath({
    method: "delete",
    path: `${config.basePath}/{id}`,
    summary: `Delete ${config.entityName.slice(0, -1)}`,
    description: `Delete ${config.entityName.slice(0, -1)} by UUID${workspaceSuffix} (SuperAdmin only${permissionSuffix("DELETE")})`,
    security: [{ bearerAuth: [] }],
    tags: [config.tag],
    request: {
      ...workspaceRequest,
      params: z.object({ id: z.uuid() })
    },
    responses: {
      200: {
        description: `${config.entityName.slice(0, -1)} deleted successfully`,
        content: {
          "application/json": {
            schema: SuccessResponseSchema.extend({
              data: z.object({ item: config.itemSchema })
            })
          }
        }
      }
    }
  });
}

registerAdminCrudPaths({
  basePath: "/admin/organizations",
  tag: "Admin",
  entityName: "organizations",
  listQuery: OrganizationListQuerySchema,
  createSchema: OrganizationCreateSchema,
  updateSchema: OrganizationUpdateSchema,
  itemSchema: OrganizationSchema,
  listDataSchema: OrganizationsListResponseDataSchema,
  createExample: {
    name: "Legal Department",
    code: "ORG_LEGAL"
  },
  requiresWorkspaceHeader: true
});

registerAdminCrudPaths({
  basePath: "/content/files",
  tag: "Content",
  entityName: "files",
  listQuery: FileListQuerySchema,
  createSchema: FileCreateSchema,
  updateSchema: FileUpdateSchema,
  itemSchema: FileSchema,
  listDataSchema: FilesListResponseDataSchema,
  createExample: {
    fileName: "policy.pdf",
    filePath: "uploads/policy.pdf",
    entityType: "document",
    entityId: "33333333-3333-3333-3333-333333333333"
  },
  permissionByMethod: {
    GET: "file.view",
    POST: "file.create",
    PATCH: "file.update",
    DELETE: "file.delete"
  }
});

registry.registerPath({
  method: "get",
  path: "/content/documents/{id}/files",
  summary: "Get document files",
  description: "Get document attachments by UUID in the workspace context from x-workspace-id header (SuperAdmin only)",
  security: [{ bearerAuth: [] }],
  tags: ["Content"],
  request: {
    headers: WorkspaceHeaderSchema,
    params: z.object({ id: z.uuid() })
  },
  responses: {
    200: {
      description: "Document files fetched successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: DocumentFilesResponseDataSchema
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/content/files/{id}/preview",
  summary: "Create file preview URL",
  description: "Create a signed preview URL for a file by UUID (SuperAdmin only, requires permission: file.view)",
  security: [{ bearerAuth: [] }],
  tags: ["Content"],
  request: {
    params: z.object({ id: z.uuid() }),
    query: z.object({
      expiresIn: z.number().int().min(60).max(86400).default(300).optional()
    })
  },
  responses: {
    200: {
      description: "Signed file preview URL created successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: FilePreviewResponseDataSchema
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/content/files/{id}/summary",
  summary: "Tóm tắt nội dung file",
  description: "Upload file sang Smart Reader, chạy OCR và lấy nội dung tóm tắt theo UUID file",
  security: [{ bearerAuth: [] }],
  tags: ["Content"],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": {
          schema: FileSummaryRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Tóm tắt file thành công",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: FileSummaryResponseDataSchema
          })
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/content/files/{id}/download",
  summary: "Create file download URL",
  description: "Create a signed download URL for a file by UUID (SuperAdmin only, requires permission: file.view)",
  security: [{ bearerAuth: [] }],
  tags: ["Content"],
  request: {
    params: z.object({ id: z.uuid() }),
    query: z.object({
      expiresIn: z.number().int().min(60).max(86400).default(300).optional()
    })
  },
  responses: {
    200: {
      description: "Signed file download URL created successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: FileDownloadResponseDataSchema
          })
        }
      }
    }
  }
});

registerAdminCrudPaths({
  basePath: "/content/notifications",
  tag: "Content",
  entityName: "notifications",
  listQuery: NotificationListQuerySchema,
  createSchema: NotificationCreateSchema,
  updateSchema: NotificationUpdateSchema,
  itemSchema: NotificationSchema,
  listDataSchema: NotificationsListResponseDataSchema,
  createExample: {
    title: "Task due soon",
    message: "Please review task deadline"
  },
  requiresWorkspaceHeader: true
});

registerAdminCrudPaths({
  basePath: "/admin/category-items",
  tag: "Admin",
  entityName: "category-items",
  listQuery: CategoryItemListQuerySchema,
  createSchema: CategoryItemCreateSchema,
  updateSchema: CategoryItemUpdateSchema,
  itemSchema: CategoryItemSchema,
  listDataSchema: CategoryItemsListResponseDataSchema,
  createExample: {
    categoryId: "44444444-4444-4444-4444-444444444444",
    code: "HIGH",
    name: "High",
    sortOrder: 1,
    status: true
  }
});

registerAdminCrudPaths({
  basePath: "/workflow/task-comments",
  tag: "Workflow",
  entityName: "task-comments",
  listQuery: TaskCommentListQuerySchema,
  createSchema: TaskCommentCreateSchema,
  updateSchema: TaskCommentUpdateSchema,
  itemSchema: TaskCommentSchema,
  listDataSchema: TaskCommentsListResponseDataSchema,
  createExample: {
    taskId: "55555555-5555-5555-5555-555555555555",
    accountId: "66666666-6666-6666-6666-666666666666",
    content: "Need legal review before publish"
  }
});

registerAdminCrudPaths({
  basePath: "/workflow/task-progress",
  tag: "Workflow",
  entityName: "task-progress",
  listQuery: TaskProgressListQuerySchema,
  createSchema: TaskProgressCreateSchema,
  updateSchema: TaskProgressUpdateSchema,
  itemSchema: TaskProgressSchema,
  listDataSchema: TaskProgressListResponseDataSchema,
  createExample: {
    taskId: "55555555-5555-5555-5555-555555555555",
    progressPercent: 70,
    comment: "Waiting for stakeholder approval"
  }
});

registerAdminCrudPaths({
  basePath: "/workflow/task-assignments",
  tag: "Workflow",
  entityName: "task-assignments",
  listQuery: TaskAssignmentListQuerySchema,
  createSchema: TaskAssignmentCreateSchema,
  updateSchema: TaskAssignmentUpdateSchema,
  itemSchema: TaskAssignmentSchema,
  listDataSchema: TaskAssignmentsListResponseDataSchema,
  createExample: {
    taskId: "55555555-5555-5555-5555-555555555555",
    assignedToAccountId: "66666666-6666-6666-6666-666666666666"
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/audit-logs",
  summary: "List audit logs",
  description: "Get audit logs with filtering and pagination (SuperAdmin only, requires permission: audit.read)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    query: AuditLogQuerySchema
  },
  responses: {
    200: {
      description: "List of audit logs with pagination and filters",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: AuditLogsWithPaginationDataSchema
          })
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/audit-logs/stats",
  summary: "Get audit log statistics",
  description: "Get audit log statistics and analytics (SuperAdmin only, requires permission: audit.read)",
  security: [{ bearerAuth: [] }],
  tags: ["Admin"],
  request: {
    query: AuditLogStatsQuerySchema
  },
  responses: {
    200: {
      description: "Audit log statistics",
      content: {
        "application/json": {
          schema: SuccessResponseSchema.extend({
            data: AuditLogStatsSchema
          })
        }
      }
    },
    403: {
      description: "Forbidden - SuperAdmin access required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

export function generateOpenAPIDocument(): ReturnType<OpenApiGeneratorV3["generateDocument"]> {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Supabase Express API",
      description: `A multi-tenant workspace API with role-based access control.
      
## Authorization Pattern

This API uses a consistent header-based authorization for workspace operations:

- **JWT Bearer Token**: Include in Authorization header for authentication
- **x-workspace-id Header**: Required for ALL workspace-scoped endpoints, even when workspace ID is in the URL

### Why Headers?
- Consistent authorization pattern across all endpoints
- Supports future endpoints without workspace ID in URL  
- Explicit workspace context for security
- Extensible for additional context headers

### Profile Data Access
Individual profile endpoints have been removed. Access profiles through workspace context:
- GET /me - Your profiles across all workspaces
- GET /workspaces/{id} - Workspace with all member profiles
- GET /workspaces/{id}/members - Dedicated member listing
- PATCH /workspaces/{id}/profile - Update your own profile in workspace`,
      contact: {
        name: "API Support",
        email: "support@example.com"
      }
    },
    servers: [
      {
        url: config.appUrl,
        description: config.env === "production" ? "Production server" : "Development server"
      }
    ],
    tags: [
      { name: "Authentication", description: "User authentication endpoints" },
      { name: "User", description: "User profile operations" },
      { name: "Workspaces", description: "Workspace management" },
      { name: "Members", description: "Workspace member management" },
      { name: "Content", description: "Content domain operations" },
      { name: "Workflow", description: "Workflow domain operations" },
      { name: "Admin", description: "SuperAdmin operations" }
    ]
  });
}
