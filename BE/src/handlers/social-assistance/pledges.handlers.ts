import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import type { Request, Response } from "express";
import { createPublicSocialAssistancePledge } from "./pledges.repository.ts";
import { publicSocialAssistancePledgeSchema } from "./pledges.schemas.ts";

const sendError = (res: Response, error: ReturnType<typeof HttpErrors.Forbidden>): void => {
    const response = apiResponse.error(error);
    res.status(response.code).send(response);
};

export const submitPublicSocialAssistancePledge = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    const parsed = publicSocialAssistancePledgeSchema.safeParse(req.body);
    if (!parsed.success) {
        sendError(res, HttpErrors.ValidationFailed("Pledge information is invalid"));
        return;
    }

    const result = await createPublicSocialAssistancePledge(slug, parsed.data, idempotencyKey);
    if (!result) {
        sendError(res, HttpErrors.NotFound("Published social assistance program"));
        return;
    }

    const response = apiResponse.success(
        HttpStatusCode.CREATED,
        { pledgeId: result.pledgeId },
        "Cam ket ung ho da duoc tiep nhan va se duoc can bo xac nhan"
    );
    res.status(response.code).send(response);
});