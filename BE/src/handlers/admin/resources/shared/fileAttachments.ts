import { HttpErrors } from "@/helpers/Http.ts";
import { files } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { getSupabaseAdmin } from "@/services/supabase.ts";
import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const DEFAULT_STORAGE_BUCKET = "documents";

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

export const fileAttachmentSchema = z.object({
  fileName: z.string().trim().min(1),
  fileContentBase64: z.string().min(1),
  mimeType: z.string().trim().max(150).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  storageBucket: z.string().trim().min(1).optional(),
  storagePath: z.string().trim().min(1).optional(),
  uploadedBy: z.uuid().optional()
});

export type FileAttachmentInput = z.infer<typeof fileAttachmentSchema>;
type FileRecord = InferSelectModel<typeof files>;

export const uploadFilesForEntity = async (params: {
  attachments: FileAttachmentInput[];
  entityType: string;
  entityId: string;
  defaultUploadedBy?: string;
}): Promise<Array<{ uuid: string; filePath: string }>> => {
  const { attachments, entityType, entityId, defaultUploadedBy } = params;
  if (attachments.length === 0) {
    return [];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const uploadedRefs: Array<{ bucket: string; path: string }> = [];

  try {
    const rowsToInsert: Array<{
      fileName: string;
      filePath: string;
      fileSize?: number;
      mimeType?: string;
      entityType: string;
      entityId: string;
      uploadedBy?: string;
    }> = [];

    for (const attachment of attachments) {
      const fileBuffer = decodeBase64Payload(attachment.fileContentBase64);
      if (fileBuffer.length === 0) {
        throw HttpErrors.ValidationFailed(`Attachment ${attachment.fileName} is invalid or empty`);
      }

      const bucket = attachment.storageBucket || DEFAULT_STORAGE_BUCKET;
      const safeFileName = fileNameToSafePathPart(attachment.fileName);
      const uploadPath =
        attachment.storagePath || `${entityType}/${entityId}/${Date.now()}-${randomUUID().slice(0, 8)}-${safeFileName}`;

      const { data, error } = await supabaseAdmin.storage.from(bucket).upload(uploadPath, fileBuffer, {
        contentType: attachment.mimeType || "application/octet-stream",
        upsert: false
      });

      if (error || !data?.path) {
        throw HttpErrors.InternalError(error?.message || `Unable to upload ${attachment.fileName} to storage`);
      }

      uploadedRefs.push({ bucket, path: data.path });

      rowsToInsert.push({
        fileName: attachment.fileName,
        filePath: `${bucket}/${data.path}`,
        fileSize: attachment.fileSize ?? fileBuffer.length,
        mimeType: attachment.mimeType,
        entityType,
        entityId,
        uploadedBy: attachment.uploadedBy ?? defaultUploadedBy
      });
    }

    const inserted = await db.insert(files).values(rowsToInsert).returning({
      uuid: files.uuid,
      filePath: files.filePath
    });

    return inserted;
  } catch (error) {
    if (uploadedRefs.length > 0) {
      const refsByBucket = uploadedRefs.reduce<Record<string, string[]>>((acc, current) => {
        const existing = acc[current.bucket] || [];
        existing.push(current.path);
        acc[current.bucket] = existing;
        return acc;
      }, {});

      await Promise.all(
        Object.entries(refsByBucket).map(async ([bucket, paths]) => {
          await supabaseAdmin.storage.from(bucket).remove(paths);
        })
      );

      const uploadedPaths = uploadedRefs.map((item) => `${item.bucket}/${item.path}`);
      if (uploadedPaths.length > 0) {
        await db.delete(files).where(and(eq(files.entityType, entityType), eq(files.entityId, entityId), inArray(files.filePath, uploadedPaths)));
      }
    }

    throw error;
  }
};

export const getFilesForEntity = async (params: { entityType: string; entityId: string }): Promise<FileRecord[]> => {
  const { entityType, entityId } = params;
  return db
    .select()
    .from(files)
    .where(and(eq(files.entityType, entityType), eq(files.entityId, entityId), isNull(files.deletedAt)))
    .orderBy(desc(files.createdAt));
};

export const getFilesForEntities = async (params: {
  entityType: string;
  entityIds: string[];
}): Promise<Map<string, FileRecord[]>> => {
  const { entityType, entityIds } = params;

  if (entityIds.length === 0) {
    return new Map();
  }

  const records = await db
    .select()
    .from(files)
    .where(and(eq(files.entityType, entityType), inArray(files.entityId, entityIds), isNull(files.deletedAt)))
    .orderBy(desc(files.createdAt));

  const filesByEntityId = new Map<string, FileRecord[]>();

  for (const record of records) {
    const existing = filesByEntityId.get(record.entityId) || [];
    existing.push(record);
    filesByEntityId.set(record.entityId, existing);
  }

  return filesByEntityId;
};

export const removeFilesForEntity = async (params: {
  files: FileRecord[];
  entityType: string;
  entityId: string;
}): Promise<void> => {
  const { files: filesToRemove, entityType, entityId } = params;

  if (filesToRemove.length === 0) {
    return;
  }

  const uuids = filesToRemove.map((f) => f.uuid);

  await db
    .update(files)
    .set({ deletedAt: new Date() })
    .where(and(eq(files.entityType, entityType), eq(files.entityId, entityId), inArray(files.uuid, uuids), isNull(files.deletedAt)));
};
