import { importHouseholdRow } from "../poverty/poverty.repository.ts";
import {
  type ImportedHouseholdInput,
  normalizeHouseholdStatus,
  normalizePovertyType
} from "../poverty/poverty.schemas.ts";

type ImportFieldValidation = {
  rule: "required" | "unique" | "regex";
  errorMessage: string;
};

export type ImportField = {
  key: string;
  label: string;
  fieldType?: {
    type: "input" | "checkbox" | "select";
    options?: { label: string; value: string }[];
  };
  alternateMatches?: string[];
  validations?: ImportFieldValidation[];
  example?: string;
};

export type ImportRowError = {
  rowNumber: number;
  field?: string;
  message: string;
};

export type ImportPreviewRow<TData = Record<string, unknown>> = {
  rowNumber: number;
  data: TData;
};

export type ImportPreviewResult<TData = Record<string, unknown>> = {
  validRows: ImportPreviewRow<TData>[];
  errors: ImportRowError[];
  totalRows: number;
};

export type ImportCommitResult = {
  created: string[];
  updated: string[];
  failed: number;
  errors: ImportRowError[];
};

type ImportModule<TData> = {
  key: string;
  name: string;
  fields: ImportField[];
  preview: (rows: Record<string, unknown>[]) => ImportPreviewResult<TData>;
  commit: (rows: TData[]) => Promise<ImportCommitResult>;
};

const toOptionalText = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const createPovertyHouseholdPreview = (rows: Record<string, unknown>[]): ImportPreviewResult<ImportedHouseholdInput> => {
  const validRows: ImportPreviewRow<ImportedHouseholdInput>[] = [];
  const errors: ImportRowError[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const rowErrors: ImportRowError[] = [];
    const code = toOptionalText(row.code);
    const year = toOptionalNumber(row.year);
    const povertyType = normalizePovertyType(row.povertyType);
    const status = normalizeHouseholdStatus(row.status);
    const latitude = toOptionalNumber(row.latitude);
    const longitude = toOptionalNumber(row.longitude);

    if (!code) rowErrors.push({ rowNumber, field: "code", message: "Mã hộ là bắt buộc" });
    if (!year) rowErrors.push({ rowNumber, field: "year", message: "Năm là bắt buộc" });
    if (!povertyType) rowErrors.push({ rowNumber, field: "povertyType", message: "Loại hộ không hợp lệ" });
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      rowErrors.push({ rowNumber, field: "latitude", message: "Vĩ độ phải nằm trong khoảng -90 đến 90" });
    }
    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      rowErrors.push({ rowNumber, field: "longitude", message: "Kinh độ phải nằm trong khoảng -180 đến 180" });
    }

    if (rowErrors.length > 0 || !code || !year || !povertyType) {
      errors.push(...rowErrors);
      return;
    }

    validRows.push({
      rowNumber,
      data: {
        code,
        year,
        povertyType,
        ...(status ? { status } : {}),
        ...(toOptionalText(row.provinceName) ? { provinceName: toOptionalText(row.provinceName) } : {}),
        ...(toOptionalText(row.wardName) ? { wardName: toOptionalText(row.wardName) } : {}),
        ...(toOptionalText(row.areaName) ? { areaName: toOptionalText(row.areaName) } : {}),
        ...(toOptionalText(row.address) ? { address: toOptionalText(row.address) } : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {})
      }
    });
  });

  return { validRows, errors, totalRows: rows.length };
};

const povertyHouseholdModule: ImportModule<ImportedHouseholdInput> = {
  key: "poverty-households",
  name: "Import hộ nghèo/cận nghèo",
  fields: [
    {
      key: "code",
      label: "Mã hộ",
      alternateMatches: ["ma ho", "code", "mã hộ"],
      validations: [{ rule: "required", errorMessage: "Mã hộ là bắt buộc" }],
      example: "HN-001"
    },
    {
      key: "year",
      label: "Năm",
      alternateMatches: ["nam", "year", "năm"],
      validations: [{ rule: "required", errorMessage: "Năm là bắt buộc" }],
      example: "2026"
    },
    {
      key: "povertyType",
      label: "Loại hộ",
      alternateMatches: ["loai ho", "loại hộ", "poverty type"],
      fieldType: {
        type: "select",
        options: [
          { label: "Hộ nghèo", value: "POOR" },
          { label: "Hộ cận nghèo", value: "NEAR_POOR" },
          { label: "Không còn nghèo/cận nghèo", value: "NONE" }
        ]
      },
      validations: [{ rule: "required", errorMessage: "Loại hộ là bắt buộc" }],
      example: "Hộ nghèo"
    },
    { key: "status", label: "Trạng thái", alternateMatches: ["trang thai", "status"], example: "ACTIVE" },
    { key: "provinceName", label: "Tỉnh/Thành phố", alternateMatches: ["tinh", "province", "tỉnh"], example: "Hà Nội" },
    { key: "wardName", label: "Xã/Phường", alternateMatches: ["xa", "ward", "xã"], example: "Phúc Xá" },
    { key: "areaName", label: "Khu vực", alternateMatches: ["khu vuc", "area", "khu vực"], example: "Tổ 1" },
    { key: "address", label: "Địa chỉ", alternateMatches: ["dia chi", "address", "địa chỉ"], example: "Số 1" },
    { key: "latitude", label: "Vĩ độ", alternateMatches: ["vi do", "latitude", "lat", "vĩ độ"], example: "21.03" },
    { key: "longitude", label: "Kinh độ", alternateMatches: ["kinh do", "longitude", "lng", "kinh độ"], example: "105.84" }
  ],
  preview: createPovertyHouseholdPreview,
  commit: async (rows) => {
    const created: string[] = [];
    const updated: string[] = [];
    const errors: ImportRowError[] = [];

    for (const [index, row] of rows.entries()) {
      try {
        const result = await importHouseholdRow(row);
        if (result.item?.id && result.action === "created") created.push(result.item.id);
        if (result.item?.id && result.action === "updated") updated.push(result.item.id);
      } catch (error) {
        errors.push({
          rowNumber: index + 1,
          message: error instanceof Error ? error.message : "Không thể lưu dòng dữ liệu"
        });
      }
    }

    return { created, updated, failed: errors.length, errors };
  }
};

const importModules: Record<string, ImportModule<unknown>> = {
  [povertyHouseholdModule.key]: povertyHouseholdModule as ImportModule<unknown>
};

export const getImportModule = (key: string): ImportModule<unknown> => {
  const module = importModules[key];
  if (!module) {
    throw new Error(`Unsupported import module: ${key}`);
  }
  return module;
};

export const previewImportRows = (key: string, rows: Record<string, unknown>[]): ImportPreviewResult<unknown> => {
  return getImportModule(key).preview(rows);
};
