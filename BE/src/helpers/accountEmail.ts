import { z } from "zod";

export const DEFAULT_ACCOUNT_EMAIL_DOMAIN = "@cantho.gov.vn";
const FULL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCOUNT_ALIAS_REGEX = /^[a-zA-Z0-9._-]+$/;

export function isValidEmailAddress(value: string): boolean {
  return FULL_EMAIL_REGEX.test(value.trim());
}

export function isValidAccountEmailInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return isValidEmailAddress(trimmed) || ACCOUNT_ALIAS_REGEX.test(trimmed);
}

export function normalizeAccountEmail(
  value: string,
  defaultDomain: string = DEFAULT_ACCOUNT_EMAIL_DOMAIN
): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("@")) {
    return trimmed;
  }

  const normalizedDomain = defaultDomain.startsWith("@")
    ? defaultDomain.toLowerCase()
    : `@${defaultDomain.toLowerCase()}`;

  return `${trimmed}${normalizedDomain}`;
}

export const accountEmailInputSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isValidAccountEmailInput, {
    message: "Email must be a full email address or a valid account alias"
  })
  .transform((value) => normalizeAccountEmail(value))
  .refine(isValidEmailAddress, {
    message: "Resolved account email is invalid"
  });
