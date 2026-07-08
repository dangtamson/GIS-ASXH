"use client";

import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { PovertyArea, PovertyMarker, ProvinceOption, WardOption } from "@/types/poverty";
import { getValidGeoPosition, povertyTypeOptions } from "@/components/poverty/poverty-utils";
import { DEFAULT_CANTHO_PROVINCE_CODE, getInitialProvinceCode } from "@/components/poverty/poverty-location-utils";
import { ActionButton, TitleSpace } from "@/components/controller";
import { usePermission } from "@/hooks/usePermission";
import { App, Button, Col, Form, InputNumber, Row, Select } from "antd";
import { ChevronDown, ChevronUp, SlidersHorizontal, Smartphone } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const PovertyLeafletMap = dynamic(() => import("@/components/poverty/PovertyLeafletMap"), {
    ssr: false,
    loading: () => (
        <div className="flex h-[460px] items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500 md:h-[680px]">
            Đang tải bản đồ...
        </div>
    ),
});

function buildQuery(values: Record<string, unknown>): string {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
        const text = String(value ?? "").trim();
        if (text) params.set(key, text);
    });
    return params.toString();
}

const currentYear = new Date().getFullYear();

export default function PovertyMapPage() {
    const { notification } = App.useApp();
    const router = useRouter();
    const searchParams = useSearchParams();
    const focusedHouseholdId = searchParams.get("householdId");
    const [form] = Form.useForm();
    const [filters, setFilters] = useState<Record<string, unknown>>({ year: currentYear, provinceCode: DEFAULT_CANTHO_PROVINCE_CODE });
    const [markers, setMarkers] = useState<PovertyMarker[]>([]);
    const [loading, setLoading] = useState(false);
    const [filtersCollapsed, setFiltersCollapsed] = useState(true);
    const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
    const [wardOptions, setWardOptions] = useState<WardOption[]>([]);
    const [areaOptions, setAreaOptions] = useState<PovertyArea[]>([]);
    const { can: canCreateHousehold } = usePermission("poverty.household.create");
    const { can: canCreateHouseholdOnMap } = usePermission("poverty.map.create_household");
    const { can: canUpdateMarkerPosition } = usePermission("poverty.map.update_position");
    const { can: canViewHouseholdDetail } = usePermission("poverty.household.detail.view");
    const { can: canUpdateHousehold } = usePermission("poverty.household.update");
    const canOpenCollection = canCreateHousehold || canUpdateHousehold;
    const activeFilterCount = useMemo(
        () => Object.values(filters).filter((value) => String(value ?? "").trim()).length,
        [filters]
    );
    const selectedWardCode = Form.useWatch("wardCode", form);
    const selectedProvinceCode = Form.useWatch("provinceCode", form);

    const selectedWardName = useMemo(
        () => wardOptions.find((item) => item.code === filters.wardCode)?.fullName || wardOptions.find((item) => item.code === filters.wardCode)?.name,
        [filters.wardCode, wardOptions]
    );

    const provinceSelectOptions = useMemo(
        () => provinceOptions.map((item) => ({ value: item.code, label: item.fullName || item.name })),
        [provinceOptions]
    );
    const wardSelectOptions = useMemo(
        () => wardOptions.map((item) => ({ value: item.code, label: item.fullName || item.name })),
        [wardOptions]
    );
    const areaSelectOptions = useMemo(
        () => areaOptions.map((item) => ({ value: item.id, label: item.name })),
        [areaOptions]
    );

    const loadProvinces = useCallback(async () => {
        const data = await api.get<{ items?: ProvinceOption[] }>(endpoints.poverty.locationProvinces);
        setProvinceOptions(data.items ?? []);
    }, []);

    const loadWards = useCallback(async (provinceCode: string) => {
        const data = await api.get<{ items?: WardOption[] }>(endpoints.poverty.locationWards(provinceCode));
        setWardOptions(data.items ?? []);
    }, []);

    const loadAreas = useCallback(async (wardCode: string) => {
        const data = await api.get<{ items?: PovertyArea[] }>(endpoints.poverty.locationAreas(wardCode));
        setAreaOptions(data.items ?? []);
    }, []);

    const loadMarkers = useCallback(async () => {
        setLoading(true);
        try {
            const query = buildQuery(filters);
            const data = await api.get<{ items?: PovertyMarker[] }>(`${endpoints.poverty.gisMarkers}?${query}`);
            const items = data.items ?? [];
            setMarkers(items);

            if (focusedHouseholdId) {
                const focusedMarker = items.find((item) => item.id === focusedHouseholdId);
                if (!focusedMarker) {
                    notification.warning({ message: "Không tìm thấy hộ trên bản đồ" });
                } else if (!getValidGeoPosition(focusedMarker.latitude, focusedMarker.longitude)) {
                    notification.warning({ message: "Hộ này chưa cập nhật tọa độ" });
                }
            }
        } catch (error) {
            notification.error({
                message: "Không thể tải dữ liệu bản đồ",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
        } finally {
            setLoading(false);
        }
    }, [filters, focusedHouseholdId, notification]);

    useEffect(() => {
        void loadProvinces();
    }, [loadProvinces]);

    useEffect(() => {
        loadMarkers();
    }, [loadMarkers]);

    useEffect(() => {
        const provinceCode = getInitialProvinceCode(selectedProvinceCode);
        if (!provinceCode) return;
        void loadWards(provinceCode);
    }, [loadWards, selectedProvinceCode]);

    useEffect(() => {
        if (!selectedWardCode) {
            setAreaOptions([]);
            return;
        }
        void loadAreas(String(selectedWardCode));
    }, [loadAreas, selectedWardCode]);

    const updateMarkerPosition = useCallback(async (marker: PovertyMarker, latitude: number, longitude: number) => {
        const previousMarkers = markers;
        setMarkers((current) => current.map((item) => item.id === marker.id ? { ...item, latitude, longitude } : item));
        try {
            await api.patch(endpoints.poverty.gisMarkerPosition(marker.id), {
                latitude,
                longitude,
                changeNote: "Cập nhật tọa độ từ bản đồ",
            });
            notification.success({ message: "Đã cập nhật tọa độ hộ" });
        } catch (error) {
            setMarkers(previousMarkers);
            notification.error({
                message: "Không thể cập nhật tọa độ",
                description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
            });
            throw error;
        }
    }, [markers, notification]);

    const openCollectionApp = useCallback(() => {
        if (focusedHouseholdId) {
            router.push(`/ho-ngheo/thu-thap?householdId=${focusedHouseholdId}`);
            return;
        }
        router.push("/ho-ngheo/thu-thap");
    }, [focusedHouseholdId, router]);

    return (
        <div className="min-w-0 space-y-4">
            <TitleSpace
                title="Bản đồ số hộ nghèo"
            />
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
                            <SlidersHorizontal size={16} />
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-gray-800">Bộ lọc bản đồ</h3>
                            <p className="mt-0.5 text-xs text-gray-500">
                                {activeFilterCount > 0 ? `${activeFilterCount} điều kiện đang áp dụng` : "Lọc dữ liệu hiển thị trên bản đồ"}
                            </p>
                        </div>
                    </div>
                    <Button
                        icon={filtersCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        onClick={() => setFiltersCollapsed((value) => !value)}
                    />
                </div>

                {!filtersCollapsed ? (
                    <div className="p-4">
                        <Form form={form} layout="vertical" initialValues={{ year: currentYear, provinceCode: DEFAULT_CANTHO_PROVINCE_CODE }} onFinish={(values) => setFilters(values)}>
                            <Row gutter={[16, 0]}>

                                <Col xs={12} md={2} xl={2}><Form.Item name="year" label="Năm"><InputNumber className="w-full" min={1900} max={2200} /></Form.Item></Col>
                                <Col xs={24} md={4} xl={4}>
                                    <Form.Item name="provinceCode" label="Tỉnh/Thành phố">
                                        <Select
                                            showSearch
                                            optionFilterProp="label"
                                            options={provinceSelectOptions}
                                            onChange={() => form.setFieldsValue({ wardCode: undefined, areaId: undefined })}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={3} xl={3}>
                                    <Form.Item name="wardCode" label="Xã/Phường">
                                        <Select
                                            allowClear
                                            showSearch
                                            optionFilterProp="label"
                                            options={wardSelectOptions}
                                            onChange={() => form.setFieldsValue({ areaId: undefined })}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={3} xl={3}><Form.Item name="areaId" label="Khu vực"><Select allowClear showSearch optionFilterProp="label" options={areaSelectOptions} /></Form.Item></Col>

                                <Col xs={12} md={2} xl={2}><Form.Item name="povertyType" label="Loại hộ"><Select allowClear options={povertyTypeOptions} /></Form.Item></Col>
                            </Row>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto mt-2">
                                <ActionButton type="search" htmlType="submit" loading={loading} />
                                <ActionButton type="refresh" variant="outlined" onClick={() => { form.resetFields(); form.setFieldsValue({ year: currentYear, provinceCode: DEFAULT_CANTHO_PROVINCE_CODE }); setFilters({ year: currentYear, provinceCode: DEFAULT_CANTHO_PROVINCE_CODE }); }} />
                            </div>
                        </Form>
                    </div>
                ) : null}
            </div>

            <PovertyLeafletMap
                markers={markers}
                loading={loading}
                focusedMarkerId={focusedHouseholdId}
                highlightedWardName={selectedWardName}
                canCreateHousehold={canCreateHousehold}
                canCreateHouseholdOnMap={canCreateHouseholdOnMap}
                onRefresh={loadMarkers}
                onMarkerPositionChange={updateMarkerPosition}
                canEditMarkerPosition={canUpdateMarkerPosition}
                canViewAssessmentTimeline={canViewHouseholdDetail}
                canUpdateHousehold={canUpdateHousehold}
                canViewHouseholdDetail={canViewHouseholdDetail}
            />
        </div>
    );
}
