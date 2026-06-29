import { HttpErrors, type HttpError } from "@/helpers/Http.ts";

type SupabaseAuthErrorLike = {
  message?: string;
  status?: number;
};

function extractErrorMessage(error: SupabaseAuthErrorLike | null | undefined): string {
  const message = error?.message?.trim();
  return message || "Unknown Supabase auth error";
}

export function mapSupabaseCreateUserError(error: SupabaseAuthErrorLike | null | undefined): HttpError {
  const message = extractErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("invalid authentication credentials") ||
    normalizedMessage.includes("invalid api key") ||
    normalizedMessage.includes("jwt malformed")
  ) {
    return HttpErrors.InternalError(
      "Supabase admin credentials are invalid. Check SUPABASE_SECRET_KEY (must be sb_secret_*)."
    );
  }

  if (
    normalizedMessage.includes("already") ||
    normalizedMessage.includes("exists") ||
    normalizedMessage.includes("registered") ||
    normalizedMessage.includes("duplicate")
  ) {
    return HttpErrors.Conflict("Email already exists in Supabase auth");
  }

  if (normalizedMessage.includes("password")) {
    return HttpErrors.ValidationFailed(`Supabase password validation failed: ${message}`);
  }

  if (normalizedMessage.includes("email") && normalizedMessage.includes("invalid")) {
    return HttpErrors.ValidationFailed(`Supabase email validation failed: ${message}`);
  }

  if ((error?.status ?? 0) >= 500) {
    return HttpErrors.InternalError("Supabase auth service is unavailable");
  }

  return HttpErrors.BadRequest(`Unable to create Supabase auth user: ${message}`);
}