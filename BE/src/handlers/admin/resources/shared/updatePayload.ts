export function sanitizeUpdatePayload<T extends Record<string, unknown>>(payload: T): Partial<T> {
  const next: Partial<T> = {};

  for (const [key, currentValue] of Object.entries(payload)) {
    let value = currentValue;
    if (value === undefined || value === "") {
       value = null;
    }

    if (typeof value === "string" && value !== "") {
      (next as Record<string, unknown>)[key] = value.trim();
      continue;
    }

    (next as Record<string, unknown>)[key] = value;
  }

  return next;
}
