"use client";

import { DEFAULT_CANTHO_PROVINCE_CODE } from "@/components/poverty/poverty-location-utils";
import { householdStatusOptions, povertyTypeOptions } from "@/components/poverty/poverty-utils";
import {
    COLLECTION_ACTION_BAR_Z_INDEX,
    shouldLoadCollectionAreaOptions,
    shouldLoadCollectionWardOptions,
    type StepOneFormValues,
} from "@/components/poverty/collection/poverty-collection-utils";
import { ActionButton } from "@/components/controller";
import type { PoorHousehold, PovertyArea, ProvinceOption, WardOption } from "@/types/poverty";
import { Alert, Button, Col, Form, Input, InputNumber, Row, Select, Tag } from "antd";
import { ArrowLeft, Compass, HousePlus, MapPinned, UserRound, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

type Props = {
    areaOptions: PovertyArea[];
    household?: PoorHousehold | null;
    initialValues: StepOneFormValues;
    loading?: boolean;
    mode: "create" | "update";
    onBack: () => void;
    onProvinceChange: (provinceCode?: string) => void;
    onSubmit: (values: StepOneFormValues) => void | Promise<void>;
    onWardChange: (wardCode?: string) => void;
    provinceOptions: ProvinceOption[];
    submitting?: boolean;
    wardOptions: WardOption[];
};

const currentYear = new Date().getFullYear();

const PovertyCoordinatePicker = dynamic(() => import("@/components/poverty/PovertyCoordinatePicker"), {
    ssr: false,
    loading: () => (
        <div className="flex h-[280px] items-center justify-center rounded-[22px] border border-gray-200 bg-gray-50 text-sm text-gray-500">
            Đang tải bản đồ chọn tọa độ...
        </div>
    ),
});

function SummaryChip({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value?: string | number | null;
}) {
    return (
        <div className="rounded-[20px] border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm">
                    {icon}
                </span>
                {label}
            </div>
            <div className="mt-2 text-sm font-semibold text-gray-900">{value || "-"}</div>
        </div>
    );
}

export default function PovertyCollectionStepOneForm({
    areaOptions,
    household,
    initialValues,
    loading = false,
    mode,
    onBack,
    onProvinceChange,
    onSubmit,
    onWardChange,
    provinceOptions,
    submitting = false,
    wardOptions,
}: Props) {
    const [form] = Form.useForm<StepOneFormValues>();
    const selectedProvinceCode = Form.useWatch("provinceCode", form);
    const selectedWardCode = Form.useWatch("wardCode", form);
    const latitude = Form.useWatch("latitude", form);
    const longitude = Form.useWatch("longitude", form);
    const isCreate = mode === "create";
    const lastLoadedProvinceCodeRef = useRef<string>("");
    const lastLoadedWardCodeRef = useRef<string>("");

    useEffect(() => {
        form.setFieldsValue({
            year: currentYear,
            povertyType: "POOR",
            status: "ACTIVE",
            provinceCode: DEFAULT_CANTHO_PROVINCE_CODE,
            ...initialValues,
        });
    }, [form, initialValues]);

    useEffect(() => {
        const provinceCode = String(selectedProvinceCode ?? "").trim();
        if (!shouldLoadCollectionWardOptions({
            previousProvinceCode: lastLoadedProvinceCodeRef.current,
            nextProvinceCode: provinceCode,
        })) return;
        lastLoadedProvinceCodeRef.current = provinceCode;
        onProvinceChange(provinceCode);
    }, [onProvinceChange, selectedProvinceCode]);

    useEffect(() => {
        const wardCode = String(selectedWardCode ?? "").trim();
        if (!wardCode) {
            lastLoadedWardCodeRef.current = "";
            onWardChange(undefined);
            return;
        }
        if (!shouldLoadCollectionAreaOptions({
            previousWardCode: lastLoadedWardCodeRef.current,
            nextWardCode: wardCode,
        })) return;
        lastLoadedWardCodeRef.current = wardCode;
        onWardChange(wardCode);
    }, [onWardChange, selectedWardCode]);

    return (
        <Form
            form={form}
            layout="vertical"
            className="mx-auto flex w-full max-w-xl flex-col gap-3 pb-28"
            disabled={loading || submitting}
            onFinish={onSubmit}
        >
            <section className="rounded-[24px] border border-orange-100 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_38%),linear-gradient(135deg,_#fffaf0_0%,_#ffffff_64%,_#fff7ed_100%)] p-4 shadow-[0_12px_32px_rgba(180,83,9,0.10)] sm:rounded-[28px] sm:p-5">
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-[0_12px_24px_rgba(249,115,22,0.24)]">
                        {isCreate ? <HousePlus size={18} /> : <MapPinned size={18} />}
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-base font-semibold text-gray-900 sm:text-lg">
                            {isCreate ? "Bước 1/2 - Hồ sơ cơ bản" : "Bước 1/2 - Cập nhật vị trí hộ"}
                        </h1>
                        {/* <p className="mt-1 text-sm leading-5 text-gray-600 sm:leading-6">
                            {isCreate
                                ? "Nhập thông tin chính của hộ và đánh dấu chính xác vị trí trên bản đồ."
                                : "Cập nhật lại địa bàn, địa chỉ và tọa độ thực tế trước khi ghi nhận hiện trạng."}
                        </p> */}
                    </div>
                </div>
            </section>

            {!isCreate ? (
                <section className="rounded-[22px] border border-gray-200 bg-white p-3 shadow-sm sm:rounded-[24px] sm:p-4">
                    <div className="mb-3 text-sm font-semibold text-gray-900">Thông tin hộ đang cập nhật</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                        <SummaryChip icon={<UserRound size={14} />} label="Chủ hộ" value={household?.headFullName || household?.code} />
                        <SummaryChip icon={<Users size={14} />} label="Nhân khẩu" value={household?.memberCount ?? 0} />
                        <SummaryChip icon={<MapPinned size={14} />} label="Địa bàn" value={[household?.provinceName, household?.wardName, household?.areaName].filter(Boolean).join(" / ")} />
                        <SummaryChip icon={<Compass size={14} />} label="Tọa độ hiện tại" value={household?.latitude != null && household?.longitude != null ? `${household.latitude}, ${household.longitude}` : "Chưa có"} />
                    </div>
                </section>
            ) : null}

            {isCreate ? (
                <section className="rounded-[22px] border border-gray-200 bg-white p-3 shadow-sm sm:rounded-[24px] sm:p-4">
                    <div className="mb-4 text-sm font-semibold text-gray-900">Thông tin hồ sơ</div>
                    <Row gutter={[12, 12]}>

                        <>
                            <Col span={24}>
                                <Form.Item name="code" label="Mã hộ">
                                    <Input size="large" placeholder="Có thể để trống để sinh tự động" />
                                </Form.Item>
                            </Col>
                            <Col xs={12} span={12}>
                                <Form.Item name="year" label="Năm" rules={[{ required: true, message: "Vui lòng nhập năm" }]}>
                                    <InputNumber className="w-full" size="large" min={1900} max={2200} style={{ width: "100%" }} />
                                </Form.Item>
                            </Col>
                            <Col xs={12} span={12}>
                                <Form.Item name="memberCount" label="Nhân khẩu">
                                    <InputNumber className="w-full" size="large" min={0} style={{ width: "100%" }} />
                                </Form.Item>
                            </Col>
                            <Col xs={12} span={12}>
                                <Form.Item name="povertyType" label="Loại hộ" rules={[{ required: true, message: "Vui lòng chọn loại hộ" }]}>
                                    <Select size="large" options={povertyTypeOptions} />
                                </Form.Item>
                            </Col>
                            <Col xs={12} span={12}>
                                <Form.Item name="status" label="Trạng thái">
                                    <Select size="large" options={householdStatusOptions} />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="headFullName" label="Chủ hộ" rules={[{ required: true, message: "Vui lòng nhập tên chủ hộ" }]}>
                                    <Input size="large" placeholder="Nguyễn Văn A" />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="headCitizenId" label="CCCD chủ hộ">
                                    <Input size="large" placeholder="079123456789" />
                                </Form.Item>
                            </Col>
                        </>

                    </Row>
                </section>
            ) : (
                null
            )}

            <section className="rounded-[22px] border border-gray-200 bg-white p-3 shadow-sm sm:rounded-[24px] sm:p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <MapPinned size={16} className="text-red-600" />
                    Địa bàn và tọa độ
                </div>

                <Row gutter={[12, 12]}>
                    <Col span={24}>
                        <Form.Item name="provinceCode" label="Tỉnh/Thành phố" rules={[{ required: true, message: "Vui lòng chọn tỉnh/thành phố" }]}>
                            <Select
                                size="large"
                                showSearch
                                optionFilterProp="label"
                                options={provinceOptions.map((item) => ({ value: item.code, label: item.fullName || item.name }))}
                                onChange={() => form.setFieldsValue({ wardCode: undefined, areaId: undefined })}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={24}>
                        <Form.Item name="wardCode" label="Xã/Phường" rules={[{ required: true, message: "Vui lòng chọn xã/phường" }]}>
                            <Select
                                size="large"
                                showSearch
                                optionFilterProp="label"
                                options={wardOptions.map((item) => ({ value: item.code, label: item.fullName || item.name }))}
                                onChange={() => form.setFieldsValue({ areaId: undefined })}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={24}>
                        <Form.Item name="areaId" label="Khu vực" rules={[{ required: true, message: "Vui lòng chọn khu vực" }]}>
                            <Select
                                size="large"
                                showSearch
                                optionFilterProp="label"
                                options={areaOptions.map((item) => ({ value: item.id, label: item.name }))}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={24}>
                        <Form.Item name="address" label="Địa chỉ chi tiết">
                            <Input.TextArea rows={3} placeholder="Số nhà, tên đường, mô tả vị trí thực tế..." />
                        </Form.Item>
                    </Col>
                    <Col xs={12} span={12}>
                        <Form.Item name="latitude" label="Vĩ độ">
                            <InputNumber
                                className="w-full"
                                size="large"
                                min={-90}
                                max={90}
                                step={0.000001}
                                stringMode={false}
                                style={{ width: "100%" }}
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={12} span={12}>
                        <Form.Item name="longitude" label="Kinh độ">
                            <InputNumber
                                className="w-full"
                                size="large"
                                min={-180}
                                max={180}
                                step={0.000001}
                                stringMode={false}
                                style={{ width: "100%" }}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <div className="mb-3 mt-1 flex flex-wrap items-center gap-2">
                    <Tag color={(latitude != null && longitude != null) ? "green" : "default"}>
                        {(latitude != null && longitude != null) ? `Đã gắn tọa độ ${latitude}, ${longitude}` : "Chưa gắn tọa độ"}
                    </Tag>
                </div>

                <PovertyCoordinatePicker
                    latitude={latitude}
                    longitude={longitude}
                    onChange={(nextLatitude, nextLongitude) => form.setFieldsValue({
                        latitude: nextLatitude,
                        longitude: nextLongitude,
                    })}
                />
            </section>

            <div
                className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:left-auto sm:right-4 sm:mx-auto sm:w-full sm:max-w-xl sm:rounded-t-[24px]"
                style={{ zIndex: COLLECTION_ACTION_BAR_Z_INDEX }}
            >
                <div className="mx-auto flex w-full max-w-xl gap-3">
                    <Button
                        size="large"
                        className="h-12 flex-1 rounded-2xl border-gray-200"
                        icon={<ArrowLeft size={16} />}
                        onClick={onBack}
                    >
                        Quay lại
                    </Button>
                    <ActionButton
                        className="h-12 flex-1 rounded-2xl"
                        type="save"
                        label="Tiếp theo"
                        htmlType="submit"
                        loading={submitting}
                    />
                </div>
            </div>
        </Form>
    );
}
