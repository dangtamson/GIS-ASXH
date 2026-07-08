import { afterAll, describe, expect, it } from "vitest";
import { closeDbPool } from "@/services/db/drizzle.ts";
import { listLocationProvinces } from "./poverty.repository.ts";

afterAll(async () => {
  await closeDbPool();
});

describe("listLocationProvinces", () => {
  it("returns Can Tho with a displayable name", async () => {
    const items = await listLocationProvinces();
    const canTho = items.find((item) => item.code === "92");

    expect(canTho).toBeDefined();
    expect(canTho?.fullName ?? canTho?.name).toContain("Cần Thơ");
  });
});
