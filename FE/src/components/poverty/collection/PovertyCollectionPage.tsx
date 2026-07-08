"use client";

import type { AttachmentType } from "@/components/controller/input/UploadAttachmentField";
import { TitleSpace } from "@/components/controller";
import PovertyCollectionSearchView from "@/components/poverty/collection/PovertyCollectionSearchView";
import PovertyCollectionStepOneForm from "@/components/poverty/collection/PovertyCollectionStepOneForm";
import PovertyCollectionStepTwoForm from "@/components/poverty/collection/PovertyCollectionStepTwoForm";
import {
    buildCollectionSearchLoadingState,
    buildStepOneCreatePayload,
    buildStepOneUpdatePayload,
    buildStepTwoContextPayload,
    canSubmitCollectionStepTwo,
    createInitialCollectionState,
    type StepOneFormValues,
    type StepTwoFormValues,
} from "@/components/poverty/collection/poverty-collection-utils";
import { DEFAULT_CANTHO_PROVINCE_CODE } from "@/components/poverty/poverty-location-utils";
import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { usePermission } from "@/hooks/usePermission";
import type {
    HouseholdDetailResponse,
    HouseholdFieldPhoto,
    HouseholdHistoryPayload,
    PaginatedResponse,
    PoorHousehold,
    PoorHouseholdCreatePayload,
    PoorHouseholdUpdatePayload,
    PovertyArea,
    ProvinceOption,
    WardOption,
} from "@/types/poverty";
import { App, Button, Spin } from "antd";
import { ArrowLeft, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const currentYear = new Date().getFullYear();
const fieldPhotoEntityType = "poor_household";
const fieldPhotoStorageBucket = "poor_household";

const createDefaultStepOneValues = (): StepOneFormValues => ({
    year: currentYear,
    povertyType: "POOR",
    status: "ACTIVE",
    provinceCode: DEFAULT_CANTHO_PROVINCE_CODE,
});

const createDefaultStepTwoValues = (): StepTwoFormValues => ({
    recordedAt: new Date().toISOString().slice(0, 10),
    familySituation: "",
    currentStatus: "",
    note: "",
});

const toSafeStorageFileName = (fileName: string): string =>
    fileName.trim().replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "") || "field-photo";

async function uploadFieldPhotos(householdId: string, photos: AttachmentType[]): Promise<void> {
    await Promise.all(
        photos.map((photo, index) =>
            api.post<{ item?: HouseholdFieldPhoto }>(endpoints.admin.files, {
                fileName: photo.fileName,
                fileSize: photo.fileSize,
                mimeType: photo.mimeType,
                fileContentBase64: photo.fileContentBase64,
                storageBucket: fieldPhotoStorageBucket,
                storagePath: `image/${householdId}/${Date.now()}-${index}-${toSafeStorageFileName(photo.fileName)}`,
                entityType: fieldPhotoEntityType,
                entityId: householdId,
            })
        )
    );
}

export default function PovertyCollectionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { notification } = App.useApp();
    const [collectionState, setCollectionState] = useState(createInitialCollectionState());
    const [searchValue, setSearchValue] = useState("");
    const [searchResults, setSearchResults] = useState<PoorHousehold[]>([]);
    const [selectedHousehold, setSelectedHousehold] = useState<PoorHousehold | null>(null);
    const [stepOneValues, setStepOneValues] = useState<StepOneFormValues>(createDefaultStepOneValues);
    const [stepTwoValues, setStepTwoValues] = useState<StepTwoFormValues>(createDefaultStepTwoValues);
    const [stepTwoPhotos, setStepTwoPhotos] = useState<AttachmentType[]>([]);
    const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
    const [wardOptions, setWardOptions] = useState<WardOption[]>([]);
    const [areaOptions, setAreaOptions] = useState<PovertyArea[]>([]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { can: canCreateHousehold } = usePermission("poverty.household.create");
    const { can: canUpdateHousehold } = usePermission("poverty.household.update");

    const canOpenCollection = canCreateHousehold || canUpdateHousehold;
    const currentHouseholdId = searchParams.get("householdId");
    const currentMode = searchParams.get("mode");

    const isCreateStep = collectionState.mode === "create-step-1" || collectionState.mode === "create-step-2";

    const loadProvinces = useCallback(async () => {
        const data = await api.get<{ items?: ProvinceOption[] }>(endpoints.poverty.locationProvinces);
        setProvinceOptions(data.items ?? []);
    }, []);

    const loadWards = useCallback(async (provinceCode?: string) => {
        const nextProvinceCode = String(provinceCode ?? "").trim();
        if (!nextProvinceCode) {
            setWardOptions([]);
            return;
        }
        const data = await api.get<{ items?: WardOption[] }>(endpoints.poverty.locationWards(nextProvinceCode));
        setWardOptions(data.items ?? []);
    }, []);

    const loadAreas = useCallback(async (wardCode?: string) => {
        const nextWardCode = String(wardCode ?? "").trim();
        if (!nextWardCode) {
            setAreaOptions([]);
            return;
        }
        const data = await api.get<{ items?: PovertyArea[] }>(endpoints.poverty.locationAreas(nextWardCode));
        setAreaOptions(data.items ?? []);
    }, []);

    const handleProvinceChange = useCallback((provinceCode?: string) => {
        void loadWards(provinceCode);
    }, [loadWards]);

    const handleWardChange = useCallback((wardCode?: string) => {
        void loadAreas(wardCode);
    }, [loadAreas]);

    const resetToSearch = useCallback(() => {
        setCollectionState(createInitialCollectionState());
        setSelectedHousehold(null);
        setSearchResults([]);
        setSearchValue("");
        setStepOneValues(createDefaultStepOneValues());
        setStepTwoValues(createDefaultStepTwoValues());
        setStepTwoPhotos([]);
        setWardOptions([]);
        setAreaOptions([]);
        router.replace("/ho-ngheo/thu-thap");
    }, [router]);

    const hydrateFromHousehold = useCallback((household: PoorHousehold) => {
        setSelectedHousehold(household);
        setStepOneValues({
            code: household.code ?? undefined,
            year: household.year,
            povertyType: String(household.povertyType ?? "POOR"),
            status: String(household.status ?? "ACTIVE"),
            provinceCode: household.provinceCode ?? DEFAULT_CANTHO_PROVINCE_CODE,
            wardCode: household.wardCode ?? undefined,
            areaId: household.areaId ?? undefined,
            address: household.address ?? undefined,
            latitude: household.latitude ?? undefined,
            longitude: household.longitude ?? undefined,
            headFullName: household.headFullName ?? undefined,
            headCitizenId: household.headCitizenId ?? undefined,
            memberCount: household.memberCount ?? undefined,
        });
    }, []);

    const loadHouseholdDetail = useCallback(async (householdId: string) => {
        setLoading(true);
        try {
            const data = await api.get<HouseholdDetailResponse>(endpoints.poverty.household(householdId));
            if (!data.household) {
                notification.warning({ message: "Không tìm thấy hồ sơ hộ" });
                return null;
            }
            hydrateFromHousehold(data.household);
            setCollectionState({
                mode: "update-step-1",
                step: 1,
                selectedHouseholdId: data.household.id,
            });
            return data.household;
        } catch (error) {
            notification.error({
                message: "Không thể tải hồ sơ hộ",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
            return null;
        } finally {
            setLoading(false);
        }
    }, [hydrateFromHousehold, notification]);

    const searchHouseholds = useCallback(async () => {
        const keyword = searchValue.trim();
        if (!keyword) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const params = new URLSearchParams({
                search: keyword,
                page: "1",
                limit: "12",
                sortBy: "updatedAt",
                sortOrder: "desc",
                status: "ACTIVE",
            });
            const data = await api.get<PaginatedResponse<PoorHousehold>>(`${endpoints.poverty.households}?${params.toString()}`);
            setSearchResults(data.items ?? []);
        } catch (error) {
            notification.error({
                message: "Không thể tìm hộ",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setSearching(false);
        }
    }, [notification, searchValue]);

    const openCreateFlow = useCallback(() => {
        if (!canCreateHousehold) {
            notification.warning({ message: "Tài khoản chưa có quyền thêm mới hộ" });
            return;
        }
        setSelectedHousehold(null);
        setStepOneValues(createDefaultStepOneValues());
        setStepTwoValues(createDefaultStepTwoValues());
        setStepTwoPhotos([]);
        setCollectionState({
            mode: "create-step-1",
            step: 1,
            selectedHouseholdId: null,
        });
        router.replace("/ho-ngheo/thu-thap?mode=create");
    }, [canCreateHousehold, notification, router]);

    const openExistingFlow = useCallback(async (item: PoorHousehold) => {
        if (!canUpdateHousehold) {
            notification.warning({ message: "Tài khoản chưa có quyền cập nhật hộ" });
            return;
        }
        router.replace(`/ho-ngheo/thu-thap?householdId=${item.id}`);
        await loadHouseholdDetail(item.id);
    }, [canUpdateHousehold, loadHouseholdDetail, notification, router]);

    const handleStepOneSubmit = useCallback(async (values: StepOneFormValues) => {
        setSubmitting(true);
        try {
            setStepOneValues(values);

            if (isCreateStep) {
                const payload = buildStepOneCreatePayload(values) as PoorHouseholdCreatePayload;
                const response = await api.post<{ item?: PoorHousehold }>(endpoints.poverty.households, payload);
                const createdHousehold = response.item;
                if (!createdHousehold?.id) {
                    throw new Error("Không nhận được mã hộ mới sau khi lưu");
                }
                const household = await loadHouseholdDetail(createdHousehold.id);
                setCollectionState({
                    mode: "create-step-2",
                    step: 2,
                    selectedHouseholdId: createdHousehold.id,
                });
                router.replace(`/ho-ngheo/thu-thap?householdId=${createdHousehold.id}&mode=create`);
                notification.success({
                    message: "Đã lưu bước 1",
                    description: household?.headFullName
                        ? `Tiếp tục bổ sung hoàn cảnh và ảnh cho hộ ${household.headFullName}.`
                        : "Tiếp tục bổ sung hoàn cảnh và ảnh thực tế.",
                });
                return;
            }

            if (!selectedHousehold?.id) {
                throw new Error("Không xác định được hộ cần cập nhật");
            }

            const payload = buildStepOneUpdatePayload(values) as PoorHouseholdUpdatePayload;
            await api.patch(endpoints.poverty.household(selectedHousehold.id), payload);
            const household = await loadHouseholdDetail(selectedHousehold.id);
            setCollectionState({
                mode: "update-step-2",
                step: 2,
                selectedHouseholdId: selectedHousehold.id,
            });
            notification.success({
                message: "Đã cập nhật vị trí hộ",
                description: household?.headFullName
                    ? `Tiếp tục ghi nhận hoàn cảnh và ảnh cho hộ ${household.headFullName}.`
                    : "Tiếp tục ghi nhận hoàn cảnh và ảnh thực tế.",
            });
        } catch (error) {
            notification.error({
                message: "Không thể lưu bước 1",
                description: error instanceof ApiError ? error.message : (error instanceof Error ? error.message : "Vui lòng kiểm tra lại dữ liệu"),
            });
        } finally {
            setSubmitting(false);
        }
    }, [isCreateStep, loadHouseholdDetail, notification, router, selectedHousehold?.id]);

    const handleStepTwoSubmit = useCallback(async (values: StepTwoFormValues, photos: AttachmentType[]) => {
        if (!collectionState.selectedHouseholdId) {
            notification.warning({ message: "Chưa xác định được hộ để lưu" });
            return;
        }

        setSubmitting(true);
        try {
            setStepTwoValues(values);
            const shouldSaveContext = canSubmitCollectionStepTwo({
                familySituation: values.familySituation,
                currentStatus: values.currentStatus,
                photos,
            }) || String(values.note ?? "").trim().length > 0;

            if (shouldSaveContext) {
                const payload = buildStepTwoContextPayload(values) as HouseholdHistoryPayload;
                await api.post(endpoints.poverty.householdContextHistories(collectionState.selectedHouseholdId), payload);
            }

            if (photos.length > 0) {
                await uploadFieldPhotos(collectionState.selectedHouseholdId, photos);
            }

            notification.success({
                message: "Đã hoàn tất thu thập thông tin",
                description: shouldSaveContext || photos.length > 0
                    ? "Dữ liệu hoàn cảnh, hiện trạng và ảnh thực tế đã được lưu."
                    : "Đã lưu xong hồ sơ và vị trí hộ.",
            });

            resetToSearch();
        } catch (error) {
            notification.error({
                message: "Không thể lưu bước 2",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setSubmitting(false);
        }
    }, [collectionState.selectedHouseholdId, notification, resetToSearch]);

    useEffect(() => {
        void loadProvinces().catch((error) => {
            notification.error({
                message: "Không thể tải tỉnh/thành phố",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        });
    }, [loadProvinces, notification]);

    useEffect(() => {
        if (currentHouseholdId) {
            void loadHouseholdDetail(currentHouseholdId);
            return;
        }

        if (currentMode === "create") {
            setCollectionState({
                mode: "create-step-1",
                step: 1,
                selectedHouseholdId: null,
            });
            return;
        }

        setCollectionState(createInitialCollectionState());
    }, [currentHouseholdId, currentMode, loadHouseholdDetail]);

    const actions = (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {collectionState.step ? (
                <Button
                    size="large"
                    className="h-10 rounded-2xl border-gray-200"
                    icon={<ArrowLeft size={16} />}
                    onClick={resetToSearch}
                >
                    Về tìm kiếm
                </Button>
            ) : null}
        </div>
    );

    return (
        <div className="min-w-0 space-y-4 pb-6">
            <TitleSpace
                title="Thu thập hộ nghèo"
                actions={actions}
            />

            {!canOpenCollection ? (
                <div className="mx-auto flex min-h-[40vh] w-full max-w-xl items-center justify-center rounded-[28px] border border-gray-200 bg-white p-6 text-center shadow-sm">
                    <div>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                            <Search size={24} />
                        </div>
                        <h2 className="mt-4 text-base font-semibold text-gray-900">Chưa có quyền sử dụng mini-app thu thập</h2>
                        <p className="mt-2 text-sm leading-6 text-gray-500">Cần được cấp quyền tạo mới hoặc cập nhật hộ nghèo để tiếp tục.</p>
                    </div>
                </div>
            ) : null}

            {canOpenCollection ? (
                <div className="min-h-[60vh]">
                    {loading && collectionState.step ? (
                        <div className="mx-auto flex min-h-[40vh] w-full max-w-xl items-center justify-center rounded-[28px] border border-gray-200 bg-white">
                            <Spin />
                        </div>
                    ) : null}

                    {!collectionState.step ? (
                        <PovertyCollectionSearchView
                            canCreateHousehold={canCreateHousehold}
                            canUpdateHousehold={canUpdateHousehold}
                            items={searchResults}
                            loading={buildCollectionSearchLoadingState({ searching, loading })}
                            searching={searching}
                            searchValue={searchValue}
                            onCreateNew={openCreateFlow}
                            onSearch={searchHouseholds}
                            onSearchValueChange={setSearchValue}
                            onSelectHousehold={(item) => { void openExistingFlow(item); }}
                        />
                    ) : null}

                    {collectionState.step === 1 ? (
                        <PovertyCollectionStepOneForm
                            areaOptions={areaOptions}
                            household={selectedHousehold}
                            initialValues={stepOneValues}
                            loading={loading}
                            mode={collectionState.mode.startsWith("create") ? "create" : "update"}
                            onBack={resetToSearch}
                            onProvinceChange={handleProvinceChange}
                            onSubmit={handleStepOneSubmit}
                            onWardChange={handleWardChange}
                            provinceOptions={provinceOptions}
                            submitting={submitting}
                            wardOptions={wardOptions}
                        />
                    ) : null}

                    {collectionState.step === 2 && selectedHousehold ? (
                        <PovertyCollectionStepTwoForm
                            household={selectedHousehold}
                            initialPhotos={stepTwoPhotos}
                            initialValues={stepTwoValues}
                            onBack={(values) => {
                                setStepTwoValues(values);
                                setCollectionState((current) => ({
                                    ...current,
                                    mode: current.mode.startsWith("create") ? "create-step-1" : "update-step-1",
                                    step: 1,
                                }));
                            }}
                            onPhotosChange={setStepTwoPhotos}
                            onSubmit={handleStepTwoSubmit}
                            submitting={submitting}
                        />
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
