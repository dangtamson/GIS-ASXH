import * as XLSX from "xlsx-js-style";
import type { DistributionBatchLineInput } from "@/types/social-assistance";

export type DistributionLocalityOption = {
    provinceCode: string;
    provinceLabel: string;
    wardCode: string;
    wardLabel: string;
};

export type DistributionImportIssue = {
    rowNumber: number;
    field: string;
    message: string;
};

export type DistributionLineImportResult = {
    lines: DistributionBatchLineInput[];
    errors: DistributionImportIssue[];
};

const normalizeText = (value: string): string => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9]/g, "");

const getCell = (row: Record<string, unknown>, names: string[]): string => {
    const acceptedNames = new Set(names.map(normalizeText));
    const entry = Object.entries(row).find(([key]) => acceptedNames.has(normalizeText(key)));
    return entry?.[1] == null ? "" : String(entry[1]).trim();
};

const addIssue = (
    errors: DistributionImportIssue[],
    rowNumber: number,
    field: string,
    message: string
): void => {
    errors.push({ rowNumber, field, message });
};

const findProvinceCodes = (input: string, localities: DistributionLocalityOption[]): string[] => {
    const normalizedInput = normalizeText(input);
    return [...new Set(localities.filter((locality) =>
        locality.provinceCode.trim() === input || normalizeText(locality.provinceLabel) === normalizedInput
    ).map((locality) => locality.provinceCode))];
};

export const normalizeDistributionLineImportRows = (
    rows: Record<string, unknown>[],
    localities: DistributionLocalityOption[]
): DistributionLineImportResult => {
    const lines: DistributionBatchLineInput[] = [];
    const errors: DistributionImportIssue[] = [];
    const seen = new Set<string>();

    rows.forEach((row, index) => {
        if (Object.values(row).every((value) => value == null || String(value).trim() === "")) return;
        const rowNumber = index + 2;
        const provinceInput = getCell(row, ["provinceCode", "province", "provinceName", "Tỉnh/thành phố"]);
        const wardInput = getCell(row, ["wardCode", "ward", "wardName", "Xã/phường"]);
        const quantityInput = getCell(row, ["allocatedQuantity", "quantity", "Số lượng"]);

        let provinceCode: string | null = null;
        if (!provinceInput) {
            addIssue(errors, rowNumber, "provinceCode", "Thiếu tỉnh/thành phố.");
        } else {
            const provinceCodes = findProvinceCodes(provinceInput, localities);
            if (provinceCodes.length === 1) provinceCode = provinceCodes[0];
            else addIssue(errors, rowNumber, "provinceCode", provinceCodes.length ? "Tỉnh/thành phố không xác định duy nhất." : "Không tìm thấy tỉnh/thành phố trong danh mục.");
        }

        let wardCode: string | null = null;
        if (!wardInput) {
            addIssue(errors, rowNumber, "wardCode", "Thiếu xã/phường.");
        } else if (provinceCode) {
            const normalizedWard = normalizeText(wardInput);
            const wardMatches = localities.filter((locality) =>
                locality.provinceCode === provinceCode
                && (locality.wardCode.trim() === wardInput || normalizeText(locality.wardLabel) === normalizedWard)
            );
            if (wardMatches.length === 1) wardCode = wardMatches[0].wardCode;
            else addIssue(errors, rowNumber, "wardCode", wardMatches.length ? "Xã/phường không xác định duy nhất." : "Không tìm thấy xã/phường trong tỉnh/thành phố đã chọn.");
        }

        const quantity = quantityInput ? Number(quantityInput) : Number.NaN;
        if (!Number.isSafeInteger(quantity) || quantity <= 0) {
            addIssue(errors, rowNumber, "allocatedQuantity", "Số lượng phải là số nguyên dương.");
        }

        if (!provinceCode || !wardCode || !Number.isSafeInteger(quantity) || quantity <= 0) return;
        const key = `${provinceCode}:${wardCode}`;
        if (seen.has(key)) {
            addIssue(errors, rowNumber, "wardCode", "Địa bàn này đã có trong bảng nhập.");
            return;
        }
        seen.add(key);
        lines.push({ provinceCode, wardCode, allocatedQuantity: quantity });
    });

    return { lines, errors };
};

export const readDistributionBatchSpreadsheet = async (
    file: File,
    localities: DistributionLocalityOption[]
): Promise<DistributionLineImportResult> => {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
        return { lines: [], errors: [{ rowNumber: 1, field: "file", message: "Tệp không có trang tính dữ liệu." }] };
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], { defval: "" });
    return normalizeDistributionLineImportRows(rows, localities);
};

export const createDistributionBatchImportTemplate = (): Blob => {
    const sheet = XLSX.utils.aoa_to_sheet([["Tỉnh/thành phố", "Xã/phường", "Số lượng"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Chi tieu");
    const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    return new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};