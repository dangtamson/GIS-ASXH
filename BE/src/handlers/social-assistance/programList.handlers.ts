import { HttpErrors, HttpStatusCode } from "@/helpers/Http.ts";
import { asyncHandler } from "@/helpers/request.ts";
import { apiResponse } from "@/helpers/response.ts";
import type { Request, Response } from "express";
import { listSocialAssistancePrograms } from "./programs.repository.ts";
import { socialAssistanceProgramListQuerySchema } from "./programs.schemas.ts";

export const listSocialAssistanceProgramsAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const workspaceId = req.workspaceId?.trim();
    if (!workspaceId) {
        const response = apiResponse.error(HttpErrors.Forbidden("Workspace access is required"));
        res.status(response.code).send(response);
        return;
    }

    const query = socialAssistanceProgramListQuerySchema.safeParse(req.query);
    if (!query.success) {
        const response = apiResponse.error(HttpErrors.ValidationFailed("Program filters are invalid"));
        res.status(response.code).send(response);
        return;
    }

    const items = await listSocialAssistancePrograms(workspaceId, query.data.status);
    const response = apiResponse.success(HttpStatusCode.OK, { items }, "Social assistance programs retrieved");
    res.status(response.code).send(response);
});