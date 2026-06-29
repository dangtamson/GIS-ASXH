const PERMISSION_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheRecord = {
  expiresAt: number;
  value: Set<string>;
};

const permissionCache = new Map<string, CacheRecord>();

export function buildPermissionCacheKey(userId: string, workspaceId: string): string {
  return `perm:${userId}:${workspaceId}`;
}

export function getCache(key: string): Set<string> | null {
  const hit = permissionCache.get(key);

  if (!hit) {
    return null;
  }

  if (Date.now() >= hit.expiresAt) {
    permissionCache.delete(key);
    return null;
  }

  return hit.value;
}

export function setCache(key: string, value: Iterable<string>): void {
  permissionCache.set(key, {
    expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS,
    value: new Set(value)
  });
}

export function invalidateUserWorkspace(userId: string, workspaceId: string): void {
  permissionCache.delete(buildPermissionCacheKey(userId, workspaceId));
}

