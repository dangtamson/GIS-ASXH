import { uuidSchema } from "@/schema.ts";
import { HttpErrors, type HttpError } from "./Http.ts";

type UuidValidationSuccess = {
  success: true;
  value: string;
};

type UuidValidationFailure = {
  success: false;
  error: HttpError;
};

export type UuidValidationResult = UuidValidationSuccess | UuidValidationFailure;

export function validateRequiredUuid(value: string | undefined, fieldName: string): UuidValidationResult {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return {
      success: false,
      error: HttpErrors.MissingParameter(fieldName)
    };
  }

  const validationResult = uuidSchema.safeParse(trimmedValue);
  if (!validationResult.success) {
    return {
      success: false,
      error: HttpErrors.ValidationFailed(`Invalid ${fieldName}: ${validationResult.error.message}`)
    };
  }

  return {
    success: true,
    value: validationResult.data
  };
}

export function assertValidUuid(value: string, fieldName: string): string {
  const trimmedValue = value.trim();
  const validationResult = uuidSchema.safeParse(trimmedValue);

  if (!validationResult.success) {
    throw new Error(`Invalid ${fieldName}: ${validationResult.error.message}`);
  }

  return validationResult.data;
}