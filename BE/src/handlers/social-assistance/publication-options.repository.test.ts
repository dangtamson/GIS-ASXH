import { beforeEach, describe, expect, it, vi } from "vitest";

const { select } = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/services/db/drizzle.ts", () => ({ db: { select } }));

import { getSocialAssistancePublicationOptions } from "./publications.repository.ts";

const scope = {
    organizationIds: ["org-1"],
    provinceCodes: [],
    wardCodes: ["31117"],
    areaIds: [],
    isBranchAdmin: false,
    isSuperAdmin: false,
    hasScope: true
};

describe("social assistance publication options repository", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns workspace program labels and only in-scope geography codes", async () => {
        const programRows = [{ id: "program-1", title: "Hỗ trợ nhà ở" }];
        const geographyRows = [{ provinceCode: "92", wardCode: "31117" }];
        select.mockImplementationOnce(() => ({
            from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(programRows) })
        })).mockImplementationOnce(() => ({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ groupBy: vi.fn().mockResolvedValue(geographyRows) })
            })
        }));

        await expect(getSocialAssistancePublicationOptions("workspace-1", scope)).resolves.toEqual({
            programs: programRows,
            geographies: geographyRows
        });
        expect(select).toHaveBeenCalledTimes(2);
    });

    it("does not load options without a location scope", async () => {
        await expect(getSocialAssistancePublicationOptions("workspace-1", { ...scope, hasScope: false })).resolves.toBeNull();
        expect(select).not.toHaveBeenCalled();
    });
});