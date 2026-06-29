import { organizations, workspaceMemberships } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, eq, inArray } from "drizzle-orm";

export async function getAccountOrganizationIds(
  accountId: string,
  workspaceId: string
): Promise<string[]> {
  if (!accountId || !workspaceId) {
    return [];
  }

  const rows = await db
    .select({ organizationId: workspaceMemberships.organizationId })
    .from(workspaceMemberships)
    .where(and(eq(workspaceMemberships.accountId, accountId), eq(workspaceMemberships.workspaceId, workspaceId)))
    .execute();

  return rows.map((row) => String(row.organizationId ?? "").trim()).filter(Boolean);
}

export async function expandOrganizationDescendants(
  workspaceId: string,
  organizationIds: string[]
): Promise<string[]> {
  if (!workspaceId || organizationIds.length === 0) {
    return organizationIds;
  }

  const rows = await db
    .select({ uuid: organizations.uuid, parentId: organizations.parentId })
    .from(organizations)
    .where(eq(organizations.workspaceId, workspaceId))
    .execute();

  const childrenByParent = new Map<string, string[]>();
  rows.forEach((row) => {
    const parentId = String(row.parentId ?? "").trim();
    const id = String(row.uuid ?? "").trim();
    if (!id) return;
    const list = childrenByParent.get(parentId) || [];
    list.push(id);
    childrenByParent.set(parentId, list);
  });

  const visited = new Set<string>();
  const queue = [...organizationIds];
  organizationIds.forEach((id) => visited.add(id));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const children = childrenByParent.get(current) || [];
    children.forEach((child) => {
      if (!visited.has(child)) {
        visited.add(child);
        queue.push(child);
      }
    });
  }

  return Array.from(visited);
}
