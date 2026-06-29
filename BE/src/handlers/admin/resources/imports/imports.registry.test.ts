import { describe, expect, it } from "vitest";
import { getImportModule, previewImportRows } from "./imports.registry.ts";

describe("imports registry", () => {
  it("exposes poverty household field metadata", () => {
    const module = getImportModule("poverty-households");

    expect(module.key).toBe("poverty-households");
    expect(module.fields.map((field) => field.key)).toContain("code");
    expect(module.fields.find((field) => field.key === "povertyType")?.validations).toEqual([
      { rule: "required", errorMessage: "Loại hộ là bắt buộc" }
    ]);
    expect(module.fields.find((field) => field.key === "povertyType")?.fieldType).toEqual({
      type: "select",
      options: [
        { label: "Hộ nghèo", value: "POOR" },
        { label: "Hộ cận nghèo", value: "NEAR_POOR" },
        { label: "Không còn nghèo/cận nghèo", value: "NONE" }
      ]
    });
  });

  it("previews normalized rows and row-level validation errors", () => {
    const result = previewImportRows("poverty-households", [
      {
        code: " HN-001 ",
        year: "2026",
        povertyType: "Hộ nghèo",
        provinceName: "Hà Nội",
        latitude: "21.03",
        longitude: "105.84"
      },
      {
        code: "HN-002",
        year: "2026",
        povertyType: "Không còn nghèo/cận nghèo"
      },
      {
        code: "",
        year: "abc",
        povertyType: "Không rõ"
      }
    ]);

    expect(result.validRows).toEqual([
      {
        rowNumber: 1,
        data: {
          code: "HN-001",
          year: 2026,
          povertyType: "POOR",
          provinceName: "Hà Nội",
          latitude: 21.03,
          longitude: 105.84
        }
      },
      {
        rowNumber: 2,
        data: {
          code: "HN-002",
          year: 2026,
          povertyType: "NONE"
        }
      }
    ]);
    expect(result.errors).toEqual([
      { rowNumber: 3, field: "code", message: "Mã hộ là bắt buộc" },
      { rowNumber: 3, field: "year", message: "Năm là bắt buộc" },
      { rowNumber: 3, field: "povertyType", message: "Loại hộ không hợp lệ" }
    ]);
  });

  it("rejects unknown import modules", () => {
    expect(() => getImportModule("missing")).toThrow("Unsupported import module: missing");
  });
});
