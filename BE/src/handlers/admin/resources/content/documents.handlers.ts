import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import { categoryItems, documents, organizations } from "@/schema.ts";
import { db } from "@/services/db/drizzle.ts";
import { auditHelpers } from "@/services/auditLog.ts";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or } from "drizzle-orm";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  fileAttachmentSchema,
  getFilesForEntities,
  getFilesForEntity,
  removeFilesForEntity,
  uploadFilesForEntity
} from "../shared/fileAttachments.ts";
import { sanitizeUpdatePayload } from "../shared/updatePayload.ts";

const documentsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  statusId: z.uuid().optional(),
  documentNumber: z.string().trim().max(100).optional(),
  summary: z.string().trim().optional(),
  organizationId: z.uuid().optional(),
  documentTypeId: z.uuid().optional(),
  fieldId: z.uuid().optional(),
  issuedDate: z.string().date().optional(),
  search: z.string().trim().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title", "issuedDate"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

const documentCreateSchema = z.object({
  title: z.string().trim().min(1),
  documentNumber: z.string().trim().max(100).optional(),
  documentTypeId: z.uuid().optional(),
  fieldId: z.uuid().optional(),
  issuingOrgId: z.uuid().optional(),
  issuedDate: z.string().date().optional(),
  effectiveDate: z.string().date().optional(),
  summary: z.string().trim().optional(),
  filePath: z.string().trim().optional(),
  statusId: z.uuid().optional(),
  createdBy: z.uuid().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional(),
  attachments: z.array(fileAttachmentSchema).max(20).optional()
});

const documentUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    documentNumber: z.string().trim().max(100).optional(),
    documentTypeId: z.uuid().optional(),
    fieldId: z.uuid().optional(),
    issuingOrgId: z.uuid().optional(),
    issuedDate: z.string().date().optional(),
    effectiveDate: z.string().date().optional(),
    summary: z.string().trim().optional(),
    filePath: z.string().trim().optional(),
    statusId: z.uuid().optional(),
    attachments: z
      .array(
        z
          .object({
            uuid: z.uuid().optional()
          })
          .merge(fileAttachmentSchema.partial())
          .refine((value) => Boolean(value.uuid || value.fileContentBase64), {
            message: "Attachment uuid or fileContentBase64 is required"
          })
      )
      .max(20)
      .optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required"
  });

export const listDocumentsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = documentsListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const {
    page,
    limit,
    statusId,
    documentNumber,
    summary,
    organizationId,
    documentTypeId,
    fieldId,
    issuedDate,
    search,
    createdFrom,
    createdTo,
    sortBy,
    sortOrder
  } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL<unknown>[] = [eq(documents.workspaceId, workspaceId), isNull(documents.deletedAt)];
  if (statusId) conditions.push(eq(documents.statusId, statusId));
  if (documentNumber) conditions.push(ilike(documents.documentNumber, `%${documentNumber}%`));
  if (summary) conditions.push(ilike(documents.summary, `%${summary}%`));
  if (organizationId) conditions.push(eq(documents.issuingOrgId, organizationId));
  if (documentTypeId) conditions.push(eq(documents.documentTypeId, documentTypeId));
  if (fieldId) conditions.push(eq(documents.fieldId, fieldId));
  if (issuedDate) conditions.push(eq(documents.issuedDate, issuedDate));
  if (search) {
    conditions.push(or(ilike(documents.title, `%${search}%`), ilike(documents.documentNumber, `%${search}%`)) as SQL<unknown>);
  }
  if (createdFrom) conditions.push(gte(documents.createdAt, createdFrom));
  if (createdTo) conditions.push(lte(documents.createdAt, createdTo));

  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  const [totalResult] = whereClause
    ? await db.select({ count: count() }).from(documents).where(whereClause)
    : await db.select({ count: count() }).from(documents);

  const sortColumn =
    sortBy === "title"
      ? documents.title
      : sortBy === "updatedAt"
        ? documents.updatedAt
        : sortBy === "issuedDate"
          ? documents.issuedDate
          : documents.createdAt;

  const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const items = whereClause
    ? await db.select().from(documents).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
    : await db.select().from(documents).orderBy(orderByClause).limit(limit).offset(offset);

  const issuingOrgIds = Array.from(
    new Set(items.map((item) => item.issuingOrgId).filter((value): value is string => Boolean(value)))
  );
  const issuingOrganizations = issuingOrgIds.length
    ? await db
        .select({
          uuid: organizations.uuid,
          name: organizations.name
        })
        .from(organizations)
        .where(and(eq(organizations.workspaceId, workspaceId), inArray(organizations.uuid, issuingOrgIds)))
    : [];
  const organizationNameById = new Map(issuingOrganizations.map((item) => [item.uuid, item.name]));

  const categoryItemIds = Array.from(
    new Set(
      items
        .flatMap((item) => [item.documentTypeId, item.fieldId])
        .filter((value): value is string => Boolean(value))
    )
  );
  const categoryItemNames = categoryItemIds.length
    ? await db
        .select({
          uuid: categoryItems.uuid,
          name: categoryItems.name
        })
        .from(categoryItems)
        .where(inArray(categoryItems.uuid, categoryItemIds))
    : [];
  const categoryItemNameById = new Map(categoryItemNames.map((item) => [item.uuid, item.name || null]));

  const filesByDocumentId = await getFilesForEntities({
    entityType: "document",
    entityIds: items.map((item) => item.uuid)
  });

  const itemsWithFiles = items.map((item) => ({
    ...item,
    issuingOrgName: item.issuingOrgId ? organizationNameById.get(item.issuingOrgId) || null : null,
    documentTypeName: item.documentTypeId ? categoryItemNameById.get(item.documentTypeId) || null : null,
    fieldName: item.fieldId ? categoryItemNameById.get(item.fieldId) || null : null,
    files: filesByDocumentId.get(item.uuid) || [],
    attachmentsCount: filesByDocumentId.get(item.uuid)?.length || 0
  }));

  const total = totalResult?.count ?? 0;

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      items: itemsWithFiles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        workspaceId,
        statusId: statusId || null,
        documentNumber: documentNumber || null,
        summary: summary || null,
        organizationId: organizationId || null,
        documentTypeId: documentTypeId || null,
        fieldId: fieldId || null,
        issuedDate: issuedDate || null,
        search: search || null,
        createdFrom: createdFrom?.toISOString() || null,
        createdTo: createdTo?.toISOString() || null,
        sortBy,
        sortOrder
      }
    },
    "Documents retrieved successfully"
  );

  res.status(response.code).send(response);
});

export const createDocumentAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = documentCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { attachments = [], ...documentPayload } = parsed.data;
  const documentId = randomUUID();

  const initialFilePath = documentPayload.filePath;
  // const [created] = await db
  //   .insert(documents)
  //   .values({
  //     ...documentPayload,
  //     workspaceId,
  //     uuid: documentId
  //   })
  //   .returning();
  let created;

  try {
    const result = await db
      .insert(documents)
      .values({
        ...documentPayload,
        workspaceId,
        uuid: documentId
      })
      .returning();

    created = result[0];
  } catch (e: any) {
    console.error("INSERT ERROR:", e);
    console.error("CAUSE:", e?.cause);
    console.error("DETAIL:", e?.cause?.detail);
    console.error("CODE:", e?.cause?.code);
    console.error("COLUMN:", e?.cause?.column);

    throw e;
  }

  if (!created) {
    throw new Error("Unable to create document");
  }

  if (attachments.length > 0) {
    try {
      const uploadedFiles = await uploadFilesForEntity({
        attachments,
        entityType: "document",
        entityId: documentId,
        defaultUploadedBy: documentPayload.createdBy
      });

      if (!initialFilePath && uploadedFiles.length > 0) {
        const [updated] = await db
          .update(documents)
          .set({ filePath: uploadedFiles[0]?.filePath })
          .where(eq(documents.uuid, documentId))
          .returning();

        if (updated) {
          if (req.accountId) {
            await auditHelpers.documentCreated(
              req.accountId,
              documentId,
              workspaceId,
              {
                title: updated.title,
                documentNumber: updated.documentNumber,
                documentTypeId: updated.documentTypeId,
                fieldId: updated.fieldId,
                issuingOrgId: updated.issuingOrgId,
                statusId: updated.statusId,
                attachments: attachments,
                attachmentsCount: attachments.length
              },
              req
            );
          }

          const response = apiResponse.success(
            HttpStatusCode.CREATED,
            { item: updated },
            "Document created successfully"
          );
          res.status(response.code).send(response);
          return;
        }
      }
    } catch (error) {
      await db.delete(documents).where(eq(documents.uuid, documentId));

      const response = apiResponse.error(
        error instanceof Error ? error : HttpErrors.InternalError("Unable to create document")
      );
      res.status(response.code).send(response);
      return;
    }
  }

  if (req.accountId) {
    await auditHelpers.documentCreated(
      req.accountId,
      documentId,
      workspaceId,
      {
        title: created.title,
        documentNumber: created.documentNumber,
        documentTypeId: created.documentTypeId,
        fieldId: created.fieldId,
        issuingOrgId: created.issuingOrgId,
        statusId: created.statusId,
        attachments: attachments,
        attachmentsCount: attachments.length
      },
      req
    );
  }

  const response = apiResponse.success(HttpStatusCode.CREATED, { item: created }, "Document created successfully");
  res.status(response.code).send(response);
});

export const getDocumentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Document ID"));
    res.status(response.code).send(response);
    return;
  }
  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid document id"));
    res.status(response.code).send(response);
    return;
  }

  const [item] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.uuid, id), eq(documents.workspaceId, workspaceId)))
    .limit(1);
  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Document"));
    res.status(response.code).send(response);
    return;
  }

  const attachedFiles = await getFilesForEntity({
    entityType: "document",
    entityId: id
  });

  const response = apiResponse.success(HttpStatusCode.OK, { item, files: attachedFiles }, "Document retrieved successfully");
  res.status(response.code).send(response);
});

export const getDocumentAdminFiles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Document ID"));
    res.status(response.code).send(response);
    return;
  }

  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid document id"));
    res.status(response.code).send(response);
    return;
  }

  const [item] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.uuid, id), eq(documents.workspaceId, workspaceId)))
    .limit(1);

  if (!item) {
    const response = apiResponse.error(HttpErrors.NotFound("Document"));
    res.status(response.code).send(response);
    return;
  }

  const attachedFiles = await getFilesForEntity({
    entityType: "document",
    entityId: id
  });

  const response = apiResponse.success(
    HttpStatusCode.OK,
    {
      item,
      files: attachedFiles,
      attachmentsCount: attachedFiles.length
    },
    "Document files retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const updateDocumentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Document ID"));
    res.status(response.code).send(response);
    return;
  }
  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid document id"));
    res.status(response.code).send(response);
    return;
  }

  const parsed = documentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return;
  }

  const { attachments, ...documentPayload } = parsed.data;
  const updatePayload = sanitizeUpdatePayload(documentPayload);

  if (Object.keys(updatePayload).length === 0 && attachments === undefined) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("At least one field is required"));
    res.status(response.code).send(response);
    return;
  }

  const [existingDocument] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.uuid, id), eq(documents.workspaceId, workspaceId)))
    .limit(1);

  if (!existingDocument) {
    const response = apiResponse.error(HttpErrors.NotFound("Document"));
    res.status(response.code).send(response);
    return;
  }

  let updated =
    Object.keys(updatePayload).length > 0
      ? (
          await db
            .update(documents)
            .set(updatePayload)
            .where(and(eq(documents.uuid, id), eq(documents.workspaceId, workspaceId)))
            .returning()
        )[0]
      : undefined;

  if (!updated) {
    updated = existingDocument;
    [updated] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.uuid, id), eq(documents.workspaceId, workspaceId)))
      .limit(1);
  }

  if (!updated) {
    const response = apiResponse.error(HttpErrors.NotFound("Document"));
    res.status(response.code).send(response);
    return;
  }

  if (attachments !== undefined) {
    const oldAttachedFiles = await getFilesForEntity({
      entityType: "document",
      entityId: id
    });

    const addedFiles = attachments.filter((attachment) => attachment.fileContentBase64);
    const currentIds = attachments.filter((attachment) => attachment.uuid).map((attachment) => attachment.uuid as string);
    const removedFiles = oldAttachedFiles.filter((oldFile) => !currentIds.includes(oldFile.uuid));

    if (addedFiles.length > 0) {
      try {
        await uploadFilesForEntity({
          attachments: addedFiles as z.infer<typeof fileAttachmentSchema>[],
          entityType: "document",
          entityId: id,
          defaultUploadedBy: updated.createdBy ?? undefined
        });
      } catch (error) {
        const response = apiResponse.error(
          error instanceof Error ? error : HttpErrors.InternalError("Unable to update document files")
        );
        res.status(response.code).send(response);
        return;
      }
    }

    if (removedFiles.length > 0) {
      try {
        await removeFilesForEntity({
          files: removedFiles,
          entityType: "document",
          entityId: id
        });
      } catch (error) {
        const response = apiResponse.error(
          error instanceof Error ? error : HttpErrors.InternalError("Unable to update document files")
        );
        res.status(response.code).send(response);
        return;
      }
    }

    if (!Object.prototype.hasOwnProperty.call(documentPayload, "filePath")) {
      const currentFiles = await getFilesForEntity({
        entityType: "document",
        entityId: id
      });

      const syncedFilePath = currentFiles[0]?.filePath ?? null;
      const [synced] = await db
        .update(documents)
        .set({ filePath: syncedFilePath })
        .where(and(eq(documents.uuid, id), eq(documents.workspaceId, workspaceId)))
        .returning();

      if (synced) {
        updated = synced;
      }
    }
  }

  if (req.accountId) {
    await auditHelpers.documentUpdated(req.accountId, id, workspaceId, {
      dataDetail: {
        oldData: existingDocument,
        newData: req.body
      },
    }, req);
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: updated }, "Document updated successfully");
  res.status(response.code).send(response);
});

export const deleteDocumentAdminById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId?.trim();
  if (!workspaceId) {
    const response = apiResponse.error(HttpErrors.MissingParameter("x-workspace-id header"));
    res.status(response.code).send(response);
    return;
  }

  const id = req.params.id;
  if (!id) {
    const response = apiResponse.error(HttpErrors.MissingParameter("Document ID"));
    res.status(response.code).send(response);
    return;
  }
  const idValidation = z.uuid().safeParse(id);
  if (!idValidation.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Invalid document id"));
    res.status(response.code).send(response);
    return;
  }

  const deletedAt = new Date();
  const [deleted] = await db
    .update(documents)
    .set({
      deletedAt,
      updatedAt: deletedAt
    })
    .where(and(eq(documents.uuid, id), eq(documents.workspaceId, workspaceId), isNull(documents.deletedAt)))
    .returning();
  if (!deleted) {
    const response = apiResponse.error(HttpErrors.NotFound("Document"));
    res.status(response.code).send(response);
    return;
  }

  if (req.accountId) {
    await auditHelpers.documentDeleted(req.accountId, id, workspaceId, {
      deletedAt: deleted.deletedAt,
      title: deleted.title,
      documentNumber: deleted.documentNumber
    }, req);
  }

  const response = apiResponse.success(HttpStatusCode.OK, { item: deleted }, "Document deleted successfully");
  res.status(response.code).send(response);
});
