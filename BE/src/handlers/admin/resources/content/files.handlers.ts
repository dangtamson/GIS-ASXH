import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { aiSummary, files } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { scanTableSmartReader, summarizeSmartReaderContent, uploadSmartReaderFile } from "@/services/smart-reader.ts";
import { getSupabaseAdmin } from "@/services/supabase.ts";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, ilike, isNull, lte } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";

const DEFAULT_STORAGE_BUCKET = "files";

const fileNameToSafePathPart = (fileName: string): string =>
  fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-");

const decodeBase64Payload = (payload: string): Buffer => {
  const normalized = payload.includes(",") ? payload.split(",").at(-1) || "" : payload;
  return Buffer.from(normalized, "base64");
};

const getFileExtension = (fileName: string): string => {
  const normalized = fileName.trim().toLowerCase();
  const lastDotIndex = normalized.lastIndexOf(".");
  return lastDotIndex >= 0 ? normalized.slice(lastDotIndex + 1) : "";
};

const resolvePreviewType = (fileName: string, mimeType?: string | null): "pdf" | "image" | "file" => {
  const extension = getFileExtension(fileName);
  const normalizedMimeType = mimeType?.trim().toLowerCase() || "";

  if (extension === "pdf" || normalizedMimeType === "application/pdf") {
    return "pdf";
  }

  if (
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(extension) ||
    normalizedMimeType.startsWith("image/")
  ) {
    return "image";
  }

  return "file";
};

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entityType: z.string().trim().optional(),
  entityId: z.uuid().optional(),
  uploadedBy: z.uuid().optional(),
  mimeType: z.string().trim().optional(),
  search: z.string().trim().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "fileName", "fileSize"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

const createSchema = z.object({
  fileName: z.string().trim().min(1),
  filePath: z.string().trim().min(1).optional(),
  fileContentBase64: z.string().min(1).optional(),
  storageBucket: z.string().trim().min(1).optional(),
  storagePath: z.string().trim().min(1).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  mimeType: z.string().trim().max(150).optional(),
  entityType: z.string().trim().min(1).max(50),
  entityId: z.uuid(),
  uploadedBy: z.uuid().optional()
}).refine((value) => Boolean(value.filePath || value.fileContentBase64), {
  message: "filePath or fileContentBase64 is required"
});

const updateSchema = z
  .object({
    fileName: z.string().trim().min(1).optional(),
    filePath: z.string().trim().min(1).optional(),
    fileSize: z.number().int().nonnegative().optional(),
    mimeType: z.string().trim().max(150).optional(),
    entityType: z.string().trim().min(1).max(50).optional(),
    entityId: z.uuid().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

const downloadQuerySchema = z.object({
  expiresIn: z.coerce.number().int().min(60).max(86400).default(300)
});

const previewQuerySchema = z.object({
  expiresIn: z.coerce.number().int().min(60).max(86400).default(300)
});

const summarizeSchema = z.object({
  details: z.boolean().optional().default(false)
});

const createAiSummarySchema = z.object({
  documentId: z.uuid().optional(),
  fileId: z.uuid().optional(),
  summaryText: z.string().trim().min(1),
  model: z.string().trim().max(100).optional()
});

const updateAiSummarySchema = z
  .object({
    documentId: z.uuid().nullable().optional(),
    fileId: z.uuid().nullable().optional(),
    summaryText: z.string().trim().min(1).optional(),
    model: z.string().trim().max(100).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

const getAiSummaryQuerySchema = z
  .object({
    documentId: z.uuid().optional(),
    fileId: z.uuid().optional()
  })
  .refine((value) => Boolean(value.documentId || value.fileId), {
    message: "documentId or fileId is required"
  });

const collectTextValues = (value: unknown, output: string[]): void => {
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized) {
      output.push(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectTextValues(item, output));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, nestedValue]) => {
    if (["summary", "text", "content", "paragraphs", "phrases", "lines", "object", "data", "tom_tat", "tomTat"].includes(key)) {
      collectTextValues(nestedValue, output);
    }
  });
};

const extractSummaryText = (payload: Record<string, unknown>): string => {
  const parts: string[] = [];
  collectTextValues(payload, parts);
  return Array.from(new Set(parts)).join("\n\n").trim();
};

const getAiSummaryItems = async (filters: { documentId?: string; fileId?: string }) => {
  const conditions: SQL<unknown>[] = [];
  if (filters.documentId) {
    conditions.push(eq(aiSummary.documentId, filters.documentId));
  }
  if (filters.fileId) {
    conditions.push(eq(aiSummary.fileId, filters.fileId));
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
  const rows = await db
    .select({
      summary: aiSummary,
      item: files
    })
    .from(aiSummary)
    .leftJoin(files, eq(aiSummary.fileId, files.uuid))
    .where(whereClause)
    .orderBy(desc(aiSummary.createdAt));

  return rows.map((row) => ({
    uuid: row.summary.uuid,
    documentId: row.summary.documentId,
    fileId: row.summary.fileId,
    summaryText: row.summary.summaryText,
    model: row.summary.model,
    createdAt: row.summary.createdAt,
    item: row.item,
    summarySource: row.summary.model || "smart-reader"
  }));
};

const createAiSummaryRecord = async (payload: {
  documentId?: string;
  fileId?: string;
  summaryText: string;
  model?: string;
}) => {
  const [created] = await db
    .insert(aiSummary)
    .values({
      documentId: payload.documentId,
      fileId: payload.fileId,
      summaryText: payload.summaryText,
      model: payload.model
    })
    .returning();

  return created;
};

export const listFilesAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { page, limit, entityType, entityId, uploadedBy, mimeType, search, createdFrom, createdTo, sortBy, sortOrder } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL<unknown>[] = [];
  conditions.push(isNull(files.deletedAt));
  if (entityType) conditions.push(eq(files.entityType, entityType));
  if (entityId) conditions.push(eq(files.entityId, entityId));
  if (uploadedBy) conditions.push(eq(files.uploadedBy, uploadedBy));
  if (mimeType) conditions.push(eq(files.mimeType, mimeType));
  if (search) conditions.push(ilike(files.fileName, `%${search}%`));
  if (createdFrom) conditions.push(gte(files.createdAt, createdFrom));
  if (createdTo) conditions.push(lte(files.createdAt, createdTo));

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  const [totalResult] = whereClause ? await db.select({ count: count() }).from(files).where(whereClause) : await db.select({ count: count() }).from(files);

  const sortColumn = sortBy === "fileName" ? files.fileName : sortBy === "fileSize" ? files.fileSize : files.createdAt;
  const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
  const items = whereClause
    ? await db.select().from(files).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
    : await db.select().from(files).orderBy(orderByClause).limit(limit).offset(offset);

  const total = totalResult?.count ?? 0;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        entityType: entityType || null,
        entityId: entityId || null,
        uploadedBy: uploadedBy || null,
        mimeType: mimeType || null,
        search: search || null,
        createdFrom: createdFrom?.toISOString() || null,
        createdTo: createdTo?.toISOString() || null,
        sortBy,
        sortOrder
      }
    },
    "Files retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const createFileAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const {
    fileName,
    filePath,
    fileContentBase64,
    storageBucket,
    storagePath,
    fileSize,
    mimeType,
    entityType,
    entityId,
    uploadedBy
  } = parsed.data;

  let resolvedFilePath = filePath;
  let resolvedFileSize = fileSize;

  if (fileContentBase64) {
    const fileBuffer = decodeBase64Payload(fileContentBase64);
    if (fileBuffer.length === 0) {
      const response = apiResponse.error(HttpErrors.ValidationFailed("fileContentBase64 is invalid or empty"));
      res.status(response.code).send(response);
      return;
    }

    const bucket = storageBucket || DEFAULT_STORAGE_BUCKET;
    const safeFileName = fileNameToSafePathPart(fileName);
    const uploadPath =
      storagePath || `${entityType}/${entityId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeFileName}`;

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage.from(bucket).upload(uploadPath, fileBuffer, {
      contentType: mimeType || "application/octet-stream",
      upsert: false
    });

    if (error || !data?.path) {
      const response = apiResponse.error(
        HttpErrors.InternalError(error?.message || "Unable to upload file to storage")
      );
      res.status(response.code).send(response);
      return;
    }

    resolvedFilePath = `${bucket}/${data.path}`;
    resolvedFileSize = fileBuffer.length;
  }

  if (!resolvedFilePath) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("filePath is required when fileContentBase64 is not provided"));
    res.status(response.code).send(response);
    return;
  }

  const [created] = await db
    .insert(files)
    .values({
      fileName,
      filePath: resolvedFilePath,
      fileSize: resolvedFileSize,
      mimeType,
      entityType,
      entityId,
      uploadedBy
    })
    .returning();

  if (!created) throw new Error("Unable to create file");
  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "File created successfully");
  res.status(response.code).send(response);
});

export const getFileAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("File ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid file id"));
    res.status(response.code).send(response);
    return;
  }
  const [item] = await db.select().from(files).where(and(eq(files.uuid, id), isNull(files.deletedAt))).limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("File"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item }, "File retrieved successfully");
  res.status(response.code).send(response);
});

export const downloadFileAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("File ID"));
    res.status(response.code).send(response);
    return;
  }

  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid file id"));
    res.status(response.code).send(response);
    return;
  }

  const parsedQuery = downloadQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsedQuery.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [item] = await db.select().from(files).where(and(eq(files.uuid, id), isNull(files.deletedAt))).limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("File"));
    res.status(response.code).send(response);
    return;
  }

  const [bucket, ...rest] = item.filePath.split("/");
  const storagePath = rest.join("/");

  if (!bucket || !storagePath) {
    const response = apiResponse.error(HttpErrors.InternalError("Stored file path is invalid"));
    res.status(response.code).send(response);
    return;
  }

  const { expiresIn } = parsedQuery.data;
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, expiresIn, {
    download: item.fileName
  });

  if (error || !data?.signedUrl) {
    const response = apiResponse.error(HttpErrors.InternalError(error?.message || "Unable to create download url"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      item,
      downloadUrl: data.signedUrl,
      expiresIn
    },
    "File download URL created successfully"
  );
  res.status(response.code).send(response);
});
//
// export const previewFileAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
//   const id = req.params.id;
//   if (!id) {
//     const response = apiResponse.error(HttpErrors.MissingParameter("File ID"));
//     res.status(response.code).send(response);
//     return;
//   }
//
//   if (!z.uuid().safeParse(id).success) {
//     const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid file id"));
//     res.status(response.code).send(response);
//     return;
//   }
//
//   const parsedQuery = previewQuerySchema.safeParse(req.query);
//   if (!parsedQuery.success) {
//     const response = apiResponse.error(HttpErrors.ValidationFailed(parsedQuery.error.message));
//     res.status(response.code).send(response);
//     return;
//   }
//
//   const [item] = await db.select().from(files).where(and(eq(files.uuid, id), isNull(files.deletedAt))).limit(1);
//   if (!item) {
//     const response = apiResponse.error(HttpErrors.NotFound("File"));
//     res.status(response.code).send(response);
//     return;
//   }
//
//   const [bucket, ...rest] = item.filePath.split("/");
//   const storagePath = rest.join("/");
//
//   if (!bucket || !storagePath) {
//     const response = apiResponse.error(HttpErrors.InternalError("Stored file path is invalid"));
//     res.status(response.code).send(response);
//     return;
//   }
//
//   const { expiresIn } = parsedQuery.data;
//   const supabaseAdmin = getSupabaseAdmin();
//   const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, expiresIn);
//
//   if (error || !data?.signedUrl) {
//     const response = apiResponse.error(HttpErrors.InternalError(error?.message || "Unable to create preview url"));
//     res.status(response.code).send(response);
//     return;
//   }
//
//   const response = apiResponse.success(
//     HttpStatusCode.OK,
//     {
//       item,
//       previewType: resolvePreviewType(item.fileName, item.mimeType),
//       htmlContent: null,
//       previewUrl: data.signedUrl,
//       expiresIn
//     },
//     "File preview URL created successfully"
//   );
//   res.status(response.code).send(response);
// });

export const previewFileAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("File ID"));
    res.status(response.code).send(response);
    return;
  }

  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid file id"));
    res.status(response.code).send(response);
    return;
  }

  const parsedQuery = previewQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsedQuery.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [item] = await db
    .select()
    .from(files)
    .where(and(eq(files.uuid, id), isNull(files.deletedAt)))
    .limit(1);

  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("File"));
    res.status(response.code).send(response);
    return;
  }

  const [bucket, ...rest] = item.filePath.split("/");
  const storagePath = rest.join("/");

  if (!bucket || !storagePath) {
    const response = apiResponse.error(HttpErrors.InternalError("Stored file path is invalid"));
    res.status(response.code).send(response);
    return;
  }

  const expiresIn = parsedQuery.data.expiresIn;
  const supabaseAdmin = getSupabaseAdmin();

  // ===============================
  // ⭐ CHECK PUBLIC BUCKET FIRST
  // ===============================
  const { data: bucketInfo, error: bucketError } =
    await supabaseAdmin.storage.getBucket(bucket);

  if (bucketError) {
    const response = apiResponse.error(
      HttpErrors.InternalError(bucketError.message || "Cannot get bucket info")
    );
    res.status(response.code).send(response);
    return;
  }

  let previewUrl: string;

  // ===============================
  // CASE 1: PUBLIC BUCKET
  // ===============================
  if (bucketInfo.public) {
    const { data } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    previewUrl = data.publicUrl;
  }

    // ===============================
    // CASE 2: PRIVATE BUCKET
  // ===============================
  else {
    const { data, error } =
      await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(storagePath, expiresIn);

    if (error || !data?.signedUrl) {
      const response = apiResponse.error(
        HttpErrors.InternalError(error?.message || "Unable to create preview url")
      );
      res.status(response.code).send(response);
      return;
    }

    previewUrl = data.signedUrl;
  }

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      item,
      previewType: resolvePreviewType(item.fileName, item.mimeType),
      htmlContent: null,
      previewUrl,
      expiresIn
    },
    "File preview URL created successfully"
  );

  res.status(response.code).send(response);
});

export const summarizeFileAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("File ID"));
    res.status(response.code).send(response);
    return;
  }

  if(!req.workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Workspace ID"));
    res.status(response.code).send(response);
    return;
  }

  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid file id"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = summarizeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [item] = await db.select().from(files).where(and(eq(files.uuid, id), isNull(files.deletedAt))).limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("File"));
    res.status(response.code).send(response);
    return;
  }

  const [bucket, ...rest] = item.filePath.split("/");
  const storagePath = rest.join("/");
  if (!bucket || !storagePath) {
    const response = apiResponse.error(HttpErrors.InternalError("Stored file path is invalid"));
    res.status(response.code).send(response);
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: fileBlob, error: fileError } = await supabaseAdmin.storage.from(bucket).download(storagePath);
  if (fileError || !fileBlob) {
    const response = apiResponse.error(HttpErrors.InternalError(fileError?.message || "Unable to load file"));
    res.status(response.code).send(response);
    return;
  }

  const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
  const fileType = getFileExtension(item.fileName) || resolvePreviewType(item.fileName, item.mimeType);

  try {
    const uploadResult = await uploadSmartReaderFile({
      fileBuffer,
      fileName: item.fileName,
      title: item.fileName,
      description: item.entityType,
      workspaceId: req.workspaceId
    });

    const fileHash = String(uploadResult.object?.hash ?? "").trim();
    const requestToken = String(uploadResult.object?.tokenId ?? "").trim();
    if (!fileHash) {
      throw new Error("Smart Reader không trả về file_hash");
    }

    if (!requestToken) {
      throw new Error("Smart Reader không trả về token");
    }

    // const scanTableResult = await scanTableSmartReader({
    //   fileHash,
    //   fileType,
    //   token: requestToken,
    //   details: false
    // });

    const summaryResult = await summarizeSmartReaderContent({
      fileHash,
      fileType,
      token: requestToken,
      details: true,
      workspaceId: req.workspaceId
    });

    const summary = extractSummaryText(summaryResult);
    if (!summary) {
      throw new Error("Không nhận được nội dung tóm tắt");
    }

    const createdAiSummary = await createAiSummaryRecord({
      documentId: item.entityType === "document" ? item.entityId : undefined,
      fileId: item.uuid,
      summaryText: summary,
      model: "smart-reader"
    });

    const response = apiResponse.success(
      HttpStatusCode.OK,
      {
        item,
        summary,
        aiSummary: createdAiSummary,
        summarySource: "smart-reader",
        smartReader: {
          fileHash,
          scanTable: null,
          summary: summaryResult
        }
      },
      "Tóm tắt file thành công"
    );
    res.status(response.code).send(response);
  } catch (error) {
    const response = apiResponse.error(
      HttpErrors.InternalError(error instanceof Error ? error.message : "Không thể tóm tắt file")
    );
    res.status(response.code).send(response);
  }
});

export const createAiSummaryAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = createAiSummarySchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const created = await createAiSummaryRecord({
    documentId: parsed.data.documentId,
    fileId: parsed.data.fileId,
    summaryText: parsed.data.summaryText,
    model: parsed.data.model
  });

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "AI summary created successfully");
  res.status(response.code).send(response);
});

export const updateAiSummaryAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("AI summary ID"));
    res.status(response.code).send(response);
    return;
  }

  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid ai summary id"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = updateAiSummarySchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const [updated] = await db
    .update(aiSummary)
    .set(parsed.data)
    .where(eq(aiSummary.uuid, id))
    .returning();

  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("AI summary"));
    res.status(response.code).send(response);
    return;
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "AI summary updated successfully");
  res.status(response.code).send(response);
});

export const getAiSummaryAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = getAiSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const items = await getAiSummaryItems(parsed.data);
  const latest = items[0];

  const response = apiResponse.success(
    HttpStatusCode.OK,
    latest
      ? {
          item: latest.item,
          summary: latest.summaryText,
          summarySource: latest.summarySource
        }
      : {
          item: null,
          summary: null,
          summarySource: null
        },
    "Truy xuất dữ liệu thành công"
  );
  res.status(response.code).send(response);
});

export const getOrSummarizeAiSummaryAdminByFileId = asyncHandler(async (req: Request, res: Response, next): Promise<void> => {
  const fileId = req.params.id;
  if (!fileId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("File ID"));
    res.status(response.code).send(response);
    return;
  }

  if (!z.uuid().safeParse(fileId).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid file id"));
    res.status(response.code).send(response);
    return;
  }

  const [fileItem] = await db.select().from(files).where(and(eq(files.uuid, fileId), isNull(files.deletedAt))).limit(1);
  if (!fileItem) {
    const response = apiResponse.error(HttpErrors.NotFound("File"));
    res.status(response.code).send(response);
    return;
  }

  const documentId = fileItem.entityType === "document" ? fileItem.entityId : undefined;
  const items = await getAiSummaryItems({
    documentId,
    fileId
  });

  const latest = items.find((item) => (item.summaryText || "").trim().length > 0);
  if (latest) {
    const response = apiResponse.success(
      HttpStatusCode.OK,
      {
        item: latest.item,
        summary: latest.summaryText,
        summarySource: latest.summarySource
      },
      "Truy xuất dữ liệu thành công"
    );
    res.status(response.code).send(response);
    return;
  }

  summarizeFileAdminById(req, res, next);
});

export const updateFileAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("File ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid file id"));
    res.status(response.code).send(response);
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }
  const updatePayload = sanitizeUpdatePayload(parsed.data);
  if (Object.keys(updatePayload).length === 0) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("At least one field is required"));
    res.status(response.code).send(response);
    return;
  }

  const [updated] = await db
    .update(files)
    .set(updatePayload)
    .where(and(eq(files.uuid, id), isNull(files.deletedAt)))
    .returning();
  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("File"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "File updated successfully");
  res.status(response.code).send(response);
});

export const deleteFileAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("File ID"));
    res.status(response.code).send(response);
    return;
  }
  if (!z.uuid().safeParse(id).success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid file id"));
    res.status(response.code).send(response);
    return;
  }
  const [deleted] = await db
    .update(files)
    .set({ deletedAt: new Date() })
    .where(and(eq(files.uuid, id), isNull(files.deletedAt)))
    .returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("File"));
    res.status(response.code).send(response);
    return;
  }
  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "File deleted successfully");
  res.status(response.code).send(response);
});
