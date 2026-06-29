import { authenticate, requirePermission, requireWorkspace } from "@/middleware/rbac.ts";
import { accounts, tasks, workspaceMemberships, workspaces } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, eq } from "drizzle-orm";
import { Router, type Request, type Response } from "express";

export const rbacExamplesRouter = Router();

/**
 * GET /workspaces
 * - superadmin: all workspaces
 * - normal user: only joined workspaces
 */
rbacExamplesRouter.get("/workspaces", authenticate, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ message: "Unauthenticated" });
    return;
  }

  if (user.isSuperAdmin) {
    const allWorkspaces = await db.select().from(workspaces).orderBy(workspaces.createdAt);
    res.json(allWorkspaces);
    return;
  }

  const memberWorkspaces = await db
    .select({
      uuid: workspaces.uuid,
      name: workspaces.name,
      description: workspaces.description,
      createdAt: workspaces.createdAt,
      accountId: workspaces.accountId
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.uuid))
    .where(and(eq(workspaceMemberships.accountId, user.id), eq(workspaceMemberships.status, true)))
    .orderBy(workspaces.createdAt);

  res.json(memberWorkspaces);
});

/**
 * GET /workspace/:id/users
 * - superadmin: allowed
 * - normal user: must belong to workspace (requireWorkspace middleware)
 */
rbacExamplesRouter.get("/workspace/:id/users", authenticate, requireWorkspace, async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId as string;

  const users = await db
    .select({
      uuid: accounts.uuid,
      fullName: accounts.fullName,
      email: accounts.email,
      roleId: workspaceMemberships.roleId
    })
    .from(workspaceMemberships)
    .innerJoin(accounts, eq(workspaceMemberships.accountId, accounts.uuid))
    .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.status, true)));

  res.json(users);
});

/**
 * GET /tasks
 * Requires task.read
 */
rbacExamplesRouter.get(
  "/tasks",
  authenticate,
  requireWorkspace,
  requirePermission("task.read"),
  async (req: Request, res: Response) => {
    const workspaceId = req.workspaceId as string;
    const taskList = await db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId));
    res.json(taskList);
  }
);

/**
 * POST /tasks
 * Requires task.create
 */
rbacExamplesRouter.post(
  "/tasks",
  authenticate,
  requireWorkspace,
  requirePermission("task.create"),
  async (req: Request, res: Response) => {
    const workspaceId = req.workspaceId as string;
    const userId = req.user?.id as string;
    const title = String(req.body?.title || "").trim();

    if (!title) {
      res.status(400).json({ message: "title is required" });
      return;
    }

    const [createdTask] = await db
      .insert(tasks)
      .values({
        workspaceId,
        title,
        description: req.body?.description ?? null,
        createdBy: userId
      })
      .returning();

    res.status(201).json(createdTask);
  }
);

