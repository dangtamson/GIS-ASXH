"use client";

import {api, ApiError} from "@/lib/api";
import {endpoints} from "@/lib/endpoints";
import {App, Checkbox, Form} from "antd";
import {Loader2} from "lucide-react";
import {useCallback, useEffect, useState} from "react";
import {ActionButton, AppInput, TitleSpace} from "@/components/controller";
import {Row, Col} from "antd";
import {useForm} from "antd/es/form/Form";

type ConfigSection = Record<string, unknown>;

type SystemConfigPayload = {
    general: ConfigSection;
    sso: ConfigSection;
    email: ConfigSection;
    securityPolicy: ConfigSection;
};

type SystemConfigResponse = {
    item?: Partial<SystemConfigPayload>;
};

type SecurityPolicy = {
    minPasswordLength: number | undefined;
    maxPasswordLength: number | undefined;
    passwordChangeDays: number | undefined;
    passwordValidityDays: number | undefined;
    passwordImportDefault: string | undefined;
    enableSecurityMode: boolean | undefined;
    allowLoginAttempts: number | undefined;
    warningLoginAttempts: number | undefined;
    lockoutOnViolation: boolean | undefined;
    sessionTimeoutMinutes: number | undefined;
    sessionMaxTimeoutMinutes: number | undefined;
    requireLowercase: boolean | undefined;
    requireUppercase: boolean | undefined;
    requireNumber: boolean | undefined;
    requireSpecialChar: boolean | undefined;
    preventReuseOldPassword: boolean | undefined;
    forceChangePasswordOnFirstLogin: boolean | undefined;
};

const inputClass =
    "w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-red-900/50 dark:bg-gray-900 dark:text-gray-100";

const cardClass =
    "rounded-2xl border border-red-200/70 bg-white/95 p-5 shadow-sm dark:border-red-900/50 dark:bg-gray-900";

const sectionTitleClass = "mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100";

function asSection(value: unknown): ConfigSection {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as ConfigSection;
}

export default function ChinhSachAnNinhPage() {
    const { notification } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const[form] = Form.useForm();

    const [securityPolicy, setSecurityPolicy] = useState<SecurityPolicy>({
        minPasswordLength: 8,
        maxPasswordLength: 15,
        passwordChangeDays: 354,
        passwordValidityDays: 364,
        passwordImportDefault: "",
        enableSecurityMode: false,
        allowLoginAttempts: 10,
        warningLoginAttempts: 3,
        lockoutOnViolation: false,
        sessionTimeoutMinutes: 100,
        sessionMaxTimeoutMinutes: 100,

        // Yếu tố bắt buộc (giờ lưu được)
        requireLowercase: false,
        requireUppercase: false,
        requireNumber: false,
        requireSpecialChar: false,
        preventReuseOldPassword: false,
        forceChangePasswordOnFirstLogin: false,
    });

    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get<SystemConfigResponse>(endpoints.admin.systemConfig);
            const item = data?.item ?? {};
            const policyData = asSection(item.securityPolicy);

            form.setFieldsValue({
                minPasswordLength: Number(policyData.minPasswordLength ?? 8),
                maxPasswordLength: Number(policyData.maxPasswordLength ?? 15),
                passwordChangeDays: Number(policyData.passwordChangeDays ?? 354),
                passwordValidityDays: Number(policyData.passwordValidityDays ?? 364),
                passwordImportDefault: String(policyData.passwordImportDefault ?? ''),
                enableSecurityMode: Boolean(policyData.enableSecurityMode),
                allowLoginAttempts: Number(policyData.allowLoginAttempts ?? 10),
                warningLoginAttempts: Number(policyData.warningLoginAttempts ?? 3),
                lockoutOnViolation: Boolean(policyData.lockoutOnViolation),
                sessionTimeoutMinutes: Number(policyData.sessionTimeoutMinutes ?? 100),
                sessionMaxTimeoutMinutes: Number(policyData.sessionMaxTimeoutMinutes ?? 100),

                requireLowercase: Boolean(policyData.requireLowercase),
                requireUppercase: Boolean(policyData.requireUppercase),
                requireNumber: Boolean(policyData.requireNumber),
                requireSpecialChar: Boolean(policyData.requireSpecialChar),
                preventReuseOldPassword: Boolean(policyData.preventReuseOldPassword),
                forceChangePasswordOnFirstLogin: Boolean(policyData.forceChangePasswordOnFirstLogin),
            })

            // setSecurityPolicy((prev): SecurityPolicy => ({
            //     ...prev,
            //     minPasswordLength: Number(policyData.minPasswordLength ?? 8),
            //     maxPasswordLength: Number(policyData.maxPasswordLength ?? 15),
            //     passwordChangeDays: Number(policyData.passwordChangeDays ?? 354),
            //     passwordValidityDays: Number(policyData.passwordValidityDays ?? 364),
            //     passwordImportDefault: String(policyData.passwordImportDefault ?? ''),
            //     enableSecurityMode: Boolean(policyData.enableSecurityMode),
            //     allowLoginAttempts: Number(policyData.allowLoginAttempts ?? 10),
            //     warningLoginAttempts: Number(policyData.warningLoginAttempts ?? 3),
            //     lockoutOnViolation: Boolean(policyData.lockoutOnViolation),
            //     sessionTimeoutMinutes: Number(policyData.sessionTimeoutMinutes ?? 100),
            //     sessionMaxTimeoutMinutes: Number(policyData.sessionMaxTimeoutMinutes ?? 100),
            //
            //     requireLowercase: Boolean(policyData.requireLowercase),
            //     requireUppercase: Boolean(policyData.requireUppercase),
            //     requireNumber: Boolean(policyData.requireNumber),
            //     requireSpecialChar: Boolean(policyData.requireSpecialChar),
            //     preventReuseOldPassword: Boolean(policyData.preventReuseOldPassword),
            //     forceChangePasswordOnFirstLogin: Boolean(policyData.forceChangePasswordOnFirstLogin),
            // }));
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({ title: "Lỗi", description: err.message });
            } else {
                notification.error({ title: "Lỗi", description: "Không thể tải cấu hình chính sách an ninh." });
            }
        } finally {
            setLoading(false);
        }
    }, [notification]);

    useEffect(() => {
        void loadConfig();
    }, [loadConfig]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put<SystemConfigResponse>(endpoints.admin.systemConfig, {
                securityPolicy: await form.validateFields()
            });

            notification.success({
                title: "Thành công",
                description: "Đã lưu chính sách an ninh.",
            });
        } catch (err) {
            if (err instanceof ApiError) {
                notification.error({ title: "Lỗi", description: err.message });
            } else {
                notification.error({ title: "Lỗi", description: "Không thể lưu chính sách an ninh." });
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <TitleSpace title={'Chính sách an ninh'} actions={<ActionButton
                type="save"
                onClick={handleSave}
                disabled={saving || loading}
                label={'Lưu chính sách'}
                icon={saving ? <Loader2 size={16} className="animate-spin" /> : null}
            />}/>
            <Form layout={'vertical'} form={form}>
                <Row gutter={[16,16]}>
                    <Col md={24} lg={24}>
                        <div className={cardClass}>
                            <h2 className={sectionTitleClass}>Chính sách mật khẩu</h2>

                            <Row gutter={[32,16]} >
                                <Col md={24} lg={16}>
                                    <Row gutter={[16,16]}>
                                        <Col md={24} lg={12}>
                                            <Form.Item
                                                name={'minPasswordLength'}
                                                label={'Độ dài mật khẩu tối thiểu'}
                                                rules={
                                                    [
                                                        {
                                                            required: true,
                                                            message: 'Yêu cầu nhập mật khẩu tối thiểu'
                                                        },
                                                        {
                                                            type: 'number',
                                                            min: 4,
                                                            max: 32,
                                                            message: 'Độ dài phải từ 4 đến 32 ký tự',
                                                        }
                                                    ]
                                                }>
                                                <AppInput
                                                    type={"number"}
                                                    suffix={'Ký tự'}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col md={24} lg={12}>
                                            <Form.Item
                                                label={'Độ dài mật khẩu tối đa'}
                                                name={'maxPasswordLength'}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: 'Yêu cầu nhập mật khẩu tối đa'
                                                    },
                                                    {
                                                        type: 'number',
                                                        min: 4,
                                                        max: 32,
                                                        message: 'Độ dài phải từ 4 đến 32 ký tự',
                                                    }
                                                ]}
                                            >
                                                <AppInput
                                                    type={"number"}
                                                    suffix={'Ký tự'}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col md={24} lg={12}>
                                            <Form.Item
                                                label={'Thời gian yêu cầu thay đổi'}
                                                name={'passwordChangeDays'}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: 'Yêu cầu nhập thời gian thay đổi'
                                                    }
                                                ]}
                                            >
                                                <AppInput
                                                    type={"number"}
                                                    suffix={'Ngày'}
                                                    required
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col md={24} lg={12}>
                                            <Form.Item
                                                label={'Thời gian hiệu lực'}
                                                name={'passwordValidityDays'}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: 'Yêu cầu nhập thời gian hiệu lực'
                                                    }
                                                ]}
                                            >
                                                <AppInput
                                                    type={'number'}
                                                    suffix={'Ngày'}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col md={24} lg={12}>
                                            <Form.Item
                                                label={'Mật khẩu import mặc định'}
                                                name={'passwordImportDefault'}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: 'Yêu cầu nhập mật khẩu import mặc định'
                                                    }
                                                ]}
                                            >
                                                <AppInput
                                                    type={'password'}
                                                    placeholder="Mật khẩu mặc định"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Col>
                                <Col md={24} lg={8}>
                                    <Row gutter={[16,16]}>
                                        <div className="rounded-xl w-full border border-red-200 bg-red-50/60 p-4  ">
                                            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Yếu tố bắt buộc</h3>
                                            <Row gutter={[16,0]}>
                                                <Col span={24}>
                                                    <Form.Item
                                                        name={'requireLowercase'}
                                                        valuePropName={'checked'}
                                                    >
                                                        <Checkbox>Chữ cái thường</Checkbox>

                                                    </Form.Item>
                                                </Col>
                                                <Col span={24}>
                                                    <Form.Item
                                                        name={'requireUppercase'}
                                                        valuePropName={'checked'}
                                                    >
                                                        <Checkbox>Chữ cái hoa</Checkbox>

                                                    </Form.Item>
                                                </Col>
                                                <Col span={24}>
                                                    <Form.Item
                                                        name={'requireNumber'}
                                                        valuePropName={'checked'}
                                                    >
                                                        <Checkbox>Chữ số (0-9)
                                                        </Checkbox>
                                                    </Form.Item>
                                                </Col>
                                                <Col span={24}>
                                                    <Form.Item
                                                        name={'requireSpecialChar'}
                                                        valuePropName={'checked'}
                                                    >
                                                        <Checkbox>
                                                            Ký tự đặc biệt (!@#$%^&*)
                                                        </Checkbox>

                                                    </Form.Item>
                                                </Col>
                                                <Col span={24}>
                                                    <Form.Item
                                                        name={'preventReuseOldPassword'}
                                                        valuePropName={'checked'}
                                                    >
                                                        <Checkbox>Không được trùng với mật khẩu cũ</Checkbox>

                                                    </Form.Item>
                                                </Col>
                                                <Col span={24}>
                                                    <Form.Item
                                                        name={'forceChangePasswordOnFirstLogin'}
                                                        valuePropName={'checked'}
                                                    >
                                                        <Checkbox>Yêu cầu đổi mật khẩu lần đầu</Checkbox>

                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        </div>
                                    </Row>
                                </Col>
                            </Row>
                        </div>
                    </Col>
                    <Col md={24} lg={12}>
                        <div className={cardClass}>
                            <h2 className={sectionTitleClass}>Chính sách an ninh</h2>

                            <Row gutter={[16,16]}>
                                <Col md={24} lg={8}>
                                    <Form.Item
                                        name={'enableSecurityMode'}
                                        valuePropName={'checked'}
                                    >
                                        <Checkbox>Bật chế độ an ninh</Checkbox>
                                    </Form.Item>
                                </Col>
                                <Col md={24} lg={16}>
                                    <Form.Item
                                        name={'lockoutOnViolation'}
                                        valuePropName={'checked'}
                                    >
                                        <Checkbox>Khóa tài khoản khi đăng nhập vi phạm chính sách an ninh</Checkbox>
                                    </Form.Item>
                                </Col>
                                <Col md={24} lg={12}>
                                    <Form.Item
                                        name={'allowLoginAttempts'}
                                        label={'Cho phép đăng nhập sai liên tục'}
                                        rules={[
                                            ({ getFieldValue }) => ({
                                                validator(_, value) {
                                                    const isEnabled = getFieldValue('enableSecurityMode');

                                                    if (!isEnabled) return Promise.resolve(); // không required

                                                    if (!value) {
                                                        return Promise.reject('Vui lòng nhập số lần');
                                                    }

                                                    const num = Number(value);
                                                    if (isNaN(num)) {
                                                        return Promise.reject('Phải là số');
                                                    }

                                                    if (num < 1 || num > 50) {
                                                        return Promise.reject('Phải từ 1 đến 50 lần');
                                                    }

                                                    return Promise.resolve();
                                                },
                                            }),
                                        ]}
                                    >
                                        <AppInput
                                            type={'number'}
                                            suffix={'Lần'}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col md={24} lg={12}>
                                    <Form.Item
                                        name={'warningLoginAttempts'}
                                        label={'Cảnh báo khi đăng nhập sai liên tục'}
                                        rules={[
                                            ({ getFieldValue }) => ({
                                                validator(_, value) {
                                                    const isEnabled = getFieldValue('enableSecurityMode');

                                                    if (!isEnabled) return Promise.resolve(); // không required

                                                    if (!value) {
                                                        return Promise.reject('Vui lòng nhập số lần cảnh báo');
                                                    }

                                                    const num = Number(value);
                                                    if (isNaN(num)) {
                                                        return Promise.reject('Phải là số');
                                                    }

                                                    if (num < 1 || num > 50) {
                                                        return Promise.reject('Phải từ 1 đến 50 lần');
                                                    }

                                                    return Promise.resolve();
                                                },
                                            }),
                                        ]}
                                    >
                                        <AppInput
                                            type={'number'}
                                            suffix={'Lần'}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </div>
                    </Col>
                    <Col md={24} lg={12}>
                        <div className={cardClass}>
                            <h2 className={sectionTitleClass}>Thời gian của phiên đăng nhập</h2>
                            <Row gutter={[16,16]}>
                                <Col md={24} lg={12}>
                                    <Form.Item
                                        name={'sessionTimeoutMinutes'}
                                        label={'Thời gian chờ của phiên kết nối'}
                                        rules={[
                                            {
                                                required: true,
                                                message: ''
                                            },
                                            {
                                                type: 'number',
                                                min: 4,
                                                max: 480,
                                                message: 'Phải từ 4 đến 480 nhút',
                                            },
                                        ]}
                                    >
                                        <AppInput
                                            type={'number'}
                                            suffix={'Phút'}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col md={24} lg={12}>
                                    <Form.Item
                                        name={'sessionMaxTimeoutMinutes'}
                                        label={'Thời gian chờ tối đa của phiên kết nối'}
                                        rules={[
                                            {
                                                required: true,
                                                message: ''
                                            },
                                            {
                                                type: 'number',
                                                min: 4,
                                                max: 480,
                                                message: 'Phải từ 5 đến 480 nhút',
                                            },
                                        ]}
                                    >
                                        <AppInput
                                            type={'number'}
                                            suffix={'Phút'}
                                        />
                                    </Form.Item>
                                </Col>

                            </Row>

                        </div>
                    </Col>
                </Row>
            </Form>
        </div>
    );
}
