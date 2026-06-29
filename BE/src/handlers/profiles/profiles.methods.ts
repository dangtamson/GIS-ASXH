import { logger } from "@/helpers/index.ts";
import { assertValidUuid } from "@/helpers/validation.ts";
import { profileInsertSchema, profiles, type ProfileInsertType, type ProfileSelectType } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { type DbTransaction } from "@/types/database.ts";
import { eq, type InferInsertModel } from "drizzle-orm";

export async function createDbProfile(
  profile: InferInsertModel<typeof profiles>,
  tx?: DbTransaction
): Promise<ProfileInsertType> {
  logger.info({ msg: `Creating profile for workspace id: ${profile.workspaceId}` });

  const validationResult = profileInsertSchema.safeParse(profile);
  if (!validationResult.success) {
    throw new Error(`Profile validation failed: ${validationResult.error.message}`);
  }

  const database = tx || db;
  const [result] = await database.insert(profiles).values(profile).returning();

  if (!result) {
    throw new Error("Unable to create profile");
  }

  logger.info({ msg: `Created profile for workspace id: ${profile.workspaceId} with profileName: ${profile.name}` });

  return result;
}

export async function getProfileById(profileId: string): Promise<ProfileSelectType[]> {
  const validProfileId = assertValidUuid(profileId, "profile ID");

  const equals = eq(profiles.uuid, validProfileId);

  const result = await db.select().from(profiles).where(equals).execute();

  return result;
}

// getProfilesByAccountId and hasExistingProfile removed - no longer used
// Profile access is now done through workspace context in /me and workspace endpoints
