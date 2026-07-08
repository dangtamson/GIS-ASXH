import { db } from "@/services/db/drizzle.ts";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expandOrganizationDescendants, getAccountOrganizationIds } from "@/handlers/report/common.ts";
import {
  createOrganizationAdmin,
  ensureManagementLevelCombination,
  listOrganizationsAdmin,
  ensureWithinParentScope,
  updateOrganizationAdminById
} from "./organizations.handlers.ts";

vi.mock("@/services/db/drizzle.ts", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("@/services/auditLog.ts", () => ({
  auditHelpers: {
    organizationCreated: vi.fn().mockResolvedValue(undefined),
    organizationUpdated: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock("@/handlers/report/common.ts", () => ({
  getAccountOrganizationIds: vi.fn(),
  expandOrganizationDescendants: vi.fn()
}));

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const VALID_AREA_ID = "22222222-2222-4222-8222-222222222222";
const VALID_PARENT_ID = "33333333-3333-4333-8333-333333333333";

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

const prepareInsertMock = (result: unknown[]) => {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn().mockReturnValue({ returning });
  vi.mocked(db.insert).mockReturnValue({ values } as never);
  return { values };
};

const prepareSelectLimitMock = (result: unknown[]) => {
  const limit = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  vi.mocked(db.select).mockImplementationOnce(() => ({ from }) as never);
  return { from, where, limit };
};

const prepareUpdateMock = (result: unknown[]) => {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  vi.mocked(db.update).mockReturnValue({ set } as never);
  return { set };
};

const queueLocationLabelSelectMocks = () => {
  vi.mocked(db.select)
    .mockImplementationOnce(
      () =>
        ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { code: "92", name: "Can Tho", fullName: "Thanh pho Can Tho" }
            ])
          })
        }) as never
    )
    .mockImplementationOnce(
      () =>
        ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { code: "31117", name: "An Binh", fullName: "Phuong An Binh", provinceCode: "92" }
            ])
          })
        }) as never
    )
    .mockImplementationOnce(
      () =>
        ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: VALID_AREA_ID, name: "Khu vuc 1", wardCode: "31117", provinceCode: "92" }
            ])
          })
        }) as never
    );
};

const queueParentSummarySelectMock = (rows: unknown[]) => {
  vi.mocked(db.select).mockImplementationOnce(
    () =>
      ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows)
        })
      }) as never
  );
};

describe("organizations handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccountOrganizationIds).mockResolvedValue([VALID_ID]);
    vi.mocked(expandOrganizationDescendants).mockImplementation(async (_workspaceId, organizationIds) => organizationIds);
  });

  it("creates organizations with province ward and area identifiers", async () => {
    const { values } = prepareInsertMock([
      {
        uuid: VALID_ID,
        name: "Khu vuc 1",
        code: "KV1",
        workspaceId: VALID_ID,
        parentId: null,
        provinceCode: "92",
        wardCode: "31117",
        areaId: VALID_AREA_ID,
        address: null,
        phone: null,
        email: null,
        status: true,
        sort_order: 1
      }
    ]);
    queueLocationLabelSelectMocks();

    const req = {
      workspaceId: VALID_ID,
      accountId: VALID_ID,
      body: {
        name: "Khu vuc 1",
        code: "KV1",
        provinceCode: "92",
        wardCode: "31117",
        areaId: VALID_AREA_ID,
        sortOrder: 1
      }
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    createOrganizationAdmin(req, res, next);
    await flushAsync();

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: VALID_ID,
        provinceCode: "92",
        wardCode: "31117",
        areaId: VALID_AREA_ID,
        sort_order: 1
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it("updates organizations with province ward and area identifiers", async () => {
    vi.mocked(db.select).mockImplementationOnce(
      () =>
        ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ isSuperAdmin: false }])
            })
          })
        }) as never
    );
    prepareSelectLimitMock([
      {
        uuid: VALID_ID,
        workspaceId: VALID_ID,
        name: "UBND cu",
        code: "UBC",
        provinceCode: null,
        wardCode: null,
        areaId: null
      }
    ]);
    const { set } = prepareUpdateMock([
      {
        uuid: VALID_ID,
        workspaceId: VALID_ID,
        name: "UBND moi",
        code: "UBM",
        provinceCode: "92",
        wardCode: "31117",
        areaId: VALID_AREA_ID
      }
    ]);
    queueLocationLabelSelectMocks();

    const req = {
      workspaceId: VALID_ID,
      accountId: VALID_ID,
      params: { id: VALID_ID },
      body: {
        provinceCode: "92",
        wardCode: "31117",
        areaId: VALID_AREA_ID
      }
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    updateOrganizationAdminById(req, res, next);
    await flushAsync();

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        provinceCode: "92",
        wardCode: "31117",
        areaId: VALID_AREA_ID
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects child organizations outside the parent location scope", async () => {
    prepareSelectLimitMock([
      {
        uuid: VALID_PARENT_ID,
        workspaceId: VALID_ID,
        name: "UBND Phuong An Binh",
        code: "UBPAB",
        provinceCode: "92",
        wardCode: "31117",
        areaId: null
      }
    ]);
    const { values } = prepareInsertMock([]);

    const req = {
      workspaceId: VALID_ID,
      accountId: VALID_ID,
      body: {
        name: "Khu vuc sai pham vi",
        code: "KVX",
        parentId: VALID_PARENT_ID,
        provinceCode: "92",
        wardCode: "31118"
      }
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    createOrganizationAdmin(req, res, next);
    await flushAsync();

    expect(values).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("lists organizations with readable province ward and area labels", async () => {
    vi.mocked(db.select)
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ isSuperAdmin: true }])
              })
            })
          }) as never
      )
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 1 }])
            })
          }) as never
      )
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([
                      {
                        uuid: VALID_ID,
                        workspaceId: VALID_ID,
                        name: "Khu vuc 1",
                        code: "KV1",
                        parentId: VALID_PARENT_ID,
                        provinceCode: "92",
                        wardCode: "31117",
                        areaId: VALID_AREA_ID,
                        address: null,
                        phone: null,
                        email: null,
                        status: true,
                        sort_order: 1
                      }
                    ])
                  })
                })
              })
            })
          }) as never
      )
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { code: "92", name: "Can Tho", fullName: "Thanh pho Can Tho" }
              ])
            })
          }) as never
      )
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { code: "31117", name: "An Binh", fullName: "Phuong An Binh", provinceCode: "92" }
              ])
            })
          }) as never
      )
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: VALID_AREA_ID, name: "Khu vuc 1", wardCode: "31117", provinceCode: "92" }
              ])
            })
          }) as never
      )
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { uuid: VALID_PARENT_ID, name: "UBND Phuong An Binh", code: "UBPAB" }
              ])
            })
          }) as never
      );

    const req = {
      workspaceId: VALID_ID,
      accountId: VALID_ID,
      query: {}
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    const { listOrganizationsAdmin } = await import("./organizations.handlers.ts");

    listOrganizationsAdmin(req, res, next);
    await flushAsync();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: [
            expect.objectContaining({
              parent: expect.objectContaining({
                uuid: VALID_PARENT_ID,
                name: "UBND Phuong An Binh",
                code: "UBPAB"
              }),
              provinceName: "Thanh pho Can Tho",
              wardName: "Phuong An Binh",
              areaName: "Khu vuc 1"
            })
          ]
        })
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("keeps branch admins scoped to their organization descendants instead of the whole workspace", async () => {
    vi.mocked(getAccountOrganizationIds).mockResolvedValue([VALID_PARENT_ID]);
    vi.mocked(expandOrganizationDescendants).mockResolvedValue([VALID_PARENT_ID, VALID_ID]);

    vi.mocked(db.select)
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ isSuperAdmin: false }])
              })
            })
          }) as never
      )
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 2 }])
            })
          }) as never
      )
      .mockImplementationOnce(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([
                      {
                        uuid: VALID_PARENT_ID,
                        workspaceId: VALID_AREA_ID,
                        name: "UBND Phuong An Binh",
                        code: "UBPAB",
                        parentId: null,
                        provinceCode: null,
                        wardCode: null,
                        areaId: null,
                        address: null,
                        phone: null,
                        email: null,
                        status: true,
                        sort_order: 1
                      },
                      {
                        uuid: VALID_ID,
                        workspaceId: VALID_AREA_ID,
                        name: "Khu vuc 1",
                        code: "KV1",
                        parentId: VALID_PARENT_ID,
                        provinceCode: null,
                        wardCode: null,
                        areaId: null,
                        address: null,
                        phone: null,
                        email: null,
                        status: true,
                        sort_order: 2
                      }
                    ])
                  })
                })
              })
            })
          }) as never
      );
    queueParentSummarySelectMock([
      { uuid: VALID_PARENT_ID, name: "UBND Phuong An Binh", code: "UBPAB" }
    ]);

    const req = {
      workspaceId: VALID_AREA_ID,
      accountId: VALID_ID,
      query: {}
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn();

    listOrganizationsAdmin(req, res, next);
    await flushAsync();

    expect(getAccountOrganizationIds).toHaveBeenCalledWith(VALID_ID, VALID_AREA_ID);
    expect(expandOrganizationDescendants).toHaveBeenCalledWith(VALID_AREA_ID, [VALID_PARENT_ID]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("organization location helpers", () => {
  it("rejects wardCode without provinceCode", () => {
    expect(() => ensureManagementLevelCombination({ wardCode: "31117" })).toThrow(
      "wardCode requires provinceCode"
    );
  });

  it("rejects areaId without wardCode", () => {
    expect(() =>
      ensureManagementLevelCombination({
        provinceCode: "92",
        areaId: VALID_AREA_ID
      })
    ).toThrow("areaId requires wardCode");
  });

  it("rejects child locations outside the parent scope", () => {
    expect(() =>
      ensureWithinParentScope(
        {
          provinceCode: "92",
          wardCode: "31117",
          areaId: null
        },
        {
          provinceCode: "92",
          wardCode: "31118",
          areaId: null
        }
      )
    ).toThrow("Child organization must stay inside the parent ward");
  });
});
