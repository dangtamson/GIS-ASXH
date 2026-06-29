import {
    createCategoryAdmin,
    createCategoryItemAdmin,
    createOrganizationAdmin,
    createPermissionAdmin,
    createRoleAdmin,
    createRolePermissionAdmin,
    deleteCategoryAdminById,
    deleteCategoryItemAdminById,
    deleteOrganizationAdminById,
    deletePermissionAdminById,
    deleteRoleAdminById,
    deleteRolePermissionAdminById,
    getCategoryAdminById,
    getCategoryItemAdminById,
    getOrganizationAdminById,
    getPermissionAdminById,
    getRoleAdminById,
    getRolePermissionAdminById,
    listCategoriesAdmin,
    listCategoryItemsAdmin,
    listOrganizationsAdmin,
    listPermissionsAdmin,
    listRolePermissionsAdmin,
    listRolesAdmin,
    updateCategoryAdminById,
    updateCategoryItemAdminById,
    updateOrganizationAdminById,
    updatePermissionAdminById,
    updateRoleAdminById,
    updateRolePermissionAdminById
} from "@/handlers/admin/resources/master-data/index.ts";
import type { Application, RequestHandler } from "express";

export function registerMasterDataAdminRoutes(app: Application, guards: readonly RequestHandler[]): void {
  app.get("/admin/categories", ...guards, listCategoriesAdmin);
  app.post("/admin/categories", ...guards, createCategoryAdmin);
  app.get("/admin/categories/:id", ...guards, getCategoryAdminById);
  app.patch("/admin/categories/:id", ...guards, updateCategoryAdminById);
  app.delete("/admin/categories/:id", ...guards, deleteCategoryAdminById);

  app.get("/admin/organizations", ...guards, listOrganizationsAdmin);
  app.post("/admin/organizations", ...guards, createOrganizationAdmin);
  app.get("/admin/organizations/:id", ...guards, getOrganizationAdminById);
  app.patch("/admin/organizations/:id", ...guards, updateOrganizationAdminById);
  app.delete("/admin/organizations/:id", ...guards, deleteOrganizationAdminById);

  app.get("/admin/category-items", ...guards, listCategoryItemsAdmin);
  app.post("/admin/category-items", ...guards, createCategoryItemAdmin);
  app.get("/admin/category-items/:id", ...guards, getCategoryItemAdminById);
  app.patch("/admin/category-items/:id", ...guards, updateCategoryItemAdminById);
  app.delete("/admin/category-items/:id", ...guards, deleteCategoryItemAdminById);

  app.get("/admin/roles", ...guards, listRolesAdmin);
  app.post("/admin/roles", ...guards, createRoleAdmin);
  app.get("/admin/roles/:id", ...guards, getRoleAdminById);
  app.patch("/admin/roles/:id", ...guards, updateRoleAdminById);
  app.delete("/admin/roles/:id", ...guards, deleteRoleAdminById);

  app.get("/admin/permissions", ...guards, listPermissionsAdmin);
  app.post("/admin/permissions", ...guards, createPermissionAdmin);
  app.get("/admin/permissions/:id", ...guards, getPermissionAdminById);
  app.patch("/admin/permissions/:id", ...guards, updatePermissionAdminById);
  app.delete("/admin/permissions/:id", ...guards, deletePermissionAdminById);

  app.get("/admin/role-permissions", ...guards, listRolePermissionsAdmin);
  app.post("/admin/role-permissions", ...guards, createRolePermissionAdmin);
  app.get("/admin/role-permissions/:roleId/:permissionId", ...guards, getRolePermissionAdminById);
  app.patch("/admin/role-permissions/:roleId/:permissionId", ...guards, updateRolePermissionAdminById);
  app.delete("/admin/role-permissions/:roleId/:permissionId", ...guards, deleteRolePermissionAdminById);
}