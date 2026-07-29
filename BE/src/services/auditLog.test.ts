import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/db/drizzle.ts", () => ({
  db: {}
}));

import { AUDIT_ACTIONS, ENTITY_TYPES } from "./auditLog.ts";

describe("poverty audit log vocabulary", () => {
  it("defines the household mutation actions", () => {
    expect(AUDIT_ACTIONS.POVERTY_HOUSEHOLD_CREATED).toBe("poverty_household_created");
    expect(AUDIT_ACTIONS.POVERTY_HOUSEHOLD_UPDATED).toBe("poverty_household_updated");
    expect(AUDIT_ACTIONS.POVERTY_HOUSEHOLD_DELETED).toBe("poverty_household_deleted");
  });

  it("defines the related poverty entity types", () => {
    expect(ENTITY_TYPES.POVERTY_HOUSEHOLD).toBe("poverty_household");
    expect(ENTITY_TYPES.POVERTY_MEMBER).toBe("poverty_member");
    expect(ENTITY_TYPES.POVERTY_ASSESSMENT).toBe("poverty_assessment");
    expect(ENTITY_TYPES.POVERTY_CONTEXT_HISTORY).toBe("poverty_context_history");
    expect(ENTITY_TYPES.POVERTY_SUPPORT).toBe("poverty_support");
  });

  it("defines the requested member, assessment, context, and support actions", () => {
    expect(AUDIT_ACTIONS.POVERTY_MEMBER_CREATED).toBe("poverty_member_created");
    expect(AUDIT_ACTIONS.POVERTY_MEMBER_UPDATED).toBe("poverty_member_updated");
    expect(AUDIT_ACTIONS.POVERTY_MEMBER_DELETED).toBe("poverty_member_deleted");
    expect(AUDIT_ACTIONS.POVERTY_ASSESSMENT_UPDATED).toBe("poverty_assessment_updated");
    expect(AUDIT_ACTIONS.POVERTY_CONTEXT_HISTORY_UPDATED).toBe("poverty_context_history_updated");
    expect(AUDIT_ACTIONS.POVERTY_SUPPORT_CREATED).toBe("poverty_support_created");
    expect(AUDIT_ACTIONS.POVERTY_SUPPORT_UPDATED).toBe("poverty_support_updated");
    expect(AUDIT_ACTIONS.POVERTY_SUPPORT_DELETED).toBe("poverty_support_deleted");
  });
});
