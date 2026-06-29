import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { accounts, files, systemConfigs } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { and, eq, isNull } from "drizzle-orm";
import type { Request, Response } from "express";
import nodemailer from "nodemailer";
import { z } from "zod";
import { getFilesForEntity, uploadFilesForEntity } from "@/handlers/admin/resources/shared/fileAttachments.ts";

const isEmptyObject = (obj: unknown): boolean =>
  obj && typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj).length === 0;

const systemConfigSectionSchema = z.record(z.string(), z.unknown());

const updateSystemConfigSchema = z
  .object({
    general: systemConfigSectionSchema.optional(),
    sso: systemConfigSectionSchema.optional(),
    email: systemConfigSectionSchema.optional(),
    smartReader: systemConfigSectionSchema.optional(),
    openaiConfig: systemConfigSectionSchema.optional(),
    securityPolicy: systemConfigSectionSchema.optional()
  })
  .refine(
    (value) =>
      value.general !== undefined ||
      value.sso !== undefined ||
      value.email !== undefined ||
      value.smartReader !== undefined ||
      value.openaiConfig !== undefined ||
      value.securityPolicy !== undefined,
    {
      message: "At least one config section is required"
    }
  );

const emailConfigSchema = z.object({
  senderName: z.string().trim().min(1),
  senderEmail: z.email(),
  replyTo: z.union([z.email(), z.literal("")]).optional(),
  smtpHost: z.string().trim().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  username: z.string().trim().optional(),
  password: z.string().optional(),
  useTls: z.boolean().default(true),
  useSsl: z.boolean().optional(),
  allowInvalidCert: z.boolean().optional()
});

const testEmailRequestSchema = z.object({
  recipient: z.email(),
  subject: z.string().trim().max(255).optional(),
  body: z.string().trim().max(5000).optional(),
  email: z.record(z.string(), z.unknown()).optional()
});

function asSection(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function mergeEmailConfig(
  existing: Record<string, unknown>,
  incoming?: Record<string, unknown>
): Record<string, unknown> {
  if (!incoming) {
    return existing;
  }

  return {
    ...existing,
    ...incoming
  };
}

export const getSystemConfigAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  let isPermit = false;

  if(req.accountId) {
    const [user] = await db.select().from(accounts).where(
      and(
        eq(accounts.uuid, req.accountId),
        eq(accounts.status, 'active'),
        eq(accounts.isLocked, false)
      )
    ).limit(1);

    if(user && user.isSuperAdmin)
      isPermit = true;
  }

  const [item] = await db.select().from(systemConfigs).where(eq(systemConfigs.workspaceId, workspaceId)).limit(1);

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      item: {
        workspaceId,
        general: asSection(item?.general),
        sso: isPermit ? asSection(item?.sso) : undefined,
        email: isPermit ? asSection(item?.email) : undefined,
        smartReader: isPermit ? asSection(item?.smartReader) : undefined,
        openaiConfig: isPermit ? asSection(item?.openaiConfig) : undefined,
        securityPolicy: asSection(item?.securityPolicy)
      }
    },
    "System config retrieved successfully"
  );

  res.status(response.code).send(response);
});

export const upsertSystemConfigAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = updateSystemConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const favicon = req.body.favicon;

  const [existing] = await db.select().from(systemConfigs).where(eq(systemConfigs.workspaceId, workspaceId)).limit(1);

  if (existing && favicon && favicon?.fileContentBase64) {

    if (existing?.general.favicon) {
      await db
        .update(files)
        .set({ deletedAt: new Date() })
        .where(and(eq(files.entityType, "systemConfigs"), eq(files.entityId, existing.uuid), isNull(files.deletedAt)));
    }
    await uploadFilesForEntity({
      attachments: [
        {
          ...favicon,
          storageBucket: "public-assets"
        }
      ],
      entityId: existing?.uuid,
      entityType: "favicon"
    });
  }

  const uploadedFavicon = existing
    ? await getFilesForEntity({ entityType: "favicon", entityId: existing.uuid })
    : undefined;

  const payload = parsed.data;


  const nextGeneral =
    payload.general && !isEmptyObject(payload.general) ? payload.general : asSection(existing?.general);

  const nextSso = payload.sso && !isEmptyObject(payload.sso) ? payload.sso : asSection(existing?.sso);

  const nextEmail = payload.email && !isEmptyObject(payload.email) ? payload.email : asSection(existing?.email);

  const nextSmartReader = payload.smartReader && !isEmptyObject(payload.smartReader) ? payload.smartReader : asSection(existing?.smartReader);

  const nextOpenaiConfig =
    payload.openaiConfig && !isEmptyObject(payload.openaiConfig)
      ? payload.openaiConfig
      : asSection(existing?.openaiConfig);

  const nextSecurityPolicy =
    payload.securityPolicy && !isEmptyObject(payload.securityPolicy)
      ? payload.securityPolicy
      : asSection(existing?.securityPolicy);

  nextGeneral.favicon = uploadedFavicon?.[0] || nextGeneral.favicon;

  const [item] = await db
    .insert(systemConfigs)
    .values({
      workspaceId,
      general: nextGeneral,
      sso: nextSso,
      email: nextEmail,
      smartReader: nextSmartReader,
      openaiConfig: nextOpenaiConfig,
      securityPolicy: nextSecurityPolicy,
      updatedBy: req.accountId || null
    })
    .onConflictDoUpdate({
      target: systemConfigs.workspaceId,
      set: {
        general: nextGeneral,
        sso: nextSso,
        email: nextEmail,
        smartReader: nextSmartReader,
        openaiConfig: nextOpenaiConfig,
        securityPolicy: nextSecurityPolicy,
        updatedBy: req.accountId || null,
        updatedAt: new Date()
      }
    })
    .returning();

  if (!item) {
    throw new Error("Unable to save system config");
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item }, "System config saved successfully");
  res.status(response.code).send(response);
});

export const testSystemConfigEmailAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = testEmailRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [config] = await db.select().from(systemConfigs).where(eq(systemConfigs.workspaceId, workspaceId)).limit(1);
  const mergedEmailConfig = mergeEmailConfig(asSection(config?.email), parsed.data.email);

  const parsedEmailConfig = emailConfigSchema.safeParse(mergedEmailConfig);
  if (!parsedEmailConfig.success) {
    const response = apiResponse.error(
      HttpErrors.ValidationFailed("Email config is invalid. Please check SMTP settings before testing.")
    );
    res.status(response.code).send(response);
    return;
  }

  const emailConfig = parsedEmailConfig.data;
  const secure = emailConfig.useSsl ?? emailConfig.smtpPort === 465;

  const transporter = nodemailer.createTransport({
    host: emailConfig.smtpHost,
    port: emailConfig.smtpPort,
    secure,
    auth:
      emailConfig.username && emailConfig.password
        ? {
            user: emailConfig.username,
            pass: emailConfig.password
          }
        : undefined,
    requireTLS: emailConfig.useTls,
    tls: {
      rejectUnauthorized: !(emailConfig.allowInvalidCert ?? false)
    }
  });

  await transporter.verify();

  const testSubject = parsed.data.subject || "[TEST] Kiem tra cau hinh SMTP";
  const testBody =
    parsed.data.body ||
    "Day la email test tu chuc nang Cau hinh he thong. Neu ban nhan duoc email nay, cau hinh SMTP da hoat dong.";

  const sent = await transporter.sendMail({
    from: `${emailConfig.senderName} <${emailConfig.senderEmail}>`,
    to: parsed.data.recipient,
    replyTo: emailConfig.replyTo || undefined,
    subject: testSubject,
    text: testBody,
    html: `<p>${testBody.replace(/\n/g, "<br/>")}</p>`
  });

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      messageId: sent.messageId,
      accepted: sent.accepted,
      rejected: sent.rejected
    },
    "Test email sent successfully"
  );
  res.status(response.code).send(response);
});
