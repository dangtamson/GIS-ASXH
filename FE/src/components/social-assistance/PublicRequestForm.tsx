"use client";

import PovertyCoordinatePicker from "@/components/poverty/PovertyCoordinatePicker";
import { PublicAssistanceLayout } from "./SocialAssistanceLayout";
import {
    buildPublicSocialAssistanceRequestPayload,
    createSocialAssistanceIdempotencyKey
} from "@/lib/social-assistance-utils";
import { endpoints } from "@/lib/endpoints";
import { publicApiGet, publicApiPost } from "@/lib/public-api";
import type { PublicLocationOption, PublicSocialAssistanceRequestInput, SocialAssistanceNeedCategory, SocialAssistanceRequestSource } from "@/types/social-assistance";
import { Alert, App, Button, Checkbox, Form, Input, Result, Select, Steps, Typography } from "antd";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const NEED_OPTIONS: Array<{ value: SocialAssistanceNeedCategory; label: string }> = [
    { value: "FOOD", label: "Lương thực, thực phẩm" },
    { value: "HEALTHCARE", label: "Y tế, chăm sóc sức khỏe" },
    { value: "HOUSING", label: "Nhà ở, sửa chữa nhà" },
    { value: "EDUCATION", label: "Học tập, giáo dục" },
    { value: "LIVELIHOOD", label: "Sinh kế, việc làm" },
    { value: "CASH", label: "Hỗ trợ tiền mặt" },
    { value: "OTHER", label: "Nhu cầu khác" }
];

type Props = { slug: string; source: Exclude<SocialAssistanceRequestSource, "STAFF"> };
type FormValues = PublicSocialAssistanceRequestInput;
type LocationResponse = { items: PublicLocationOption[] };

export default function PublicRequestForm({ slug, source }: Props) {
    const [form] = Form.useForm<FormValues>();
    const { message } = App.useApp();
    const provinceCode = Form.useWatch("provinceCode", { form, preserve: true });
    const latitude = Form.useWatch("latitude", { form, preserve: true });
    const longitude = Form.useWatch("longitude", { form, preserve: true });
    const [step, setStep] = useState(0);
    const [provinces, setProvinces] = useState<PublicLocationOption[]>([]);
    const [wards, setWards] = useState<PublicLocationOption[]>([]);
    const [loadingProvinces, setLoadingProvinces] = useState(true);
    const [loadingWards, setLoadingWards] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [receiptCode, setReceiptCode] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const idempotencyKey = useRef(createSocialAssistanceIdempotencyKey());
    const failedSubmission = useRef(false);

    useEffect(() => {
        let active = true;
        setLoadingProvinces(true);
        void publicApiGet<LocationResponse>(endpoints.socialAssistance.publicProvinces(slug))
            .then((response) => { if (active) setProvinces(response.items ?? []); })
            .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Không thể tải địa bàn."); })
            .finally(() => { if (active) setLoadingProvinces(false); });
        return () => { active = false; };
    }, [slug]);

    useEffect(() => {
        let active = true;
        form.setFieldValue("wardCode", undefined);
        setWards([]);
        if (!provinceCode) {
            setLoadingWards(false);
            return () => { active = false; };
        }
        setLoadingWards(true);
        void publicApiGet<LocationResponse>(endpoints.socialAssistance.publicWards(slug, provinceCode))
            .then((response) => { if (active) setWards(response.items ?? []); })
            .catch((loadError: unknown) => { if (active) message.error(loadError instanceof Error ? loadError.message : "Không thể tải xã/phường."); })
            .finally(() => { if (active) setLoadingWards(false); });
        return () => { active = false; };
    }, [form, message, provinceCode, slug]);

    const handleValuesChange = () => {
        if (failedSubmission.current) {
            idempotencyKey.current = createSocialAssistanceIdempotencyKey();
            failedSubmission.current = false;
        }
    };

    const continueToLocation = async () => {
        try {
            await form.validateFields(["contactName", "phone", "needCategory", "needDescription", "consent"]);
            setStep(1);
        } catch {
            return;
        }
    };

    const submitRequest = async () => {
        try {
            await form.validateFields(["provinceCode", "wardCode", "address"]);
            const values = form.getFieldsValue(true);
            setSubmitting(true);
            setError(null);
            const response = await publicApiPost<{ receiptCode: string }>(
                endpoints.socialAssistance.publicRequest(slug),
                buildPublicSocialAssistanceRequestPayload(values, source),
                { "Idempotency-Key": idempotencyKey.current }
            );
            setReceiptCode(response.receiptCode);
            form.resetFields();
            failedSubmission.current = false;
        } catch (submitError) {
            failedSubmission.current = true;
            setError(submitError instanceof Error ? submitError.message : "Không gửi được yêu cầu. Vui lòng thử lại.");
        } finally {
            setSubmitting(false);
        }
    };

    if (receiptCode) {
        return (
            <PublicAssistanceLayout slug={slug} title="Yêu cầu hỗ trợ">
                <section className="mx-auto max-w-2xl py-8">
                    <Result
                        status="success"
                        title="Đã tiếp nhận yêu cầu"
                        subTitle="Mã xác nhận hồ sơ của bạn"
                        extra={<Typography.Text copyable className="rounded-md bg-emerald-50 px-4 py-2 font-mono font-semibold text-emerald-800">{receiptCode}</Typography.Text>}
                    />
                </section>
            </PublicAssistanceLayout>
        );
    }

    return (
        <PublicAssistanceLayout slug={slug} title="Đăng ký hồ sơ nhận hỗ trợ an sinh xã hội">
            <div className="mx-auto max-w-3xl">
                <Alert className="mb-5" type="info" showIcon message="Thông tin hồ sơ được bảo mật" description="Thông tin được chuyển đến cán bộ phụ trách để rà soát, không hiển thị công khai." />
                <section className="overflow-hidden rounded-lg border border-[#dae2fd] bg-white shadow-sm">
                    <div className="border-b border-[#e2e7ff] bg-[#f2f3ff] px-4 py-5 sm:px-7">
                        <Steps current={step} responsive size="small" items={[{ title: "Thông tin và nhu cầu" }, { title: "Địa chỉ liên hệ" }]} />
                    </div>
                    <div className="p-4 sm:p-7">
                        {error ? <Alert className="mb-4" type="error" showIcon message={error} /> : null}
                        <Form<FormValues> form={form} layout="vertical" preserve initialValues={{ source }} onValuesChange={handleValuesChange}>
                            <Form.Item name="source" hidden><Input /></Form.Item>
                            {step === 0 ? (
                                <div className="grid gap-x-4 md:grid-cols-2">
                                    <Form.Item label="Họ và tên" name="contactName" rules={[{ required: true, whitespace: true, message: "Vui lòng nhập họ và tên." }]}>
                                        <Input autoComplete="name" maxLength={255} placeholder="Họ và tên người liên hệ" />
                                    </Form.Item>
                                    <Form.Item label="Số điện thoại" name="phone" rules={[
                                        { required: true, message: "Vui lòng nhập số điện thoại." },
                                        { min: 8, max: 20, message: "Số điện thoại chưa hợp lệ." },
                                        { pattern: /^\+?[0-9][0-9\s().-]*$/, message: "Số điện thoại chưa hợp lệ." }
                                    ]}>
                                        <Input autoComplete="tel" inputMode="tel" maxLength={20} placeholder="Số điện thoại liên hệ" />
                                    </Form.Item>
                                    <Form.Item className="md:col-span-2" label="Nhu cầu cần hỗ trợ" name="needCategory" rules={[{ required: true, message: "Vui lòng chọn nhu cầu." }]}>
                                        <Select options={NEED_OPTIONS} placeholder="Chọn nhu cầu" />
                                    </Form.Item>
                                    <Form.Item className="md:col-span-2" label="Mô tả hoàn cảnh và nhu cầu" name="needDescription" rules={[{ required: true, whitespace: true, message: "Vui lòng mô tả nhu cầu." }]}>
                                        <Input.TextArea autoSize={{ minRows: 3, maxRows: 7 }} maxLength={4000} showCount />
                                    </Form.Item>
                                    <Form.Item className="md:col-span-2" name="consent" valuePropName="checked" rules={[{
                                        validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error("Bạn cần đồng ý để gửi thông tin."))
                                    }]}>
                                        <Checkbox>Tôi đồng ý để Mặt trận Tổ quốc tiếp nhận và sử dụng thông tin này nhằm xem xét, phối hợp hỗ trợ.</Checkbox>
                                    </Form.Item>
                                </div>
                            ) : (
                                <div className="grid gap-x-4 md:grid-cols-2">
                                    <Form.Item label="Tỉnh/thành phố" name="provinceCode" rules={[{ required: true, message: "Vui lòng chọn tỉnh/thành phố." }]}>
                                        <Select loading={loadingProvinces} options={provinces.map((item) => ({ value: item.code, label: item.fullName || item.name }))} placeholder="Chọn tỉnh/thành phố" showSearch optionFilterProp="label" />
                                    </Form.Item>
                                    <Form.Item label="Xã/phường" name="wardCode" rules={[{ required: true, message: "Vui lòng chọn xã/phường." }]}>
                                        <Select disabled={!provinceCode} loading={loadingWards} options={wards.map((item) => ({ value: item.code, label: item.fullName || item.name }))} placeholder="Chọn xã/phường" showSearch optionFilterProp="label" />
                                    </Form.Item>
                                    <Form.Item className="md:col-span-2" label="Địa chỉ cụ thể" name="address" rules={[{ required: true, whitespace: true, message: "Vui lòng nhập địa chỉ." }]}>
                                        <Input maxLength={1000} placeholder="Ấp/khu vực, số nhà, đường..." />
                                    </Form.Item>
                                    <Form.Item name="latitude" hidden><Input /></Form.Item>
                                    <Form.Item name="longitude" hidden><Input /></Form.Item>
                                    <div className="md:col-span-2">
                                        <p className="mb-2 text-sm font-medium text-slate-700">Vị trí trên bản đồ (không bắt buộc)</p>
                                        <PovertyCoordinatePicker
                                            latitude={latitude}
                                            longitude={longitude}
                                            onChange={(nextLatitude, nextLongitude) => form.setFieldsValue({ latitude: nextLatitude, longitude: nextLongitude })}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="sticky bottom-0 z-10 mt-5 flex flex-wrap justify-between gap-2 border-t border-[#dae2fd] bg-white py-4 [&_.ant-btn]:min-h-11">
                                {step === 1 ? <Button icon={<ArrowLeft size={15} />} onClick={() => setStep(0)}>Quay lại</Button> : <span />}
                                {step === 0 ? (
                                    <Button type="primary" className="!bg-[#e11d48] hover:!bg-[#be123c]" icon={<ArrowRight size={15} />} onClick={() => void continueToLocation()}>Tiếp tục</Button>
                                ) : (
                                    <Button type="primary" className="!bg-[#e11d48] hover:!bg-[#be123c]" icon={<Send size={15} />} loading={submitting} onClick={() => void submitRequest()}>Xác nhận & gửi yêu cầu</Button>
                                )}
                            </div>
                        </Form>
                    </div>
                </section>
            </div>
        </PublicAssistanceLayout>
    );
}