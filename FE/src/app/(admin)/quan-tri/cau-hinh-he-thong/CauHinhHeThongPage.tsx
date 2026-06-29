"use client";

import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import {App, Checkbox, Col, Form, Row} from "antd";
import {Loader2} from "lucide-react";
import {useCallback, useEffect, useState} from "react";
import {ActionButton, AppInput, AppSelect, AvatarUploadField, TitleSpace} from "@/components/controller";
import moment from 'moment-timezone';
import {extractList} from "@/lib/data-utils";
import {isSafeFeaturePath} from "@/lib/default-feature";

type ConfigSection = Record<string, unknown>;

type SystemConfigPayload = {
    general: ConfigSection;
    sso: ConfigSection;
    email: ConfigSection;
    smartReader: ConfigSection;
    openaiConfig: ConfigSection;
};

type SystemConfigResponse = {
    item?: Partial<SystemConfigPayload>;
};

type ConfigurableFeature = {
    uuid: string;
    name: string;
    path: string;
    enabled: boolean;
    orderIndex?: number;
};

const tabClass =
    "rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-red-50 hover:text-red-900 dark:hover:bg-red-900/20";

const cardClass =
    "rounded-2xl border border-red-200/70 bg-white/95 p-3 shadow-sm";

function asSection(value: unknown): ConfigSection {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as ConfigSection;
}
const now = Date.now();
const timeZoneOptions = moment.tz.names()
    .map(tz => {
        const offset = moment.tz(now, tz).format('Z'); // +07:00

        return {
            value: tz,
            label: `(UTC${offset}) ${tz}`,
            offset, // để sort
        };
    })
    .sort((a, b) => {
        // sort theo UTC trước
        if (a.offset !== b.offset) return a.offset.localeCompare(b.offset);
        // cùng UTC thì sort A-Z
        return a.value.localeCompare(b.value);
    })
    .map(({ value, label }) => ({ value, label }));

export default function CauHinhHeThongPage() {
    const { notification } = App.useApp();
    const [activeTab, setActiveTab] = useState<"general" | "sso" | "email" | "provider">("general");
    const [activeProviderTab, setActiveProviderTab] = useState<"smart-reader" | "openai">("smart-reader");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);
    const [featureOptions, setFeatureOptions] = useState<Array<{ value: string; label: string }>>([]);

    const [generalForm] = Form.useForm()
    const [ssoForm] = Form.useForm()
    const [emailForm] = Form.useForm()
    const [readerForm] = Form.useForm()
    const [openaiForm] = Form.useForm()

    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            const [data, featureData] = await Promise.all([
                api.get<SystemConfigResponse>(endpoints.admin.systemConfig),
                api.get<unknown>(endpoints.admin.features),
            ]);
            const item = data?.item ?? {};
            const features = extractList<ConfigurableFeature>(featureData)
                .filter((feature) =>
                    feature.enabled
                    && Boolean(feature.uuid)
                    && isSafeFeaturePath(feature.path)
                )
                .sort((first, second) => (first.orderIndex ?? 0) - (second.orderIndex ?? 0));

            setFeatureOptions(features.map((feature) => ({
                value: feature.uuid,
                label: `${feature.name} (${feature.path})`,
            })));

            const generalData = asSection(item.general);
            const ssoData = asSection(item.sso);
            const emailData = asSection(item.email);
            const readerData = asSection(item.smartReader)
            const openaiData = asSection(item.openaiConfig)


            generalForm.setFieldsValue(({
                systemName: String(generalData.systemName ?? ""),
                shortName: String(generalData.shortName ?? ""),
                supportEmail: String(generalData.supportEmail ?? ""),
                timezone: String(generalData.timezone ?? "Asia/Ho_Chi_Minh"),
                locale: String(generalData.locale ?? "vi-VN"),
                website: String(generalData.website ?? ""),
                hotline: String(generalData.hotline ?? ""),
                address: String(generalData.address ?? ""),
                defaultFeatureId: typeof generalData.defaultFeatureId === "string"
                    ? generalData.defaultFeatureId
                    : undefined,
                favicon: generalData.favicon || [],
            }))

            ssoForm.setFieldsValue(({
                enabled: Boolean(ssoData.enabled),
                loginUrl: String(ssoData.loginUrl ?? ""),
                loginParams: String(ssoData.loginParams ?? ""),
                redirectUri: String(ssoData.redirectUri ?? ""),
                accessTokenUrl: String(ssoData.accessTokenUrl ?? ""),
                accessTokenParams: String(ssoData.accessTokenParams ?? ""),
                userInfoUrl: String(ssoData.userInfoUrl ?? ""),
                emailExtension: String(ssoData.emailExtension ?? ""),
            }))

            emailForm.setFieldsValue(({
                senderName: String(emailData.senderName ?? ""),
                senderEmail: String(emailData.senderEmail ?? ""),
                replyTo: String(emailData.replyTo ?? ""),
                smtpHost: String(emailData.smtpHost ?? ""),
                smtpPort: String(emailData.smtpPort ?? "587"),
                username: String(emailData.username ?? ""),
                password: String(emailData.password ?? ""),
                useTls: Boolean(emailData.useTls ?? true),
                useSsl: Boolean(emailData.useSsl ?? false),
                allowInvalidCert: Boolean(emailData.allowInvalidCert ?? false),
            }))

            readerForm.setFieldsValue(readerData)
            openaiForm.setFieldsValue({
                enabled: Boolean(openaiData.enabled ?? false),
                apiKey: String(openaiData.apiKey ?? ""),
                model: String(openaiData.model ?? "gpt-4.1-mini"),
                baseUrl: String(openaiData.baseUrl ?? "https://api.openai.com/v1"),
                organizationId: String(openaiData.organizationId ?? ""),
                projectId: String(openaiData.projectId ?? ""),
            })

        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({ title: "Lỗi", description: err.message });
            } else {
                notification.error({ title: "Lỗi", description: "Không thể tải cấu hình hệ thống." });
            }
        } finally {
            setLoading(false);
        }
    }, [emailForm, generalForm, notification, openaiForm, readerForm, ssoForm]);

    useEffect(() => {
        void loadConfig();
    }, [loadConfig]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const defaultRedirectUri = `${window.location.origin}/auth/sign-in-sso`;

        if(!ssoForm.getFieldValue('redirectUri')?.trim())
            ssoForm.setFieldValue('redirectUri', defaultRedirectUri)

    }, [ssoForm]);

    const handleSave = async () => {
        setSaving(true);

        try {
            const [general, sso, email, smartReader, openaiConfig] = await Promise.all([
                generalForm.validateFields(),
                ssoForm.validateFields(),
                emailForm.validateFields(),
                readerForm.validateFields(),
                openaiForm.validateFields()
            ]);
            await api.put<SystemConfigResponse>(endpoints.admin.systemConfig, {
                general: {
                    ...general,
                    favicon: undefined,
                },
                sso,
                email,
                smartReader,
                openaiConfig,
                favicon: general.favicon
            });

            notification.success({
                title: "Thành công",
                description: "Đã lưu cấu hình hệ thống.",
            });
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({ title: "Lỗi", description: err.message });
            } else {
                console.error(err);
                notification.error({ title: "Lỗi", description: "Không thể lưu cấu hình hệ thống." });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleTestEmail = async () => {
        const email = await emailForm.validateFields()

        const recipient = email.testRecipient?.trim() || email.senderEmail?.trim();
        if (!recipient) {
            notification.warning({
                title: "Thiếu thông tin",
                description: "Vui lòng nhập Email nhận test hoặc Email người gửi.",
            });
            return;
        }

        setTestingEmail(true);
        try {
            await api.post(endpoints.admin.systemConfigTestEmail, {
                recipient,
                subject: email.testSubject?.trim() || undefined,
                body: email.testBody?.trim() || undefined,
                email: await emailForm.validateFields(),
            });

            notification.success({
                title: "Thành công",
                description: `Đã gửi email test tới ${recipient}.`,
            });
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({ title: "Lỗi", description: err.message });
            } else {
                notification.error({ title: "Lỗi", description: "Không thể gửi email test." });
            }
        } finally {
            setTestingEmail(false);
        }
    };

    return (
        <div className="space-y-5">
            <TitleSpace title={'Cấu hình hệ thống'} actions={<ActionButton
                type="save"
                label={'Lưu cấu hình'}
                icon={saving ? <Loader2 size={16} className="animate-spin" /> : null}
                onClick={handleSave}
                disabled={saving || loading}
            />}/>

            <div className={cardClass}>
                <div className="mb-4 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab("general")}
                        className={`${tabClass} ${activeTab === "general" ? "border-red-500 bg-red-50 text-amber-900" : "border-red-200 text-gray-700 "}`}
                    >
                        Cấu hình chung
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("sso")}
                        className={`${tabClass} ${activeTab === "sso" ? "border-red-500 bg-red-50 text-amber-900" : "border-red-200 text-gray-700 "}`}
                    >
                        SSO
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("email")}
                        className={`${tabClass} ${activeTab === "email" ? "border-red-500 bg-red-50 text-amber-900" : "border-red-200 text-gray-700 "}`}
                    >
                        Email
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("provider")}
                        className={`${tabClass} ${activeTab === "provider" ? "border-red-500 bg-red-50 text-amber-900" : "border-red-200 text-gray-700 "}`}
                    >
                        Provider
                    </button>
                </div>

                {(
                    <Form form={generalForm} layout={'vertical'} hidden={activeTab !== "general"}>
                    <Row gutter={[16,16]}>
                        <Col md={24} lg={12} className={'w-full'}>
                            <Form.Item label={'Tên hệ thống'} name={'systemName'} rules={[
                                {
                                    required: true,
                                    message: 'Vui lòng nhập tên hệ thống'
                                }
                            ]}>
                                <AppInput />
                            </Form.Item>
                        </Col>
                        <Col md={24} lg={12} className={'w-full'}>
                            <Form.Item label={'Tên viết tắt'} name={'shortName'}>
                                <AppInput />
                            </Form.Item>
                        </Col>
                        <Col md={24} lg={12} className={'w-full'}>
                            <Form.Item label={'Email hỗ trợ'} name={'supportEmail'}>
                                <AppInput />
                            </Form.Item>
                        </Col>
                        <Col md={24} lg={12} className={'w-full'}>
                            <Form.Item label={'Múi giờ'} name={'timezone'}>
                                <AppSelect hideTitle options={timeZoneOptions}/>
                            </Form.Item>
                        </Col>
                        <Col md={24} lg={12} className={'w-full'}>
                            <Form.Item label={'Ngôn ngữ mặc định'} name={'locale'}>
                                <AppSelect hideTitle options={[{
                                    value: 'vi-VN',
                                    label: 'Tiếng Việt'
                                }]}/>
                            </Form.Item>
                        </Col>
                        <Col md={24} lg={12} className={'w-full'}>
                            <Form.Item
                                label={'Trang mặc định'}
                                name={'defaultFeatureId'}
                                extra={'Trang được mở khi người dùng truy cập đường dẫn /.'}
                            >
                                <AppSelect
                                    hideTitle
                                    allowClear
                                    options={featureOptions}
                                    placeholder={'Giữ trang tổng quan hiện tại'}
                                />
                            </Form.Item>
                        </Col>
                        <Col md={24} lg={12} className={'w-full'}>
                            <Form.Item label={'Website'} name={'website'}>
                                <AppInput />
                            </Form.Item>
                        </Col>
                        <Col md={24} lg={12} className={'w-full'}>
                            <Form.Item label={'Đường dây nóng'} name={'hotline'}>
                                <AppInput />
                            </Form.Item>
                        </Col>
                        <Col md={24} lg={12} className={'w-full'}>
                            <Form.Item label='Điạ chỉ' name={'address'}>
                                <AppInput />
                            </Form.Item>
                        </Col>
                        <Col md={24} lg={24} className={'w-full'}>
                            <Form.Item label='Favicon' name={'favicon'}>
                                <AvatarUploadField size={120}/>
                            </Form.Item>
                        </Col>
                    </Row>
                    </Form>
                )}

                {(
                    <Form form={ssoForm} layout={'vertical'} hidden={activeTab !== "sso"}>
                        <Row gutter={[16, 16]}>
                        <Col span={24}>
                            <Form.Item name={'enabled'} valuePropName={'checked'}>
                                <Checkbox>Bật đăng nhập SSO</Checkbox>
                            </Form.Item>
                        </Col>
                            <Col span={24}>
                                <div className="rounded-xl border border-red-200/70 bg-red-50/40 p-4">
                                    <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Cấu hình URL login</h3>
                                    <Row gutter={[16,16]}>
                                        <Col md={24} lg={12}>
                                            <Form.Item label={'URL Đăng nhập'} name={'loginUrl'}>
                                                <AppInput  placeholder={'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize'}/>
                                            </Form.Item>
                                        </Col>
                                        <Col md={24} lg={12}>
                                            <Form.Item label={'Redirect URI'} name={'redirectUri'}>
                                                <AppInput placeholder="https://your-domain/auth/sign-in-sso"/>
                                            </Form.Item>
                                        </Col>
                                        <Col md={24} lg={24}>
                                            <Form.Item label={'Tham số'} name={'loginParams'}>
                                                <AppInput
                                                    type={'textarea'}
                                                    placeholder="client_id=...&response_type=code&scope=openid%20profile%20email&redirect_uri={{redirect_uri}}&state={{state}}"
                                                />
                                            </Form.Item>

                                        </Col>
                                    </Row>
                                </div>
                            </Col>
                            <Col span={24}>
                                <div className="rounded-xl border border-red-200/70 bg-red-50/40 p-4">
                                    <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Cấu hình URL access token</h3>
                                    <Row gutter={[16,16]}>
                                        <Col md={24} lg={12}>
                                            <Form.Item name={'accessTokenUrl'} label={'URL Access token'}>
                                                <AppInput
                                                    placeholder="https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col md={24} lg={24}>
                                            <Form.Item name={'accessTokenParams'} label={'Tham số Access token'}>
                                                <AppInput
                                                    placeholder="client_id=...&client_secret=...&grant_type=authorization_code&code={{code}}&redirect_uri={{redirect_uri}}"
                                                    type={'textarea'}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col md={24} lg={12}>
                                            <Form.Item label={'URL thông tin người dùng'} name={'userInfoUrl'}>
                                                <AppInput
                                                    placeholder="https://graph.microsoft.com/oidc/userinfo"
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col md={24} lg={12}>
                                            <Form.Item label={'Email extension'} name={'emailExtension'}>
                                                <AppInput
                                                    placeholder="@company.com"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>
                            </Col>
                        </Row>
                    </Form>
                )}

                {(
                    <Form form={emailForm} layout={'vertical'} hidden={activeTab !== "email"}>
                        <Row gutter={[16,16]}>
                            <Col span={24}>
                                <Row gutter={[16,16]}>
                                    <Col md={24} lg={12}>
                                        <Form.Item label={'Tên người gửi'} name={'senderName'}>
                                            <AppInput />
                                        </Form.Item>

                                    </Col>
                                    <Col md={24} lg={12}>
                                        <Form.Item label={'Email người gửi'} name={'senderEmail'}>
                                            <AppInput/>
                                        </Form.Item>
                                    </Col>
                                    <Col md={24} lg={12}>
                                        <Form.Item label={'Reply-To'} name={'replyTo'}>
                                            <AppInput/>
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Col>
                            <Col span={24}>
                                <Row gutter={[16,16]}>

                                    <Col md={24} lg={12}>
                                        <Form.Item label={'SMTP Host'} name={'smtpHost'}>
                                            <AppInput/>
                                        </Form.Item>
                                    </Col>
                                    <Col md={24} lg={12}>
                                        <Form.Item label={'SMTP Port'} name={'smtpPort'}>
                                            <AppInput/>
                                        </Form.Item>
                                    </Col>
                                    <Col md={24} lg={12}>
                                        <Form.Item label={'Tên đăng nhập SMTP'} name={'username'}>
                                            <AppInput/>
                                        </Form.Item>
                                    </Col>
                                    <Col md={24} lg={12}>
                                        <Form.Item label={'Mật khẩu SMTP'} name={'password'}>
                                            <AppInput type={'password'}/>
                                        </Form.Item>

                                    </Col>
                                    <Col md={24} lg={12}>
                                        <Form.Item  name={'useSsl'} valuePropName={'checked'}>
                                            <Checkbox>Dùng SSL (thường cổng 465)</Checkbox>
                                        </Form.Item>
                                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <Form.Item name={'allowInvalidCert'} valuePropName={'checked'}>
                                                <Checkbox>Cho phép chứng chỉ không hợp lệ (dev only)</Checkbox>
                                            </Form.Item>
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 md:col-span-2">
                                            <Form.Item name={'useTls'} valuePropName={'checked'}>
                                                <Checkbox>Bật TLS/SSL</Checkbox>
                                            </Form.Item>
                                        </label>
                                    </Col>
                                </Row>
                            </Col>
                            <Col span={24}>
                                <div className="w-full rounded-xl border border-red-200/70 bg-red-50/50 p-3 ">
                                    <h3 className="mb-3 text-sm font-semibold text-amber-900 ">Gửi email test</h3>
                                    <Row gutter={[24,24]}>
                                        <Col span={24}>
                                            <Form.Item label={'Email nhận test'} name={'testRecipient'}>
                                                <AppInput
                                                    placeholder="Nếu bỏ trống sẽ sử dụng email người gửi"
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={24}>
                                            <Form.Item label={'Tiêu đề'} name={'testSubject'}>
                                                <AppInput />
                                            </Form.Item>


                                        </Col>
                                        <Col span={24}>
                                            <Form.Item label={'Nội dung'} name={'testBody'}>
                                                <AppInput/>
                                            </Form.Item>
                                        </Col>
                                        <Col span={24}>
                                            <ActionButton type={'send'} onClick={handleTestEmail} label={'Gửi thư test'} disabled={testingEmail || loading}/>
                                        </Col>

                                    </Row>
                                </div>
                            </Col>
                        </Row>
                    </Form>
                )}
                {
                    <Form form={readerForm} hidden={activeTab !== "provider" || activeProviderTab !== "smart-reader"} layout={'vertical'}>
                        <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-red-200/70 bg-red-50/40 p-2">
                            <button
                                type="button"
                                onClick={() => setActiveProviderTab("smart-reader")}
                                className={`${tabClass} ${activeProviderTab === "smart-reader" ? "border-red-500 bg-white text-amber-900 shadow-sm" : "border-transparent bg-transparent text-gray-700"}`}
                            >
                                Smart Reader
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveProviderTab("openai")}
                                className={`${tabClass} ${activeProviderTab === "openai" ? "border-red-500 bg-white text-amber-900 shadow-sm" : "border-transparent bg-transparent text-gray-700"}`}
                            >
                                OpenAI
                            </button>
                        </div>
                        <Form.Item name={'featureFlagSentryDevelopment'} valuePropName={'checked'}>
                            <Checkbox>Bật Sentry (Development)</Checkbox>
                        </Form.Item>
                        <Row gutter={[16,16]}>

                            <Col md={24} lg={12}>
                                <Form.Item rules={[
                                    // {
                                    //     required: true,
                                    //     message: 'Yêu cầu nhập Upload URL'
                                    // }
                                ]} name={'smartReaderUploadUrl'} label={'Upload URL'}>
                                    <AppInput />
                                </Form.Item>
                            </Col>
                            <Col md={24} lg={12}>
                                <Form.Item rules={[
                                    // {
                                    //     required: true,
                                    //     message: 'Yêu càu nhập Upload scan table URL'
                                    // }
                                ]} name={'smartReaderUploadScanTableUrl'} label={'Upload scan table URL'}>
                                    <AppInput />
                                </Form.Item>
                            </Col>
                            <Col md={24} lg={12}>
                                <Form.Item rules={[
                                    // {
                                    //     required: true,
                                    //     message: 'Yêu cầu nhập Summary URL V2'
                                    // }
                                ]} name={'smartReaderSummaryUrlV2'} label={'Summary URL V2'}>
                                    <AppInput />
                                </Form.Item>
                            </Col>
                            <Col md={24} lg={12}>
                                <Form.Item rules={[
                                    // {
                                    //     required: true,
                                    //     message: 'Yêu cầu nhập Access token'
                                    // }
                                ]} name={'smartReaderAccessToken'} label={'Access Token'}>
                                    <AppInput type={'password'}/>
                                </Form.Item>
                            </Col>
                            <Col md={24} lg={12}>
                                <Form.Item rules={[
                                    // {
                                    //     required: true,
                                    //     message: 'Yêu cầu nhập Token ID'
                                    // }
                                ]} name={'smartReaderTokenId'} label={'Token ID'}>
                                    <AppInput />
                                </Form.Item>
                            </Col>
                            <Col md={24} lg={12}>
                                <Form.Item rules={[
                                    // {
                                    //     required: true,
                                    //     message: 'Yêu cầu nhập Token key'
                                    // }
                                ]} name={'smartReaderTokenKey'} label={'Token Key'}>
                                    <AppInput type={'password'}/>
                                </Form.Item>
                            </Col>
                            <Col md={24} lg={12}>
                                <Form.Item rules={[
                                    // {
                                    //     required: true,
                                    //     message: 'Yêu cầu nhập Client Session'
                                    // }
                                ]} name={'smartReaderClientSession'} label={'Client Session'}>
                                    <AppInput />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                }
                {
                    <Form form={openaiForm} hidden={activeTab !== "provider" || activeProviderTab !== "openai"} layout={'vertical'}>
                        <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-red-200/70 bg-red-50/40 p-2">
                            <button
                                type="button"
                                onClick={() => setActiveProviderTab("smart-reader")}
                                className={`${tabClass} ${activeProviderTab === "smart-reader" ? "border-red-500 bg-white text-amber-900 shadow-sm" : "border-transparent bg-transparent text-gray-700"}`}
                            >
                                Smart Reader
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveProviderTab("openai")}
                                className={`${tabClass} ${activeProviderTab === "openai" ? "border-red-500 bg-white text-amber-900 shadow-sm" : "border-transparent bg-transparent text-gray-700"}`}
                            >
                                OpenAI
                            </button>
                        </div>
                        <Form.Item name={'enabled'} valuePropName={'checked'}>
                            <Checkbox>Bật OpenAI</Checkbox>
                        </Form.Item>
                        <Row gutter={[16,16]}>
                            <Col md={24} lg={12}>
                                <Form.Item name={'apiKey'} label={'API Key'}>
                                    <AppInput type={'password'} placeholder={'sk-...'} />
                                </Form.Item>
                            </Col>
                            <Col md={24} lg={12}>
                                <Form.Item name={'model'} label={'Model'}>
                                    <AppInput placeholder={'gpt-4.1-mini'} />
                                </Form.Item>
                            </Col>
                            <Col md={24} lg={12}>
                                <Form.Item name={'baseUrl'} label={'Base URL'}>
                                    <AppInput placeholder={'https://api.openai.com/v1'} />
                                </Form.Item>
                            </Col>
                            <Col md={24} lg={12}>
                                <Form.Item name={'organizationId'} label={'Organization ID'}>
                                    <AppInput placeholder={'org_...'} />
                                </Form.Item>
                            </Col>
                            <Col md={24} lg={12}>
                                <Form.Item name={'projectId'} label={'Project ID'}>
                                    <AppInput placeholder={'proj_...'} />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                }
            </div>
        </div>
    );
}
