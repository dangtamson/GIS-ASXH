"use client";

import { getAccount, getWorkspaceId } from "@/lib/auth";
import { api } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const TTL_MS = 5 * 60 * 1000;

type PermissionCacheRecord = {
  expiresAt: number;
  permissionSet: Set<string>;
};

const permissionCache = new Map<string, PermissionCacheRecord>();

type EffectivePermissionResponse = {
  permissionCodes?: string[];
};

function getWorkspacePermissionSetFromCache(workspaceId: string): Set<string> | null {
  const hit = permissionCache.get(workspaceId);
  if (!hit) {
    return null;
  }

  if (Date.now() >= hit.expiresAt) {
    permissionCache.delete(workspaceId);
    return null;
  }

  return hit.permissionSet;
}

async function getWorkspacePermissionSet(workspaceId: string): Promise<Set<string>> {
  const cached = getWorkspacePermissionSetFromCache(workspaceId);
  if (cached) {
    return cached;
  }

  const data = await api.get<EffectivePermissionResponse>(`/workspaces/${workspaceId}/effective-permissions`);
  const permissionSet = new Set((data.permissionCodes ?? []).filter((code) => typeof code === "string" && code.length));

  permissionCache.set(workspaceId, {
    expiresAt: Date.now() + TTL_MS,
    permissionSet
  });

  return permissionSet;
}

function hasPermission(permissionSet: Set<string>, permission: string): boolean {
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

export function usePermission(permission: string): { can: boolean; loading: boolean; error: string | null } {
  const account = useMemo(() => getAccount(), []);
  const workspaceId = useMemo(() => getWorkspaceId(), []);
  const isSuperAdmin = Boolean(account?.isSuperAdmin);

  const [can, setCan] = useState<boolean>(isSuperAdmin);
  const [loading, setLoading] = useState<boolean>(!isSuperAdmin && Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);
  const missingWorkspace = !isSuperAdmin && !workspaceId;

  useEffect(() => {
    let active = true;

    if (isSuperAdmin || !workspaceId) {
      return () => {
        active = false;
      };
    }

    getWorkspacePermissionSet(workspaceId)
      .then((permissionSet) => {
        if (!active) {
          return;
        }
        setCan(hasPermission(permissionSet, permission));
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        setCan(false);
        setError(err instanceof Error ? err.message : "Failed to load permissions");
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSuperAdmin, permission, workspaceId]);

  return {
    can: isSuperAdmin ? true : can,
    loading: missingWorkspace ? false : loading,
    error: missingWorkspace ? "Missing workspaceId" : error
  };
}

