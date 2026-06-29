export type JsonObject = Record<string, unknown>;

export function extractList<T = JsonObject>(input: unknown): T[] {
    if (Array.isArray(input)) {
        return input as T[];
    }

    if (!input || typeof input !== "object") {
        return [];
    }

    const obj = input as Record<string, unknown>;

    // Priority 1: Check data.items (standard Postman API response structure)
    if (obj.data && typeof obj.data === "object") {
        const dataObj = obj.data as Record<string, unknown>;
        if (Array.isArray(dataObj.items)) {
            return dataObj.items as T[];
        }
        if (Array.isArray(dataObj.rows)) {
            return dataObj.rows as T[];
        }
        if (Array.isArray(dataObj.results)) {
            return dataObj.results as T[];
        }
        if (Array.isArray(dataObj.content)) {
            return dataObj.content as T[];
        }
    }

    // Priority 2: Check top-level candidates
    const candidateKeys = [
        "items",
        "rows",
        "results",
        "list",
        "records",
        "categories",
        "content",
    ];

    for (const key of candidateKeys) {
        const value = obj[key];
        if (Array.isArray(value)) {
            return value as T[];
        }
    }

    // Priority 3: Find any array in object
    for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
            return value as T[];
        }
    }

    return [];
}

export function getRowId(item: JsonObject): string {
    const value = item.id ?? item.uuid ?? item._id ?? item.categoryItemId ?? "";
    return String(value);
}

export function getCategoryLabel(item: JsonObject): string {
    const title = item.title ? String(item.title).trim() : "";
    const name = item.name ? String(item.name).trim() : "";
    const combined = (title + " " + name).trim();
    if (combined) return combined;
    const fallback = item.categoryName ?? item.displayName ?? item.code;
    return String(fallback ?? "Danh mục");
}
