import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

/**
 * Live DB introspection source (2026-03-24):
 * - accounts.uuid (PK), is_super_admin boolean default false
 * - workspaces.uuid (PK), account_id uuid
 * - workspace_memberships.uuid (PK), role_id int nullable, status boolean default true
 * - roles.id (PK)
 * - permissions.id (PK)
 * - role_permissions(role_id, permission_id) composite PK
 */
export const rbacAccounts = pgTable("accounts", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  phone: varchar("phone", { length: 256 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
  email: text("email").notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false),
  status: text("status").notNull().default("active")
});

export const rbacWorkspaces = pgTable("workspaces", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
  accountId: uuid("account_id").notNull()
});

export const rbacRoles = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 100 }),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  createdAt: timestamp("created_at", { precision: 6 }).defaultNow()
});

export const rbacPermissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 150 }),
  name: varchar("name", { length: 255 }),
  description: text("description")
});

export const rbacRolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => rbacRoles.id),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => rbacPermissions.id)
  },
  (table) => ({
    pk: primaryKey({ name: "role_permissions_pkey", columns: [table.roleId, table.permissionId] })
  })
);

export const rbacWorkspaceMemberships = pgTable("workspace_memberships", {
  uuid: uuid("uuid").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull(),
  accountId: uuid("account_id").notNull(),
  organizationId: uuid("organization_id"),
  positionId: uuid("position_id"),
  roleId: integer("role_id"),
  status: boolean("status").default(true),
  joinedAt: timestamp("joined_at", { precision: 6 }).defaultNow()
});

export const rbacAccountsRelations = relations(rbacAccounts, ({ many }) => ({
  memberships: many(rbacWorkspaceMemberships),
  ownedWorkspaces: many(rbacWorkspaces)
}));

export const rbacWorkspacesRelations = relations(rbacWorkspaces, ({ one, many }) => ({
  owner: one(rbacAccounts, {
    fields: [rbacWorkspaces.accountId],
    references: [rbacAccounts.uuid]
  }),
  memberships: many(rbacWorkspaceMemberships)
}));

export const rbacWorkspaceMembershipsRelations = relations(rbacWorkspaceMemberships, ({ one }) => ({
  workspace: one(rbacWorkspaces, {
    fields: [rbacWorkspaceMemberships.workspaceId],
    references: [rbacWorkspaces.uuid]
  }),
  account: one(rbacAccounts, {
    fields: [rbacWorkspaceMemberships.accountId],
    references: [rbacAccounts.uuid]
  }),
  role: one(rbacRoles, {
    fields: [rbacWorkspaceMemberships.roleId],
    references: [rbacRoles.id]
  })
}));

export const rbacRolesRelations = relations(rbacRoles, ({ many }) => ({
  memberships: many(rbacWorkspaceMemberships),
  rolePermissions: many(rbacRolePermissions)
}));

export const rbacPermissionsRelations = relations(rbacPermissions, ({ many }) => ({
  rolePermissions: many(rbacRolePermissions)
}));

export const rbacRolePermissionsRelations = relations(rbacRolePermissions, ({ one }) => ({
  role: one(rbacRoles, {
    fields: [rbacRolePermissions.roleId],
    references: [rbacRoles.id]
  }),
  permission: one(rbacPermissions, {
    fields: [rbacRolePermissions.permissionId],
    references: [rbacPermissions.id]
  })
}));

