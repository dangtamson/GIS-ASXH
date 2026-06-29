import { logger } from "@/helpers/logger.ts";
import { db } from "@/services/db/drizzle.ts";
import { systemConfigs } from "@/schema.ts";
import {eq} from 'drizzle-orm';

type SmartReaderConfig = {
  uploadUrl: string;
  scanTableUrl: string;
  summaryUrl: string;
  accessToken: string;
  tokenId: string;
  tokenKey: string;
  clientSession?: string;
};

type SmartReaderUploadResponse = {
  message?: string;
  object?: {
    hash?: string;
    tokenId?: string;
    fileName?: string;
    fileType?: string;
  };
  status?: string;
};

type SmartReaderRequest = {
  fileHash: string;
  fileType: string;
  token: string;
  clientSession?: string;
  details?: boolean;
  workspaceId: string
};


const normalizeBearerToken = (value: string): string =>
  /^bearer\s+/i.test(value.trim()) ? value.trim() : `Bearer ${value.trim()}`;


const getSmartReaderConfig = async (workspaceId: string): Promise<SmartReaderConfig> => {
  if (!workspaceId) {
    throw new Error("Thiếu workspaceId");
  }

  const [config] = await db.select().from(systemConfigs).where(eq(systemConfigs.workspaceId, workspaceId)).limit(1);

  if (!config?.smartReader) {
    throw new Error("Thiếu cấu hình smart reader");
  }

  const sr = config.smartReader;

  const uploadUrl = String(sr.smartReaderUploadUrl || "").trim();
  const scanTableUrl = String(sr.smartReaderUploadScanTableUrl || "").trim();
  const summaryUrl = String(sr.smartReaderSummaryUrlV2 || "").trim();

  const accessToken = String(sr.smartReaderAccessToken || "").trim();
  const tokenId = String(sr.smartReaderTokenId || "").trim();
  const tokenKey = String(sr.smartReaderTokenKey || "").trim();
  const clientSession = String(sr.smartReaderClientSession || "").trim();

  logger.info({
    uploadUrl, scanTableUrl, summaryUrl, accessToken, tokenId, tokenKey, clientSession,
  })

  if (!uploadUrl) {
    throw new Error("Thiếu cấu hình SMART_READER_UPLOAD_URL");
  }

  if (!scanTableUrl) {
    throw new Error("Thiếu cấu hình SMART_READER_SCAN_TABLE_URL");
  }

  if (!summaryUrl) {
    throw new Error("Thiếu cấu hình SMART_READER_SUMMARY_URL_V2");
  }

  if (!accessToken) {
    throw new Error("Thiếu cấu hình SMART_READER_ACCESS_TOKEN");
  }

  if (!tokenId) {
    throw new Error("Thiếu cấu hình SMART_READER_TOKEN_ID");
  }

  if (!tokenKey) {
    throw new Error("Thiếu cấu hình SMART_READER_TOKEN_KEY");
  }

  if (!clientSession) {
    throw new Error("Thiếu cấu hình SMART_READER_CLIENT_SESSION");
  }

  return {
    uploadUrl,
    scanTableUrl,
    summaryUrl,
    accessToken,
    tokenId,
    tokenKey,
    clientSession
  };
};

export const uploadSmartReaderFile = async (params: {
  fileBuffer: Buffer;
  fileName: string;
  title?: string;
  workspaceId: string;
  description?: string;
}): Promise<SmartReaderUploadResponse> => {

  const {uploadUrl, accessToken,tokenId, tokenKey} = await getSmartReaderConfig(params.workspaceId);

  const formData = new FormData();
  formData.append("file", new Blob([params.fileBuffer]), params.fileName);

  if (params.title?.trim()) {
    formData.append("title", params.title.trim());
  }

  if (params.description?.trim()) {
    formData.append("description", params.description.trim());
  }

  logger.info({
    msg: "Calling Smart Reader addFile",
    url: uploadUrl,
    fileName: params.fileName,
    fileSize: params.fileBuffer.length,
    hasAccessToken: Boolean(accessToken),
    hasTokenId: Boolean(tokenId),
    hasTokenKey: Boolean(tokenKey)
  });

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: new Headers({
      Authorization: normalizeBearerToken(accessToken),
      "Token-id": tokenId,
      "Token-key": tokenKey
    }),
    body: formData
  });

  const responseText = await response.text();
  let payload: SmartReaderUploadResponse;

  if (!responseText) {
    payload = {};
  } else {
    try {
      payload = JSON.parse(responseText) as SmartReaderUploadResponse;
    } catch {
      throw new Error(`Smart Reader trả về dữ liệu không hợp lệ: ${responseText.slice(0, 200)}`);
    }
  }

  logger.info({
    msg: "Smart Reader addFile response",
    status: response.status,
    ok: response.ok,
    responseMessage: payload?.message || null
  });

  if (!response.ok) {
    throw new Error(payload.message || `Smart Reader addFile trả về lỗi ${response.status}`);
  }

  if (payload.status && payload.status !== "OK") {
    throw new Error(payload.message || "Smart Reader addFile xử lý không thành công");
  }

  if (!payload.object?.hash) {
    throw new Error("Smart Reader không trả về file_hash");
  }

  return payload;
};

export const scanTableSmartReader = async (params: SmartReaderRequest): Promise<Record<string, unknown>> => {
  const {scanTableUrl, accessToken, tokenId, tokenKey, clientSession} = await getSmartReaderConfig(params.workspaceId);

  logger.info({
    msg: "Calling Smart Reader scan-table",
    url: scanTableUrl,
    fileHash: params.fileHash,
    fileType: params.fileType,
    hasAccessToken: Boolean(accessToken),
    hasTokenId: Boolean(tokenId),
    hasTokenKey: Boolean(tokenKey),
    hasClientSession: Boolean(params.clientSession || clientSession),
    details: params.details ?? false
  });

  const response = await fetch(scanTableUrl, {
    method: "POST",
    headers: new Headers({
      Authorization: normalizeBearerToken(accessToken),
      "Token-id": tokenId,
      "Token-key": tokenKey,
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({
      file_hash: params.fileHash,
      file_type: params.fileType,
      token: params.token,
      client_session: params.clientSession || clientSession,
      details: params.details ?? false
    })
  });

  const responseText = await response.text();
  let payload: Record<string, unknown> & { message?: string; status?: string };

  if (!responseText) {
    payload = {};
  } else {
    try {
      payload = JSON.parse(responseText) as Record<string, unknown> & { message?: string; status?: string };
    } catch {
      throw new Error(`Smart Reader trả về dữ liệu không hợp lệ: ${responseText.slice(0, 200)}`);
    }
  }

  logger.info({
    msg: "Smart Reader scan-table response",
    status: response.status,
    ok: response.ok,
    responseMessage: payload?.message || null
  });

  if (!response.ok) {
    throw new Error(payload.message || `Smart Reader scan-table trả về lỗi ${response.status}`);
  }

  if (payload.status && payload.status !== "OK") {
    throw new Error(payload.message || "Smart Reader scan-table xử lý không thành công");
  }

  return payload;
};

export const summarizeSmartReaderContent = async (params: SmartReaderRequest): Promise<Record<string, unknown>> => {

  const {summaryUrl, accessToken, tokenId, tokenKey} = await getSmartReaderConfig(params.workspaceId);

  logger.info({
    msg: "Calling Smart Reader summarization",
    url: String(summaryUrl).trim(),
    fileHash: params.fileHash,
    fileType: params.fileType,
    hasAccessToken: Boolean(String(accessToken).trim()),
    hasTokenId: Boolean(String(tokenId).trim()),
    hasTokenKey: Boolean(String(tokenKey).trim()),
    details: params.details ?? true
  });

  const response = await fetch(String(summaryUrl).trim(), {
    method: "POST",
    headers: new Headers({
      Authorization: normalizeBearerToken(String(accessToken).trim()),
      "Token-id": String(tokenId).trim(),
      "Token-key": String(tokenKey).trim(),
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({
      file_hash: params.fileHash,
      file_type: params.fileType,
      token: params.token,
      details: params.details ?? true
    })
  });

  const responseText = await response.text();
  let payload: Record<string, unknown> & { message?: string; status?: string };

  if (!responseText) {
    payload = {};
  } else {
    try {
      payload = JSON.parse(responseText) as Record<string, unknown> & { message?: string; status?: string };
    } catch {
      throw new Error(`Smart Reader trả về dữ liệu không hợp lệ: ${responseText.slice(0, 200)}`);
    }
  }

  logger.info({
    msg: "Smart Reader summarization response",
    status: response.status,
    ok: response.ok,
    responseMessage: payload?.message || null
  });

  if (!response.ok) {
    throw new Error(payload.message || `Smart Reader summarization trả về lỗi ${response.status}`);
  }

  if (payload.status && payload.status !== "OK") {
    throw new Error(payload.message || "Smart Reader summarization xử lý không thành công");
  }

  return payload;
};
