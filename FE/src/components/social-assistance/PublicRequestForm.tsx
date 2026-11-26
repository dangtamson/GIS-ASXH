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
import { ArrowLeft, ArrowRight, MapPin, Send, ShieldCheck } from "lucide-react";
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
            <PublicAssistanceLayout slug={slug} title="Yêu cầu hỗ trợ" badge="Tiếp nhận thành công">
                <section className="mx-auto max-w-2xl rounded-2xl border border-emerald-200/80 bg-white p-6 shadow-sm sm:p-10">
                    <Result
                        status="success"
                        title="Đã tiếp nhận yêu cầu"
                        subTitle="Mã xác nhận hồ sơ của bạn đã được ghi nhận và chuyển tới cán bộ phụ trách."
                        extra={
                            <div className="inline-flex flex-col items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50/70 px-6 py-3.5">
                                <span className="text-xs font-medium text-emerald-700">Mã xác nhận hồ sơ</span>
                                <Typography.Text copyable className="font-mono text-lg font-bold text-emerald-900">{receiptCode}</Typography.Text>
                            </div>
                        }
                    />
                </section>
            </PublicAssistanceLayout>
        );
    }

    return (
        <PublicAssistanceLayout
            slug={slug}
            title="Đăng ký hồ sơ nhận hỗ trợ an sinh xã hội"
            badge="Tiếp nhận nhu cầu cộng đồng"
            subtitle="Điền đầy đủ thông tin liên hệ và hoàn cảnh để cán bộ phụ trách rà soát, phối hợp hỗ trợ kịp thời."
        >
            <div className="mx-auto max-w-3xl space-y-5">
                <div className="flex items-start gap-3.5 rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-white to-emerald-50/60 p-4 shadow-xs sm:px-5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#11409a] text-white shadow-sm shadow-blue-900/20">
                        <ShieldCheck size={20} />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">Thông tin hồ sơ được bảo mật tuyệt đối</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:text-sm">Thông tin chỉ được chuyển đến cán bộ phụ trách để rà soát và phối hợp hỗ trợ, không hiển thị công khai trên bản đồ.</p>
                    </div>
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/50">
                    <div className="h-1.5 w-full bg-gradient-to-r from-[#0b2f7a] via-[#1346a8] to-[#0d9488]" aria-hidden="true" />
                    <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 px-5 py-5 sm:px-8">
                        <Steps current={step} responsive size="small" items={[{ title: "Thông tin và nhu cầu" }, { title: "Địa chỉ liên hệ" }]} />
                    </div>
                    <div className="p-5 sm:p-8">
                        {error ? <Alert className="mb-5 !rounded-xl" type="error" showIcon message={error} /> : null}
                        <Form<FormValues> form={form} layout="vertical" preserve initialValues={{ source }} onValuesChange={handleValuesChange}>
                            <Form.Item name="source" hidden><Input /></Form.Item>
                            {step === 0 ? (
                                <div className="grid gap-x-5 md:grid-cols-2">
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
                                        <Input.TextArea autoSize={{ minRows: 3, maxRows: 7 }} maxLength={4000} showCount placeholder="Mô tả cụ thể hoàn cảnh gia đình và nội dung cần hỗ trợ..." />
                                    </Form.Item>
                                    <div className="md:col-span-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 pt-3.5 pb-1">
                                        <Form.Item className="!mb-2" name="consent" valuePropName="checked" rules={[{
                                            validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error("Bạn cần đồng ý để gửi thông tin."))
                                        }]}>
                                            <Checkbox>Tôi đồng ý để Mặt trận Tổ quốc tiếp nhận và sử dụng thông tin này nhằm xem xét, phối hợp hỗ trợ.</Checkbox>
                                        </Form.Item>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid gap-x-5 md:grid-cols-2">
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
                                    <div className="md:col-span-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                                        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                            <MapPin size={16} className="text-[#11409a]" />
                                            Vị trí trên bản đồ (không bắt buộc)
                                        </p>
                                        <PovertyCoordinatePicker
                                            latitude={latitude}
                                            longitude={longitude}
                                            onChange={(nextLatitude, nextLongitude) => form.setFieldsValue({ latitude: nextLatitude, longitude: nextLongitude })}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-200/80 bg-white/95 py-4 backdrop-blur-sm [&_.ant-btn]:min-h-11">
                                {step === 1 ? <Button size="large" icon={<ArrowLeft size={15} />} onClick={() => setStep(0)}>Quay lại</Button> : <span />}
                                {step === 0 ? (
                                    <Button type="primary" size="large" className="!border-0 !bg-gradient-to-r !from-[#0b2f7a] !to-[#1346a8] !text-white hover:!from-[#08245e] hover:!to-[#0f3a8a] !shadow-sm" icon={<ArrowRight size={15} />} onClick={() => void continueToLocation()}>Tiếp tục</Button>
                                ) : (
                                    <Button type="primary" size="large" className="!border-0 !bg-gradient-to-r !from-[#0b2f7a] !to-[#1346a8] !text-white hover:!from-[#08245e] hover:!to-[#0f3a8a] !shadow-sm" icon={<Send size={15} />} loading={submitting} onClick={() => void submitRequest()}>Xác nhận & gửi yêu cầu</Button>
                                )}
                            </div>
                        </Form>
                    </div>
                </section>
            </div>
        </PublicAssistanceLayout>
    );
}