import { getUserPermissionsFromDB } from "@/repositories/rbac.repository.ts";
import { buildPermissionCacheKey, getCache, setCache, invalidateUserWorkspace } from "@/shared/rbac/permission-cache.ts";

export type AuthUser = {
  id: string;
  isSuperAdmin: boolean;
};

function hasPermissionWithWildcard(permissionSet: Set<string>, permission: string): boolean {
  if (permissionSet.has(permission)) {
    return true;
  }

  const dotIndex = permission.indexOf(".");
  if (dotIndex <= 0) {
    return false;
  }

  const resource = permission.slice(0, dotIndex);
  return permissionSet.has(`${resource}.*`);
}

export async function getWorkspacePermissionSet(user: AuthUser, workspaceId: string): Promise<Set<string>> {
  if (user.isSuperAdmin) {
    return new Set();
  }

  const key = buildPermissionCacheKey(user.id, workspaceId);
  const cached = getCache(key);
  if (cached) {
    return cached;
  }

  const permissions = await getUserPermissionsFromDB(user.id, workspaceId);
  const permissionSet = new Set(permissions);
  setCache(key, permissionSet);

  return permissionSet;
}

export async function checkPermission(user: AuthUser, workspaceId: string, permission: string): Promise<boolean> {
  if (user.isSuperAdmin) {
    return true;
  }

  const permissionSet = await getWorkspacePermissionSet(user, workspaceId);
  return hasPermissionWithWildcard(permissionSet, permission);
}

export { invalidateUserWorkspace };

