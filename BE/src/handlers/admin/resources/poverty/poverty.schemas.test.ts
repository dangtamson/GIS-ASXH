import { describe, expect, it } from "vitest";
import { householdIdParamSchema, memberIdParamSchema } from "./poverty.schemas.ts";

describe("poverty route parameter schemas", () => {
  it("accepts UUID household ids", () => {
    const result = householdIdParamSchema.safeParse({ id: "6f3a67e7-1d40-4b50-a7dd-580f98c0345f" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("6f3a67e7-1d40-4b50-a7dd-580f98c0345f");
    }
  });

  it("accepts UUID nested member ids", () => {
    const result = memberIdParamSchema.safeParse({
      id: "6f3a67e7-1d40-4b50-a7dd-580f98c0345f",
      memberId: "9fb97875-4916-41b8-8151-b0d655e0352b"
    });

    expect(result.success).toBe(true);
  });

  it("rejects legacy numeric ids", () => {
    const result = householdIdParamSchema.safeParse({ id: "123" });

    expect(result.success).toBe(false);
  });
});
