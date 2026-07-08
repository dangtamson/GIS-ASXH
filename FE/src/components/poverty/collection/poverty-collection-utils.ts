import type { AttachmentType } from "@/components/controller/input/UploadAttachmentField";

export type CollectionMode =
    | "search"
    | "create-step-1"
    | "create-step-2"
    | "update-step-1"
    | "update-step-2";

export type StepOneFormValues = {
    code?: string;
    year?: number;
    povertyType?: string;
    status?: string;
    provinceCode?: string;
    wardCode?: string;
    areaId?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    headFullName?: string;
    headCitizenId?: string;
    memberCount?: number;
};

export type StepTwoFormValues = {
    recordedAt: string;
    familySituation?: string;
    currentStatus?: string;
    note?: string;
};

export const COLLECTION_MAP_LAYER_Z_INDEX = 0;
export const COLLECTION_ACTION_BAR_Z_INDEX = 40;

export function createInitialCollectionState() {
    return {
        mode: "search" as CollectionMode,
        step: null as 1 | 2 | null,
        selectedHouseholdId: null as string | null,
    };
}

export function canSubmitCollectionStepTwo(input: {
    familySituation?: string;
    currentStatus?: string;
    photos: AttachmentType[];
}): boolean {
    return Boolean(
        String(input.familySituation ?? "").trim()
        || String(input.currentStatus ?? "").trim()
        || input.photos.length > 0,
    );
}

export function buildCoordinateStatusLabel(input: {
    latitude?: number | null;
    longitude?: number | null;
}) {
    return typeof input.latitude === "number" && typeof input.longitude === "number"
        ? "Da co toa do"
        : "Chua co toa do";
}

export function buildCollectionSearchLoadingState(input: {
    searching: boolean;
    loading: boolean;
}) {
    return input.searching || input.loading;
}

export function shouldLoadCollectionWardOptions(input: {
    previousProvinceCode?: string | null;
    nextProvinceCode?: string | null;
}) {
    const previousProvinceCode = String(input.previousProvinceCode ?? "").trim();
    const nextProvinceCode = String(input.nextProvinceCode ?? "").trim();
    return nextProvinceCode.length > 0 && nextProvinceCode !== previousProvinceCode;
}

export function shouldLoadCollectionAreaOptions(input: {
    previousWardCode?: string | null;
    nextWardCode?: string | null;
}) {
    const previousWardCode = String(input.previousWardCode ?? "").trim();
    const nextWardCode = String(input.nextWardCode ?? "").trim();
    return nextWardCode.length > 0 && nextWardCode !== previousWardCode;
}

export function buildStepOneUpdatePayload(values: StepOneFormValues) {
    return {
        provinceCode: values.provinceCode,
        wardCode: values.wardCode,
        areaId: values.areaId,
        address: values.address,
        latitude: values.latitude,
        longitude: values.longitude,
    };
}

export function buildStepOneCreatePayload(values: StepOneFormValues) {
    return {
        code: values.code,
        year: values.year,
        povertyType: values.povertyType,
        status: values.status,
        provinceCode: values.provinceCode,
        wardCode: values.wardCode,
        areaId: values.areaId,
        address: values.address,
        latitude: values.latitude,
        longitude: values.longitude,
        headFullName: values.headFullName,
        headCitizenId: values.headCitizenId,
        memberCount: values.memberCount,
    };
}

export function buildStepTwoContextPayload(values: StepTwoFormValues) {
    const trim = (value?: string) => {
        const next = String(value ?? "").trim();
        return next.length > 0 ? next : undefined;
    };

    return {
        recordedAt: values.recordedAt,
        familySituation: trim(values.familySituation),
        currentStatus: trim(values.currentStatus),
        note: trim(values.note),
    };
}
