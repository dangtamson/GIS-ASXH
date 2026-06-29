import { describe, expect, it } from "vitest";
import XLSX from "xlsx-js-style";
import { parseHouseholdWorkbook } from "./poverty.excel.ts";

const buildWorkbookBase64 = (rows: unknown[][]): string => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ho ngheo");
  return XLSX.write(workbook, { bookType: "xlsx", type: "base64" }) as string;
};

describe("parseHouseholdWorkbook", () => {
  it("maps Vietnamese household headers into normalized import rows", () => {
    const fileContentBase64 = buildWorkbookBase64([
      ["Mã hộ", "Năm", "Loại hộ", "Tỉnh", "Xã", "Khu vực", "Địa chỉ", "Vĩ độ", "Kinh độ"],
      ["HN-001", 2026, "Hộ nghèo", "Hà Nội", "Phúc Xá", "Tổ 1", "Số 1", 21.03, 105.84],
      ["HN-002", 2026, "Hộ cận nghèo", "Hà Nội", "Trúc Bạch", "Tổ 2", "Số 2", "", ""],
      ["HN-003", 2026, "Không còn nghèo/cận nghèo", "Hà Nội", "Trúc Bạch", "Tổ 3", "Số 3", "", ""]
    ]);

    const result = parseHouseholdWorkbook(fileContentBase64);

    expect(result.validRows).toEqual([
      {
        rowNumber: 2,
        data: {
          code: "HN-001",
          year: 2026,
          povertyType: "POOR",
          provinceName: "Hà Nội",
          wardName: "Phúc Xá",
          areaName: "Tổ 1",
          address: "Số 1",
          latitude: 21.03,
          longitude: 105.84
        }
      },
      {
        rowNumber: 3,
        data: {
          code: "HN-002",
          year: 2026,
          povertyType: "NEAR_POOR",
          provinceName: "Hà Nội",
          wardName: "Trúc Bạch",
          areaName: "Tổ 2",
          address: "Số 2"
        }
      },
      {
        rowNumber: 4,
        data: {
          code: "HN-003",
          year: 2026,
          povertyType: "NONE",
          provinceName: "Hà Nội",
          wardName: "Trúc Bạch",
          areaName: "Tổ 3",
          address: "Số 3"
        }
      }
    ]);
    expect(result.errors).toEqual([]);
  });

  it("returns row errors when required values are missing", () => {
    const fileContentBase64 = buildWorkbookBase64([
      ["Mã hộ", "Năm", "Loại hộ"],
      ["", 2026, "Hộ nghèo"],
      ["HN-003", "", "Hộ nghèo"],
      ["HN-004", 2026, "Không rõ"]
    ]);

    const result = parseHouseholdWorkbook(fileContentBase64);

    expect(result.validRows).toEqual([]);
    expect(result.errors).toEqual([
      { rowNumber: 2, message: "Mã hộ là bắt buộc" },
      { rowNumber: 3, message: "Năm là bắt buộc" },
      { rowNumber: 4, message: "Loại hộ không hợp lệ" }
    ]);
  });
});
