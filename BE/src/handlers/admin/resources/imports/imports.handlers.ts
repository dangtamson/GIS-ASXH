import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import type { Request, Response } from "express";
import { z } from "zod";
import { getImportModule, previewImportRows } from "./imports.registry.ts";

const importParamsSchema = z.object({
  module: z.string().trim().min(1)
});

const importRowsBodySchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).default([])
});

const parseModule = (req: Request, res: Response) => {
  const parsed = importParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return null;
  }
  return parsed.data.module;
};

const parseRows = (req: Request, res: Response) => {
  const parsed = importRowsBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const response = apiResponse.error(HttpErrors.ValidationFailed(parsed.error.message));
    res.status(response.code).send(response);
    return null;
  }
  return parsed.data.rows;
};

const getModuleOrSend = (moduleKey: string, res: Response) => {
  try {
    return getImportModule(moduleKey);
  } catch (error) {
    const response = apiResponse.error(HttpErrors.NotFound("Import module"));
    res.status(response.code).send(response);
    return null;
  }
};

export const getImportTemplateAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const moduleKey = parseModule(req, res);
  if (!moduleKey) return;
  const module = getModuleOrSend(moduleKey, res);
  if (!module) return;
  const response = apiResponse.success(
    HttpStatusCode.OK,
    { key: module.key, name: module.name, fields: module.fields },
    "Import template retrieved successfully"
  );
  res.status(response.code).send(response);
});

export const previewImportAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const moduleKey = parseModule(req, res);
  if (!moduleKey) return;
  const rows = parseRows(req, res);
  if (!rows) return;
  const module = getModuleOrSend(moduleKey, res);
  if (!module) return;
  const result = previewImportRows(moduleKey, rows);
  const response = apiResponse.success(HttpStatusCode.OK, result, "Import preview completed successfully");
  res.status(response.code).send(response);
});

export const commitImportAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const moduleKey = parseModule(req, res);
  if (!moduleKey) return;
  const rows = parseRows(req, res);
  if (!rows) return;
  const module = getModuleOrSend(moduleKey, res);
  if (!module) return;
  const preview = module.preview(rows);
  if (preview.errors.length > 0) {
    const response = apiResponse.error(HttpErrors.ValidationFailed("Import data contains invalid rows"));
    res.status(response.code).send({ ...response, data: preview });
    return;
  }
  const result = await module.commit(preview.validRows.map((row) => row.data), req.accountId?.trim() ?? null);
  const response = apiResponse.success(HttpStatusCode.OK, result, "Import committed successfully");
  res.status(response.code).send(response);
});
