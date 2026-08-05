import { describe, expect, it } from "vitest";
import XLSX from "xlsx-js-style";
import { buildHouseholdExportWorkbook, parseHouseholdWorkbook } from "./poverty.excel.ts";

const buildWorkbookBase64 = (rows: unknown[][]): string => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ho ngheo");
  return XLSX.write(workbook, { bookType: "xlsx", type: "base64" }) as string;
};

const readWorkbookRows = (fileContentBase64: string): unknown[][] => {
  const workbook = XLSX.read(fileContentBase64, { type: "base64", cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
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

describe("buildHouseholdExportWorkbook", () => {
  it("includes head of household name and human-readable poverty type labels", () => {
    const fileContentBase64 = buildHouseholdExportWorkbook([
      {
        id: "household-1",
        code: "HN-001",
        year: 2026,
        povertyType: "POOR",
        headFullName: "Nguyen Van A",
        status: "ACTIVE",
        provinceName: "Cần Thơ",
        wardName: "Phường 1",
        areaName: "Khu vực 1",
        address: "Số 1",
        latitude: 10.03,
        longitude: 105.78,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z"
      },
      {
        id: "household-2",
        code: "HN-002",
        year: 2026,
        povertyType: "NEAR_POOR",
        headFullName: "Tran Thi B",
        status: "ACTIVE"
      }
    ]);

    const rows = readWorkbookRows(fileContentBase64);

    expect(rows[0]).toEqual([
      "ID",
      "Mã hộ",
      "Năm",
      "Tên chủ hộ",
      "Loại hộ",
      "Trạng thái",
      "Tỉnh/Thành phố",
      "Xã/Phường",
      "Khu vực",
      "Địa chỉ",
      "Vĩ độ",
      "Kinh độ",
      "Ngày tạo",
      "Ngày cập nhật"
    ]);
    expect(rows[1]?.slice(0, 6)).toEqual([
      "household-1",
      "HN-001",
      2026,
      "Nguyen Van A",
      "Hộ nghèo",
      "ACTIVE"
    ]);
    expect(rows[2]?.slice(0, 6)).toEqual([
      "household-2",
      "HN-002",
      2026,
      "Tran Thi B",
      "Hộ cận nghèo",
      "ACTIVE"
    ]);
  });
});
