import XLSX from "xlsx-js-style";
import {
  type ImportedHouseholdInput,
  normalizeHouseholdStatus,
  normalizePovertyType
} from "./poverty.schemas.ts";

export type HouseholdImportRow = {
  rowNumber: number;
  data: ImportedHouseholdInput;
};

export type HouseholdImportError = {
  rowNumber: number;
  message: string;
};

export type HouseholdImportParseResult = {
  validRows: HouseholdImportRow[];
  errors: HouseholdImportError[];
};

export type HouseholdExportRow = {
  id?: string;
  code: string | null;
  year: number;
  povertyType: string | null;
  status?: string | null;
  provinceName?: string | null;
  wardName?: string | null;
  areaName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type PovertyReportRow = {
  area: string;
  year: number | null;
  poorCount: number;
  nearPoorCount: number;
  total: number;
  totalHouseholds: number;
  poorRatePercent: number;
  nearPoorRatePercent: number;
};

export type PovertyReportDetailRow = {
  code: string | null;
  headFullName: string | null;
  povertyType: string | null;
  address: string | null;
  memberCount: number;
  status: string | null;
  year: number;
};

const HEADER_ALIASES: Record<string, keyof ImportedHouseholdInput> = {
  "ma ho": "code",
  code: "code",
  nam: "year",
  year: "year",
  "loai ho": "povertyType",
  "loai ngheo": "povertyType",
  povertytype: "povertyType",
  poverty_type: "povertyType",
  "trang thai": "status",
  status: "status",
  tinh: "provinceName",
  province: "provinceName",
  province_name: "provinceName",
  xa: "wardName",
  ward: "wardName",
  ward_name: "wardName",
  "khu vuc": "areaName",
  area: "areaName",
  area_name: "areaName",
  "dia chi": "address",
  address: "address",
  "vi do": "latitude",
  latitude: "latitude",
  lat: "latitude",
  "kinh do": "longitude",
  longitude: "longitude",
  lng: "longitude",
  lon: "longitude"
};

const normalizeHeader = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9_]+/g, " ")
    .trim();

const toOptionalText = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readWorkbookRows = (fileContentBase64: string): unknown[][] => {
  const workbook = XLSX.read(fileContentBase64, { type: "base64", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: ""
  }) as unknown[][];
};

export const parseHouseholdWorkbook = (fileContentBase64: string): HouseholdImportParseResult => {
  const rows = readWorkbookRows(fileContentBase64);
  const headerRow = rows[0] ?? [];
  const mappedHeaders = headerRow.map((header) => HEADER_ALIASES[normalizeHeader(header)]);
  const validRows: HouseholdImportRow[] = [];
  const errors: HouseholdImportError[] = [];

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const raw: Partial<Record<keyof ImportedHouseholdInput, unknown>> = {};

    mappedHeaders.forEach((key, columnIndex) => {
      if (!key) return;
      raw[key] = row[columnIndex];
    });

    const code = toOptionalText(raw.code);
    if (!code) {
      errors.push({ rowNumber, message: "Mã hộ là bắt buộc" });
      return;
    }

    const year = toOptionalNumber(raw.year);
    if (!year) {
      errors.push({ rowNumber, message: "Năm là bắt buộc" });
      return;
    }

    const povertyType = normalizePovertyType(raw.povertyType);
    if (!povertyType) {
      errors.push({ rowNumber, message: "Loại hộ không hợp lệ" });
      return;
    }

    const status = normalizeHouseholdStatus(raw.status);
    const latitude = toOptionalNumber(raw.latitude);
    const longitude = toOptionalNumber(raw.longitude);

    validRows.push({
      rowNumber,
      data: {
        code,
        year,
        povertyType,
        ...(status ? { status } : {}),
        ...(toOptionalText(raw.provinceName) ? { provinceName: toOptionalText(raw.provinceName) } : {}),
        ...(toOptionalText(raw.wardName) ? { wardName: toOptionalText(raw.wardName) } : {}),
        ...(toOptionalText(raw.areaName) ? { areaName: toOptionalText(raw.areaName) } : {}),
        ...(toOptionalText(raw.address) ? { address: toOptionalText(raw.address) } : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {})
      }
    });
  });

  return { validRows, errors };
};

const householdExportHeaders = [
  "ID",
  "Mã hộ",
  "Năm",
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
];

export const buildHouseholdExportWorkbook = (rows: HouseholdExportRow[]): string => {
  const data = [
    householdExportHeaders,
    ...rows.map((row) => [
      row.id ?? "",
      row.code ?? "",
      row.year ?? "",
      row.povertyType ?? "",
      row.status ?? "",
      row.provinceName ?? "",
      row.wardName ?? "",
      row.areaName ?? "",
      row.address ?? "",
      row.latitude ?? "",
      row.longitude ?? "",
      row.createdAt ? String(row.createdAt) : "",
      row.updatedAt ? String(row.updatedAt) : ""
    ])
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ho ngheo");
  return XLSX.write(workbook, { bookType: "xlsx", type: "base64" }) as string;
};

export const buildPovertyReportWorkbook = (rows: PovertyReportRow[]): string => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Năm báo cáo", "Khu vực", "Hộ nghèo", "Hộ cận nghèo", "Tổng hộ nghèo/cận nghèo", "Tổng số hộ", "Tỷ lệ hộ nghèo (%)", "Tỷ lệ hộ cận nghèo (%)"],
    ...rows.map((row) => [row.year ?? "", row.area, row.poorCount, row.nearPoorCount, row.total, row.totalHouseholds, row.poorRatePercent, row.nearPoorRatePercent])
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bao cao");
  return XLSX.write(workbook, { bookType: "xlsx", type: "base64" }) as string;
};

export const buildPovertyReportDetailWorkbook = (rows: PovertyReportDetailRow[]): string => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Mã hộ", "Tên chủ hộ", "Loại hộ", "Địa chỉ", "Số thành viên", "Trạng thái", "Năm báo cáo"],
    ...rows.map((row) => [row.code ?? "", row.headFullName ?? "", row.povertyType ?? "", row.address ?? "", row.memberCount, row.status ?? "", row.year])
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Chi tiet ho");
  return XLSX.write(workbook, { bookType: "xlsx", type: "base64" }) as string;
};
