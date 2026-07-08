"use client";

import type { AttachmentType } from "@/components/controller/input/UploadAttachmentField";
import { fileToBase64 } from "@/components/controller/input/UploadAttachmentField";
import type { StepTwoFormValues } from "@/components/poverty/collection/poverty-collection-utils";
import { ActionButton } from "@/components/controller";
import type { PoorHousehold } from "@/types/poverty";
import { Alert, App, Button, DatePicker, Form, Input, Tag } from "antd";
import dayjs from "dayjs";
import { ArrowLeft, Camera, FileImage, ImagePlus, MapPinned, Sparkles, Trash2, UserRound } from "lucide-react";
import Image from "next/image";
import { useMemo, useRef } from "react";

type Props = {
    household: PoorHousehold;
    initialPhotos: AttachmentType[];
    initialValues: StepTwoFormValues;
    onBack: (values: StepTwoFormValues) => void;
    onPhotosChange: (photos: AttachmentType[]) => void;
    onSubmit: (values: StepTwoFormValues, photos: AttachmentType[]) => void | Promise<void>;
    submitting?: boolean;
};

const MAX_PHOTOS = 3;

function InfoBanner({
    colorClassName,
    icon,
    label,
    value,
}: {
    colorClassName: string;
    icon: React.ReactNode;
    label: string;
    value?: string | null;
}) {
    return (
        <div className={`rounded-[22px] border px-4 py-4 ${colorClassName}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm">
                    {icon}
                </span>
                {label}
            </div>
            <div className="mt-3 text-sm leading-6 text-gray-800">{value || "Chưa có nội dung"}</div>
        </div>
    );
}

export default function PovertyCollectionStepTwoForm({
    household,
    initialPhotos,
    initialValues,
    onBack,
    onPhotosChange,
    onSubmit,
    submitting = false,
}: Props) {
    const { notification } = App.useApp();
    const [form] = Form.useForm<StepTwoFormValues>();
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const libraryInputRef = useRef<HTMLInputElement | null>(null);

    const photos = initialPhotos;
    const photoPreviewItems = useMemo(
        () => photos.map((photo) => ({
            id: photo.id,
            name: photo.fileName,
            previewUrl: `data:${photo.mimeType};base64,${photo.fileContentBase64}`,
        })),
        [photos]
    );

    const appendFiles = async (fileList: FileList | null) => {
        const files = Array.from(fileList ?? []).slice(0, MAX_PHOTOS);
        if (files.length === 0) return;

        try {
            const uploaded = await Promise.all(files.map(async (file, index) => ({
                id: `${Date.now()}-${index}-${file.name}`,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type || "image/jpeg",
                fileContentBase64: await fileToBase64(file),
            } satisfies AttachmentType)));

            const nextPhotos = [...photos, ...uploaded].slice(0, MAX_PHOTOS);
            if (nextPhotos.length < photos.length + uploaded.length) {
                notification.warning({ message: `Chỉ giữ tối đa ${MAX_PHOTOS} ảnh cho mỗi lần thu thập` });
            }
            onPhotosChange(nextPhotos);
        } catch (error) {
            notification.error({
                message: "Không thể đọc ảnh",
                description: error instanceof Error ? error.message : "Vui lòng thử lại",
            });
        }
    };

    return (
        <Form
            form={form}
            layout="vertical"
            className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-28"
            initialValues={initialValues}
            onFinish={(values) => onSubmit(values, photos)}
        >
            <section className="rounded-[28px] border border-sky-100 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.20),_transparent_42%),linear-gradient(135deg,_#f8fdff_0%,_#ffffff_64%,_#eff6ff_100%)] p-5 shadow-[0_18px_45px_rgba(14,116,144,0.08)]">
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-[0_14px_28px_rgba(14,165,233,0.24)]">
                        <Sparkles size={20} />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-gray-900">Bước 2/2 - Hoàn cảnh và ảnh thực tế</h1>
                    </div>
                </div>
            </section>

            <section className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap gap-2">
                    <Tag color="blue" className="rounded-full px-3 py-1">{household.code || "Chưa có mã hộ"}</Tag>
                    <Tag color="geekblue" className="rounded-full px-3 py-1">{household.headFullName || "Chưa có chủ hộ"}</Tag>
                    <Tag color="cyan" className="rounded-full px-3 py-1">{[household.wardName, household.areaName].filter(Boolean).join(" / ") || "Chưa có địa bàn"}</Tag>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoBanner
                        colorClassName="border-amber-100 bg-amber-50/80 text-amber-900"
                        icon={<UserRound size={14} className="text-amber-600" />}
                        label="Hoàn cảnh gia đình"
                        value={initialValues.familySituation}
                    />
                    <InfoBanner
                        colorClassName="border-emerald-100 bg-emerald-50/80 text-emerald-900"
                        icon={<MapPinned size={14} className="text-emerald-600" />}
                        label="Hiện trạng đang có"
                        value={initialValues.currentStatus}
                    />
                </div>
            </section>

            <section className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-4 text-sm font-semibold text-gray-900">Thông tin khảo sát</div>
                <Form.Item
                    name="recordedAt"
                    label="Ngày ghi nhận"
                    rules={[{ required: true, message: "Vui lòng chọn ngày ghi nhận" }]}
                    getValueProps={(value) => ({ value: value ? dayjs(value) : undefined })}
                    normalize={(value) => {
                        if (!value) return "";
                        return dayjs.isDayjs(value) ? value.format("YYYY-MM-DD") : String(value);
                    }}
                >
                    <DatePicker className="h-11 w-full" format="DD/MM/YYYY" />
                </Form.Item>

                <Form.Item name="familySituation" label="Hoàn cảnh gia đình">
                    <Input.TextArea
                        rows={4}
                        placeholder="Ví dụ: lao động tự do, nhà thuê, có người bệnh lâu năm..."
                    />
                </Form.Item>

                <Form.Item name="currentStatus" label="Hiện trạng">
                    <Input.TextArea
                        rows={4}
                        placeholder="Ví dụ: nhà ở xuống cấp, vừa mất việc, cần hỗ trợ y tế..."
                    />
                </Form.Item>

                <Form.Item name="note" label="Ghi chú thêm">
                    <Input.TextArea
                        rows={3}
                        placeholder="Thông tin bổ sung khi đi thực tế..."
                    />
                </Form.Item>
            </section>

            <section className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold text-gray-900">Ảnh thực tế</div>
                        <p className="mt-1 text-xs text-gray-500">Ưu tiên chụp trực tiếp bằng camera điện thoại hoặc chọn từ thư viện ảnh.</p>
                    </div>
                    <Tag color="purple">{photos.length}/{MAX_PHOTOS} ảnh</Tag>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 grid-cols-2">
                    <Button
                        size="large"
                        className="h-11 rounded-2xl border-emerald-200 bg-emerald-50 text-emerald-700"
                        icon={<Camera size={16} />}
                        onClick={() => cameraInputRef.current?.click()}
                    >
                        Mở camera
                    </Button>
                    <Button
                        size="large"
                        className="h-11 rounded-2xl border-sky-200 bg-sky-50 text-sky-700"
                        icon={<ImagePlus size={16} />}
                        onClick={() => libraryInputRef.current?.click()}
                    >
                        Chọn từ máy
                    </Button>
                </div>

                <input
                    ref={cameraInputRef}
                    hidden
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={(event) => {
                        void appendFiles(event.target.files);
                        event.target.value = "";
                    }}
                />
                <input
                    ref={libraryInputRef}
                    hidden
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                        void appendFiles(event.target.files);
                        event.target.value = "";
                    }}
                />

                {photoPreviewItems.length === 0 ? (
                    <div className="mt-2">
                        <Alert
                            className="mt-2"
                            type="info"
                            showIcon
                            message="Chưa có ảnh thực tế"
                            description="Ảnh sẽ được lưu trực tiếp vào hồ sơ hộ sau khi hoàn tất bước này."
                        />
                    </div>
                ) : (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        {photoPreviewItems.map((photo) => (
                            <div key={photo.id} className="overflow-hidden rounded-[20px] border border-gray-200 bg-gray-50">
                                <div className="aspect-[4/3] bg-gray-100">
                                    <Image
                                        src={photo.previewUrl}
                                        alt={photo.name}
                                        width={480}
                                        height={360}
                                        unoptimized
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-2 px-3 py-2">
                                    <div className="min-w-0">
                                        <div className="truncate text-xs font-medium text-gray-700">{photo.name}</div>
                                    </div>
                                    <Button
                                        type="text"
                                        danger
                                        icon={<Trash2 size={14} />}
                                        onClick={() => onPhotosChange(photos.filter((item) => item.id !== photo.id))}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:left-auto sm:right-4 sm:mx-auto sm:w-full sm:max-w-xl sm:rounded-t-[24px]">
                <div className="mx-auto flex w-full max-w-xl gap-3">
                    <Button
                        size="large"
                        className="h-12 flex-1 rounded-2xl border-gray-200"
                        icon={<ArrowLeft size={16} />}
                        onClick={() => onBack(form.getFieldsValue())}
                    >
                        Quay lại
                    </Button>
                    <ActionButton
                        className="h-12 flex-1 rounded-2xl"
                        type="save"
                        label="Lưu hoàn tất"
                        htmlType="submit"
                        loading={submitting}
                        icon={<FileImage size={16} />}
                    />
                </div>
            </div>
        </Form>
    );
}
