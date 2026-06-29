import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { accountEmailInputSchema } from "@/helpers/accountEmail.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { mapSupabaseCreateUserError } from "@/helpers/supabaseAuth.ts";
import { validateRequiredUuid } from "@/helpers/validation.ts";
import { accounts, type AccountSelectType, type AccountWithRelations } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { getSupabaseAdmin } from "@/services/supabase.ts";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { createDbAccount, getAccountWithRelations } from "./accounts.methods.ts";

const createAccountRequestSchema = z.object({
  fullName: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  email: accountEmailInputSchema,
  password: z.string().min(6)
});

const updateAccountRequestSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional().nullable()
});

export const getAccounts = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const result = await db.select().from(accounts).execute();

  const response = apiResponse.success<AccountSelectType[]>(
    HttpStatusCode.OK,
    result,
    `Fetched accounts: ${result.length}`
  );

  res.status(response.code).send(response);
});

export const getAccount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const accountIdValidation = validateRequiredUuid(req.params.id, "Account ID");
  if (!accountIdValidation.success) {
    const response = apiResponse.error(accountIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  const accountId = accountIdValidation.value;

  const result = await getAccountWithRelations(accountId);

  if (!result) {
    const response = apiResponse.error(HttpErrors.NotFound("Account"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success<AccountWithRelations>(
    HttpStatusCode.OK,
    result,
    `Fetched account with UUID ${accountId}`
  );
  res.status(response.code).send(response);
});

export const createAccount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = createAccountRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { fullName, phone, email, password } = parsed.data;

  const [existingAccount] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  if (existingAccount) {
    const response = apiResponse.error(HttpErrors.BadRequest("Unable to create account with provided information"));
    res.status(response.code).send(response);
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: supabaseAuthData, error: supabaseAuthError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      fullName,
      phone
    }
  });

  if (supabaseAuthError || !supabaseAuthData?.user?.id) {
    const response = apiResponse.error(mapSupabaseCreateUserError(supabaseAuthError));
    res.status(response.code).send(response);
    return;
  }

  const supabaseAuthUserId = supabaseAuthData.user.id;

  let accountId: string;
  try {
    accountId = await createDbAccount({ uuid: supabaseAuthUserId, fullName, phone, email });
  } catch (dbErr) {
    await supabaseAdmin.auth.admin.deleteUser(supabaseAuthUserId);
    throw dbErr;
  }

  const response = apiResponse.success<string>(HttpStatusCode.OK, accountId, "Account created");

  res.status(response.code).send(response);
});

export const updateAccount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const accountIdValidation = validateRequiredUuid(req.params.id, "Account ID");
  if (!accountIdValidation.success) {
    const response = apiResponse.error(accountIdValidation.error);
    res.status(response.code).send(response);
    return;
  }

  const parsed = updateAccountRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const accountId = accountIdValidation.value;
  const { fullName, phone } = parsed.data;

  // Check if account exists
  const [existingAccount] = await db.select().from(accounts).where(eq(accounts.uuid, accountId)).limit(1);
  if (!existingAccount) {
    const response = apiResponse.error(HttpErrors.NotFound("Account"));
    res.status(response.code).send(response);
    return;
  }

  // Build update data with only provided fields
  const updateData: Partial<typeof accounts.$inferInsert> = {};
  if (fullName !== undefined) updateData.fullName = fullName;
  if (phone !== undefined) updateData.phone = phone;

  await db.update(accounts).set(updateData).where(eq(accounts.uuid, accountId)).execute();

  const response = apiResponse.success<string>(
    HttpStatusCode.OK,
    accountId,
    "Account updated successfully"
  );

  res.status(response.code).send(response);
});
