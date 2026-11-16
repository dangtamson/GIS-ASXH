import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, ENTITY_TYPES } from "./auditLog.ts";

describe("social-assistance audit vocabulary", () => {
    it("defines actions and entities without reusing poverty audit types", () => {
        expect(AUDIT_ACTIONS.SOCIAL_ASSISTANCE_REQUEST_CREATED).toBe("social_assistance_request_created");
        expect(AUDIT_ACTIONS.SOCIAL_ASSISTANCE_REQUEST_STATUS_UPDATED).toBe("social_assistance_request_status_updated");
        expect(AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PROGRAM_CREATED).toBe("social_assistance_program_created");
        expect(AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PROGRAM_UPDATED).toBe("social_assistance_program_updated");
        expect(AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PLEDGE_CREATED).toBe("social_assistance_pledge_created");
        expect(AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PLEDGE_STATUS_UPDATED).toBe("social_assistance_pledge_status_updated");
        expect(AUDIT_ACTIONS.SOCIAL_ASSISTANCE_ALLOCATION_CREATED).toBe("social_assistance_allocation_created");
        expect(AUDIT_ACTIONS.SOCIAL_ASSISTANCE_ALLOCATION_UPDATED).toBe("social_assistance_allocation_updated");
        expect(AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PUBLICATION_APPROVED).toBe("social_assistance_publication_approved");
        expect(AUDIT_ACTIONS.SOCIAL_ASSISTANCE_PORTAL_UPDATED).toBe("social_assistance_portal_updated");
        expect(ENTITY_TYPES.SOCIAL_ASSISTANCE_REQUEST).toBe("social_assistance_request");
        expect(ENTITY_TYPES.SOCIAL_ASSISTANCE_PROGRAM).toBe("social_assistance_program");
        expect(ENTITY_TYPES.SOCIAL_ASSISTANCE_PLEDGE).toBe("social_assistance_pledge");
        expect(ENTITY_TYPES.SOCIAL_ASSISTANCE_ALLOCATION).toBe("social_assistance_allocation");
        expect(ENTITY_TYPES.SOCIAL_ASSISTANCE_PUBLICATION).toBe("social_assistance_publication");
        expect(ENTITY_TYPES.SOCIAL_ASSISTANCE_PORTAL).toBe("social_assistance_portal");
    });
});