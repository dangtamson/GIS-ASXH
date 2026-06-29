export type ImportFieldValidation = {
    rule: "required" | "unique" | "regex";
    errorMessage?: string;
    level?: "info" | "warning" | "error";
    value?: string;
    flags?: string;
};

export type ImportField = {
    key: string;
    label: string;
    description?: string;
    alternateMatches?: string[];
    fieldType?: {
        type: "input" | "checkbox" | "select";
        options?: {label: string; value: string}[];
    };
    validations?: ImportFieldValidation[];
    example?: string;
};

export type ImportTemplateResponse = {
    key: string;
    name: string;
    fields: ImportField[];
};

export type ImportRowError = {
    rowNumber: number;
    field?: string;
    message: string;
};

export type ImportPreviewResult<T = Record<string, unknown>> = {
    validRows: {rowNumber: number; data: T}[];
    errors: ImportRowError[];
    totalRows: number;
};

export type ImportCommitResult = {
    created: string[];
    updated: string[];
    failed: number;
    errors: ImportRowError[];
};
