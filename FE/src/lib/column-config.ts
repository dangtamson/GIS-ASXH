export type ColumnConfig = {
    key: string;
    label: string;
    format?: (value: unknown) => string;
    maxWidth?: string;
};

export type SelectOption = {
    value: string;
    label: string;
};

export type OptionSourceConfig =
    | {
        source: "category-items";
        categoryCodes: string[];
        categoryHints?: string[];
    }
    | {
        source: "endpoint";
        endpoint: string;
        valueKey?: string;
        labelKeys?: string[];
    };

export type FormFieldConfig = {
    key: string;
    label: string;
    type?: "text" | "textarea" | "number" | "date" | "datetime-local" | "select";
    valueType?: "string" | "number" | "boolean";
    placeholder?: string;
    required?: boolean;
    options?: SelectOption[];
    optionSource?: OptionSourceConfig;
};

export type FilterFieldConfig = {
    key: string;
    label: string;
    type?: "text" | "date" | "date-from" | "date-to" | "select";
    placeholder?: string;
    options?: SelectOption[];
    optionSource?: OptionSourceConfig;
    targetKey?: string;
};

export type DetailSectionConfig = {
    title: string;
    fields: ColumnConfig[];
};

export const documentColumns: ColumnConfig[] = [
    { key: "documentNumber", label: "Số ký hiệu" },
    { key: "summary", label: "Trích yếu" },
    { key: "issuingOrgName", label: "Cơ quan ban hành" },
    // { key: "createdBy", label: "Đơn vị tạo" },
    { key: "issuedDate", label: "Ngày ban hành" },
    { key: "documentTypeName", label: "Loại văn bản" },
    { key: "fieldName", label: "Lĩnh vực" },
    { key: "createdAt", label: "Ngày tạo" },
];

export const documentFilterFields: FilterFieldConfig[] = [
    { key: "documentNumber", label: "Số ký hiệu", type: "text", placeholder: "Nhập số ký hiệu" },
    { key: "summary", label: "Trích yếu", type: "text", placeholder: "Nhập trích yếu" },
    { key: "issuingOrgId", label: "Cơ quan ban hành", type: "select", optionSource: { source: "endpoint", endpoint: "/admin/organizations", labelKeys: ["name", "code"] } },
    { key: "issuedDate", targetKey: "issuedDate", label: "Ngày ban hành", type: "date" },
    // { key: "statusId", label: "Trạng thái", type: "select", optionSource: { source: "category-items", categoryCodes: ["DOC_STATUS", "TASK_STATUS", "STATUS"], categoryHints: ["status", "trạng thái", "document status"] } },
    { key: "documentTypeId", label: "Loại văn bản", type: "select", optionSource: { source: "category-items", categoryCodes: ["DOC_TYPE", "DOCUMENT_TYPE"], categoryHints: ["document type", "loại văn bản"] } },
    { key: "fieldId", label: "Lĩnh vực", type: "select", optionSource: { source: "category-items", categoryCodes: ["FIELD", "TASK_FIELD"], categoryHints: ["field", "lĩnh vực"] } },

];

export const taskColumns: ColumnConfig[] = [
    { key: "title", label: "Tiêu đề" },
    { key: "description", label: "Mô tả" },
    { key: "dueDate", label: "Ngày hạn" },
    { key: "statusId", label: "Trạng thái" },
    { key: "createdAt", label: "Ngày tạo" },
];

export const taskFilterFields: FilterFieldConfig[] = [
    { key: "title", label: "Tên nhiệm vụ", type: "text", placeholder: "Nhập từ khóa" },
    { key: "organizationId", label: "Đơn vị", type: "select", optionSource: { source: "endpoint", endpoint: "/admin/organizations", labelKeys: ["name", "code"] } },
    { key: "statusId", label: "Trạng thái", type: "select", optionSource: { source: "category-items", categoryCodes: ["TASK_STATUS", "STATUS"], categoryHints: ["status", "task status", "trạng thái"] } },
    { key: "priorityId", label: "Mức độ ưu tiên", type: "select", optionSource: { source: "category-items", categoryCodes: ["TASK_PRIORITY", "PRIORITY"], categoryHints: ["priority", "mức độ ưu tiên"] } },
    { key: "dueDateFrom", targetKey: "dueDate", label: "Hạn hoàn thành từ", type: "date-from" },
    { key: "dueDateTo", targetKey: "dueDate", label: "Hạn hoàn thành đến", type: "date-to" },
];

export const taskAssignmentColumns: ColumnConfig[] = [
    { key: "taskId", label: "Mã nhiệm vụ" },
    { key: "assignedToAccountId", label: "Giao cho" },
    { key: "assignedBy", label: "Giao bởi" },
    { key: "assignedAt", label: "Ngày giao" },
    { key: "statusId", label: "Trạng thái" },
];

export const taskAssignmentFilterFields: FilterFieldConfig[] = [
    { key: "taskId", label: "Nhiệm vụ", type: "text", placeholder: "Nhập mã nhiệm vụ" },
    { key: "assignedToOrgId", label: "Đơn vị", type: "select", optionSource: { source: "endpoint", endpoint: "/admin/organizations", labelKeys: ["name", "code"] } },
    { key: "statusId", label: "Trạng thái", type: "select", optionSource: { source: "category-items", categoryCodes: ["TASK_STATUS", "STATUS"], categoryHints: ["status", "task status", "trạng thái"] } },
    { key: "assignedAt", label: "Ngày giao", type: "date" },
];

export const evaluationColumns: ColumnConfig[] = [
    { key: "taskId", label: "Mã nhiệm vụ" },
    { key: "progress", label: "Tiến độ (%)" },
    { key: "note", label: "Nội dung đánh giá" },
    { key: "statusId", label: "Trạng thái" },
    { key: "createdAt", label: "Ngày tạo" },
];

export const evaluationFilterFields: FilterFieldConfig[] = [
    { key: "taskId", label: "Nhiệm vụ", type: "text", placeholder: "Nhập mã nhiệm vụ" },
    { key: "statusId", label: "Trạng thái", type: "select", optionSource: { source: "category-items", categoryCodes: ["TASK_STATUS", "STATUS"], categoryHints: ["status", "task status", "trạng thái"] } },
    { key: "progress", label: "Tiến độ", type: "text", placeholder: "VD: 80" },
    { key: "createdAt", label: "Ngày đánh giá", type: "date" },
];

export const documentFormFields: FormFieldConfig[] = [
    { key: "documentNumber", label: "Số ký hiệu", required: true, placeholder: "VD: 91/KH-UBND" },
    { key: "title", label: "Tiêu đề", required: true, placeholder: "Nhập tiêu đề văn bản" },
    { key: "summary", label: "Trích yếu", type: "textarea", required: true, placeholder: "Nhập trích yếu" },
    { key: "issuingOrgId", label: "Cơ quan ban hành", type: "select", optionSource: { source: "endpoint", endpoint: "/admin/organizations", labelKeys: ["name", "code"] } },
    { key: "documentTypeId", label: "Loại văn bản", type: "select", optionSource: { source: "category-items", categoryCodes: ["DOC_TYPE", "DOCUMENT_TYPE"], categoryHints: ["document type", "loại văn bản"] } },
    { key: "fieldId", label: "Lĩnh vực", type: "select", optionSource: { source: "category-items", categoryCodes: ["FIELD", "TASK_FIELD"], categoryHints: ["field", "lĩnh vực"] } },
    { key: "issuedDate", label: "Ngày ban hành", type: "date" },
    { key: "effectiveDate", label: "Ngày hiệu lực", type: "date" },
    // { key: "statusId", label: "Trạng thái", type: "select", optionSource: { source: "category-items", categoryCodes: ["DOC_STATUS", "TASK_STATUS", "STATUS"], categoryHints: ["status", "document status", "trạng thái"] } },
];

export const taskFormFields: FormFieldConfig[] = [
    { key: "title", label: "Tên nhiệm vụ", required: true, placeholder: "Nhập tên nhiệm vụ" },
    { key: "description", label: "Nội dung nhiệm vụ", type: "textarea", required: true, placeholder: "Nhập mô tả" },
    { key: "organizationId", label: "Đơn vị được giao", type: "select", optionSource: { source: "endpoint", endpoint: "/admin/organizations", labelKeys: ["name", "code"] } },
    { key: "priorityId", label: "Mức độ ưu tiên", type: "select", optionSource: { source: "category-items", categoryCodes: ["TASK_PRIORITY", "PRIORITY"], categoryHints: ["priority", "mức độ ưu tiên"] } },
    { key: "statusId", label: "Trạng thái", type: "select", optionSource: { source: "category-items", categoryCodes: ["TASK_STATUS", "STATUS"], categoryHints: ["status", "task status", "trạng thái"] } },
    { key: "startDate", label: "Ngày bắt đầu", type: "date" },
    { key: "dueDate", label: "Hạn hoàn thành", type: "date" },
    { key: "documentId", label: "Văn bản liên quan", type: "select", optionSource: { source: "endpoint", endpoint: "/content/documents", labelKeys: ["documentNumber", "title"] } },
];

export const taskAssignmentFormFields: FormFieldConfig[] = [
    { key: "taskId", label: "Nhiệm vụ", required: true, type: "select", optionSource: { source: "endpoint", endpoint: "/workflow/tasks", labelKeys: ["title", "uuid"] } },
    { key: "assignedToAccountId", label: "Tài khoản được giao", required: true, type: "select", optionSource: { source: "endpoint", endpoint: "/admin/accounts", labelKeys: ["fullName", "email"] } },
    { key: "assignedToOrgId", label: "Đơn vị được giao", type: "select", optionSource: { source: "endpoint", endpoint: "/admin/organizations", labelKeys: ["name", "code"] } },
    { key: "assignedBy", label: "Người giao", type: "select", optionSource: { source: "endpoint", endpoint: "/admin/accounts", labelKeys: ["fullName", "email"] } },
    { key: "assignedAt", label: "Thời điểm giao", type: "datetime-local" },
    { key: "statusId", label: "Trạng thái", type: "select", optionSource: { source: "category-items", categoryCodes: ["TASK_STATUS", "STATUS"], categoryHints: ["status", "task status", "trạng thái"] } },
];

export const evaluationFormFields: FormFieldConfig[] = [
    { key: "taskId", label: "Nhiệm vụ", required: true, type: "select", optionSource: { source: "endpoint", endpoint: "/workflow/tasks", labelKeys: ["title", "uuid"] } },
    { key: "progress", label: "Tiến độ (%)", type: "number", required: true, placeholder: "0 - 100" },
    { key: "statusId", label: "Trạng thái", type: "select", optionSource: { source: "category-items", categoryCodes: ["TASK_STATUS", "STATUS"], categoryHints: ["status", "task status", "trạng thái"] } },
    { key: "note", label: "Nội dung đánh giá", type: "textarea", placeholder: "Nhập nhận xét" },
];

export const documentDetailFields: ColumnConfig[] = [
    { key: "documentNumber", label: "Số ký hiệu" },
    { key: "title", label: "Tiêu đề" },
    { key: "summary", label: "Trích yếu" },
    { key: "issuingOrgId", label: "Cơ quan ban hành" },
    { key: "documentTypeId", label: "Loại văn bản" },
    { key: "issuedDate", label: "Ngày ban hành" },
    { key: "effectiveDate", label: "Ngày hiệu lực" },
    { key: "statusId", label: "Trạng thái" },
    { key: "createdAt", label: "Ngày tạo" },
];

export const taskDetailFields: ColumnConfig[] = [
    { key: "title", label: "Tên nhiệm vụ" },
    { key: "description", label: "Mô tả" },
    { key: "organizationId", label: "Đơn vị được giao" },
    { key: "priorityId", label: "Mức độ ưu tiên" },
    { key: "statusId", label: "Trạng thái" },
    { key: "startDate", label: "Ngày bắt đầu" },
    { key: "dueDate", label: "Hạn hoàn thành" },
    { key: "completedAt", label: "Ngày hoàn thành" },
];

export const taskAssignmentDetailFields: ColumnConfig[] = [
    { key: "taskId", label: "Mã nhiệm vụ" },
    { key: "assignedToAccountId", label: "Tài khoản được giao" },
    { key: "assignedToOrgId", label: "Đơn vị được giao" },
    { key: "assignedBy", label: "Người giao" },
    { key: "assignedAt", label: "Thời điểm giao" },
    { key: "statusId", label: "Trạng thái" },
];

export const evaluationDetailFields: ColumnConfig[] = [
    { key: "taskId", label: "Mã nhiệm vụ" },
    { key: "progress", label: "Tiến độ (%)" },
    { key: "note", label: "Nội dung đánh giá" },
    { key: "statusId", label: "Trạng thái" },
    { key: "createdAt", label: "Ngày tạo" },
    { key: "updatedAt", label: "Ngày cập nhật" },
];

export const documentDetailSections: DetailSectionConfig[] = [
    {
        title: "Thông tin văn bản",
        fields: [
            { key: "documentNumber", label: "Số ký hiệu" },
            { key: "title", label: "Tiêu đề" },
            { key: "summary", label: "Trích yếu" },
            { key: "documentTypeId", label: "Loại văn bản" },
            { key: "fieldId", label: "Lĩnh vực" },
            { key: "issuingOrgId", label: "Cơ quan ban hành" },
            { key: "issuedDate", label: "Ngày ban hành" },
            { key: "effectiveDate", label: "Ngày hiệu lực" },
            { key: "statusId", label: "Trạng thái" },
        ],
    },
];

export const taskDetailSections: DetailSectionConfig[] = [
    {
        title: "Thông tin nhiệm vụ",
        fields: [
            { key: "title", label: "Tên nhiệm vụ" },
            { key: "description", label: "Nội dung nhiệm vụ" },
            { key: "organizationId", label: "Đơn vị được giao" },
            { key: "priorityId", label: "Mức độ ưu tiên" },
            { key: "statusId", label: "Trạng thái" },
            { key: "startDate", label: "Ngày bắt đầu" },
            { key: "dueDate", label: "Hạn hoàn thành" },
            { key: "completedAt", label: "Ngày hoàn thành" },
        ],
    },
    {
        title: "Lịch sử cập nhật",
        fields: [
            { key: "createdAt", label: "Ngày tạo" },
            { key: "updatedAt", label: "Ngày cập nhật" },
            { key: "deletedAt", label: "Ngày xóa" },
        ],
    },
];

export const taskAssignmentDetailSections: DetailSectionConfig[] = [
    {
        title: "Thông tin phân công",
        fields: [
            { key: "taskId", label: "Nhiệm vụ" },
            { key: "assignedToAccountId", label: "Tài khoản được giao" },
            { key: "assignedToOrgId", label: "Đơn vị được giao" },
            { key: "assignedBy", label: "Người giao" },
            { key: "assignedAt", label: "Thời điểm giao" },
            { key: "statusId", label: "Trạng thái" },
        ],
    },
    {
        title: "Lịch sử cập nhật",
        fields: [
            { key: "createdAt", label: "Ngày tạo" },
            { key: "updatedAt", label: "Ngày cập nhật" },
        ],
    },
];

export const evaluationDetailSections: DetailSectionConfig[] = [
    {
        title: "Thông tin đánh giá",
        fields: [
            { key: "taskId", label: "Nhiệm vụ" },
            { key: "progress", label: "Tiến độ (%)" },
            { key: "note", label: "Nội dung đánh giá" },
            { key: "statusId", label: "Trạng thái" },
        ],
    },
    {
        title: "Lịch sử phê duyệt",
        fields: [
            { key: "approvedBy", label: "Người phê duyệt" },
            { key: "approvedAt", label: "Thời điểm phê duyệt" },
            { key: "createdAt", label: "Ngày tạo" },
            { key: "updatedAt", label: "Ngày cập nhật" },
        ],
    },
];

export function formatValue(value: unknown): string {
    if (value === null || value === undefined) {
        return "-";
    }

    if (typeof value === "boolean") {
        return value ? "Có" : "Không";
    }

    if (typeof value === "string") {
        // Format date
        if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
            try {
                const date = new Date(value);
                return date.toLocaleDateString("vi-VN");
            } catch {
                return value;
            }
        }
        // Format UUID - show first 8 chars
        if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)) {
            return value.substring(0, 8);
        }
        return value.length > 40 ? value.substring(0, 40) + "..." : value;
    }

    if (typeof value === "number") {
        return String(value);
    }

    if (typeof value === "object") {
        return JSON.stringify(value).substring(0, 40) + "...";
    }

    return String(value);
}
