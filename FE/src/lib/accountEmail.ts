const DEFAULT_ACCOUNT_EMAIL_DOMAIN = ["@cantho.gov.vn", "@vnpt.vn"] as const;
const FULL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCOUNT_ALIAS_REGEX = /^[a-zA-Z0-9._-]+$/;

export function isFullEmail(value: string): boolean {
    return FULL_EMAIL_REGEX.test(value.trim());
}

export function isValidAccountEmailInput(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) {
        return false;
    }

    return isFullEmail(trimmed) || ACCOUNT_ALIAS_REGEX.test(trimmed);
}

export function normalizeAccountEmail(
    value: string,
    defaultDomain: string | readonly string[] = DEFAULT_ACCOUNT_EMAIL_DOMAIN
): string {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
        return "";
    }

    if (trimmed.includes("@")) {
        return trimmed;
    }

    const domain = Array.isArray(defaultDomain) ? defaultDomain[0] ?? "" : defaultDomain;
    if (!domain) {
        return trimmed;
    }

    const normalizedDomain = domain.startsWith("@") ? domain.toLowerCase() : `@${domain.toLowerCase()}`;
    return `${trimmed}${normalizedDomain}`;
}

export function getLoginAccountEmailInput(value: string): string {
    return value.trim().toLowerCase();
}

export function getAccountEmailValidationMessage(): string {
    return "Vui lòng nhập tài khoản hoặc email hợp lệ.";
}
