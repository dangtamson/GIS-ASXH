import { db } from "@/services/db/drizzle.ts";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateDocumentAdminById, updateFileAdminById, updateNotificationAdminById } from "./index.ts";

vi.mock("@/services/db/drizzle.ts", () => ({
  db: {
    update: vi.fn()
  }
}));

type UpdateHandler = (req: Request, res: Response, next: (err?: unknown) => void) => void;

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

const flushAsync = async (): Promise<void> => {
  await new Promise((resolve) => setImmediate(resolve));
};

const createMockRes = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn()
  };

  return res as unknown as Response;
};

const prepareUpdateMock = (result: unknown[]) => {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });

  vi.mocked(db.update).mockReturnValue({ set } as never);

  return { set };
};

const cases: {
  name: string;
  handler: UpdateHandler;
  payload: Record<string, unknown>;
  expectedSet: Record<string, unknown>;
}[] = [
  {
    name: "documents",
    handler: updateDocumentAdminById,
    payload: { title: "  Document A  ", workspaceId: OTHER_ID, createdBy: OTHER_ID },
    expectedSet: { title: "Document A" }
  },
  {
    name: "files",
    handler: updateFileAdminById,
    payload: { fileName: "  file.pdf  ", uploadedBy: OTHER_ID },
    expectedSet: { fileName: "file.pdf" }
  },
  {
    name: "notifications",
    handler: updateNotificationAdminById,
    payload: { title: "  Notification A  ", workspaceId: OTHER_ID },
    expectedSet: { title: "Notification A" }
  }
];

describe("content update handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(cases)("$name: returns 400 when payload is empty", async ({ handler }) => {
    const req = { params: { id: VALID_ID }, body: {} } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    handler(req, res, next);
    await flushAsync();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it.each(cases)("$name: returns 404 when record not found", async ({ handler, payload }) => {
    prepareUpdateMock([]);

    const req = { params: { id: VALID_ID }, body: payload } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    handler(req, res, next);
    await flushAsync();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(cases)("$name: sanitizes and whitelists update payload", async ({ handler, payload, expectedSet }) => {
    const { set } = prepareUpdateMock([{ uuid: VALID_ID }]);

    const req = { params: { id: VALID_ID }, body: payload } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    handler(req, res, next);
    await flushAsync();

    expect(set).toHaveBeenCalledWith(expectedSet);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
