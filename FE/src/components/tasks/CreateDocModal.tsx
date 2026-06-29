import {Modal, Form, Input, DatePicker, TreeSelect, Row, Col} from "antd";
import {useDonViSelect} from "@/hooks/useOrganization";
import React, {useRef} from "react";
import UploadAttachmentsField from "@/components/controller/input/UploadAttachmentField";
import {ActionButton, AppDatePicker, AppInput, DocumentTypeSelect, FieldSelect} from "@/components/controller";

type Props = {
    open: boolean;
    onCancel: () => void;
    onSubmit: (values: unknown) => void;
    context: string;
};

export default function CreateDocModal({
                                          open,
                                          onCancel,
                                          onSubmit,
                                          context,
                                      }: Props) {

    const [form] = Form.useForm();

    const {dsDonVi, loading:donViLoading, } = useDonViSelect()

    return (
        <Modal
            open={open}
            onCancel={onCancel}
            footer={null}
            width={980}
            title={
                context === "quick"
                    ? "Thêm mới văn bản"
                    : "Thêm văn bản triển khai"
            }
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={(values) => {
                    onSubmit(values);     // ✅ có values chuẩn

                    form.resetFields();   // reset sau khi submit xong
                    onCancel();           // đóng modal
                }}
            >
                <Row gutter={[16,16]}>

                    {/* Số ký hiệu */}
                    <Col xs={24} md={24} lg={12}>
                    <Form.Item
                        name="code"
                        label="Số ký hiệu"
                        rules={[{ required: true, message: "Bắt buộc" }]}
                    >
                        <AppInput type={'text'} placeholder={'Nhập số ký hiệu'}/>
                    </Form.Item>
                    </Col>

                    {/* Trích yếu */}
                    <Col xs={24} md={24} lg={12}>
                    <Form.Item
                        name="abstract"
                        label="Trích yếu"
                        rules={[{ required: true, message: "Bắt buộc" }]}
                    >
                        {/*<Input />*/}
                        <AppInput type={'text'} placeholder={'Nhập trích yếu'}/>

                    </Form.Item>
                    </Col>


                    {/* Quick only */}
                    {context === "quick" && (
                        <>
                        <Col xs={24} md={24} lg={12}>
                            <Form.Item
                                name="type"
                                label="Loại văn bản"
                                rules={[{ required: true }]}
                            >
                                <DocumentTypeSelect hideTitle={true}/>
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={24} lg={12}>
                            <Form.Item name="fieldId" label="Lĩnh vực" rules={[{
                                required: true,
                                message: 'Chọn ngày'
                            }]}>
                                <FieldSelect placeholder={'Chọn lĩnh vực'} hideTitle={true}/>
                            </Form.Item>
                        </Col>
                        </>
                    )}
                    <Col xs={24} md={24} lg={12}>
                    {/* Cơ quan ban hành */}
                    <Form.Item
                        name="issuingOrgId"
                        label="Cơ quan ban hành"
                        rules={[{ required: true, message: 'Chọn cơ quan ban hành' }]}
                    >
                        <TreeSelect
                            placeholder={'Chọn cơ quan ban hành'}
                            treeData={dsDonVi}
                            loading={donViLoading}
                            allowClear
                            style={{ width: "100%", height: "40px" }}
                        />
                    </Form.Item>
                    </Col>

                    <Col xs={24} md={24} lg={12}>
                    {/* Ngày ban hành */}
                    <Form.Item
                        name="issueDate"
                        label="Ngày ban hành"
                        rules={[{ required: true, message: 'Chọn ngày' }]}
                    >
                        <AppDatePicker hideTitle/>
                    </Form.Item>
                    </Col>

                    <Col xs={24} md={24} lg={24}>
                    {/* Nội dung */}
                    {context === "quick" && (
                        <Form.Item
                            name="content"
                            label="Nội dung"
                            className="md:col-span-2"
                        >
                            <AppInput type={'textarea'} placeholder={'Nhập nội dung'}/>
                        </Form.Item>
                    )}
                    </Col>

                    <Col xs={24} md={24} lg={24}>
                    {/* Upload */}
                    <Form.Item
                        name="attachments"
                        label={false}
                        rules={[
                            {
                                validator: (_, value) => {
                                    if (!value || value.length === 0) {
                                        return Promise.reject("Vui lòng tải lên ít nhất 1 file");
                                    }
                                    return Promise.resolve();
                                },
                            },
                        ]}
                    >
                        <UploadAttachmentsField />
                    </Form.Item>
                    </Col>

                </Row>

                {/* Footer buttons */}
                <div className="mt-6 flex justify-center gap-3">

                    <ActionButton type={'close'} onClick={onCancel}/>

                    <ActionButton type={'save'} onClick={() => {
                        form.submit();
                    }}/>
                </div>
            </Form>
        </Modal>
    );
}