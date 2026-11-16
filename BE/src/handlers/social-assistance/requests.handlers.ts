import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import type { Request, Response } from "express";
import {
    publicSocialAssistanceRequestSchema,
    publicSocialAssistanceWardQuerySchema
} from "./requests.schemas.ts";
import {
    createPublicRequest,
    listPublicSocialAssistanceProvinces,
    listPublicSocialAssistanceWards
} from "./requests.repository.ts";

const sendError = (res: Response, error: ReturnType<typeof HttpErrors.ValidationFailed>): void => {
    const response = apiResponse.error(error);
    res.status(response.code).send(response);
};

export const submitPublicSocialAssistanceRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) {
        sendError(res, HttpErrors.NotFound("Social assistance portal"));
        return;
    }

    const idempotencyKey = String(req.get("Idempotency-Key") ?? "").trim();
    if (!idempotencyKey) {
        sendError(res, HttpErrors.MissingParameter("Idempotency-Key"));
        return;
    }

    const parsed = publicSocialAssistanceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        const details = parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
            .join("; ");
        sendError(res, HttpErrors.ValidationFailed(`Request information is invalid: ${details}`));
        return;
    }

    const result = await createPublicRequest(slug, parsed.data, idempotencyKey);
    if (!result) {
        sendError(res, HttpErrors.NotFound("Social assistance portal"));
        return;
    }

    const response = apiResponse.success(
        HttpStatusCode.CREATED,
        { receiptCode: result.receiptCode },
        "Request received"
    );
    res.status(response.code).send(response);
});

export const listPublicSocialAssistanceProvincesHandler = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const slug = String(req.params.slug ?? "").trim();
        if (!slug) {
            sendError(res, HttpErrors.NotFound("Social assistance portal"));
            return;
        }

        const items = await listPublicSocialAssistanceProvinces(slug);
        if (!items) {
            sendError(res, HttpErrors.NotFound("Social assistance portal"));
            return;
        }

        const response = apiResponse.success(HttpStatusCode.OK, { items }, "Province list retrieved");
        res.status(response.code).send(response);
    }
);

export const listPublicSocialAssistanceWardsHandler = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const slug = String(req.params.slug ?? "").trim();
        if (!slug) {
            sendError(res, HttpErrors.NotFound("Social assistance portal"));
            return;
        }

        const query = publicSocialAssistanceWardQuerySchema.safeParse(req.query);
        if (!query.success) {
            sendError(res, HttpErrors.ValidationFailed("Province code is required"));
            return;
        }

        const items = await listPublicSocialAssistanceWards(slug, query.data.provinceCode);
        if (!items) {
            sendError(res, HttpErrors.NotFound("Social assistance portal"));
            return;
        }

        const response = apiResponse.success(HttpStatusCode.OK, { items }, "Ward list retrieved");
        res.status(response.code).send(response);
    }
);