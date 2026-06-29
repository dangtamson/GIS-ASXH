"use client";
import React, {useEffect, useState} from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Image from "next/image";
import type { ProfileViewData } from "./ProfileContent";
import {Form, notification, Spin} from "antd";
import {ActionButton, ActionModal, AppInput, PositionSelect} from "@/components/controller";
import {api} from "@/lib/api";

type UserMetaCardProps = {
  profile: ProfileViewData;
  isLoading?: boolean;
  onRefresh: () => void;
};

export default function UserMetaCard({ profile, isLoading = false, onRefresh}: UserMetaCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const [loading, setLoading] = useState<boolean>(false)

  const [form] = Form.useForm()
  const vietnamPhoneRegex = /^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/;

  useEffect(() => {
    if(isOpen)
    {
      form.setFieldsValue(profile);
    }
    else
    {
      form.resetFields();
    }
  }, [isOpen, profile]);

  const handleSave = async () => {
    setLoading(true)
    try {
      const data = await form.validateFields()
      if(profile.uuid) {
        await api.patch(`/accounts/${profile.uuid}`, data)
        notification.success({title: 'Thành công', description: 'Cập nhật thông tin thành công!'})
        onRefresh?.();
        closeModal();
      }
    }
    catch (error: unknown) {
      const apiMessage =
          error instanceof Error
              ? error.message
              : 'Lỗi chỉnh sửa thông tin tài khoản';
      notification.error({title: 'Lỗi', description: apiMessage})
    }
    finally {
      setLoading(false)
    }
  };
  return (
    <Spin spinning={isLoading || loading}>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
            <div className="w-20 h-20 overflow-hidden border border-gray-200 rounded-full dark:border-gray-800">
              <Image
                width={80}
                height={80}
                src="/images/user/owner.jpg"
                alt="user"
              />
            </div>
            <div className="order-3 xl:order-2">
              <h4 className="mb-2 text-lg font-semibold text-center text-gray-800 dark:text-white/90 xl:text-left">
                {profile.fullName}
              </h4>
              <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {profile.roleName}
                </p>
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {profile.workspaceName}
                </p>
              </div>
            </div>
          </div>
          <ActionButton type={'edit'} onClick={openModal}/>
        </div>
      </div>
      <ActionModal open={isOpen} onCancel={() => closeModal()} actions={<>
        <ActionButton type={'close'} onClick={closeModal}/>
        <ActionButton type={'save'} onClick={handleSave}/>
      </>} title={'Cập nhật thông tin người dùng'}>
          <Form form={form} layout={'vertical'}>
            <Form.Item name={'fullName'} label={'Họ và tên'} rules={[
              {required: true, message: 'Yêu cầu nhập họ tên'}
            ]}>
              <AppInput type={'text'}/>
            </Form.Item>
            <Form.Item name={'phone'} label={'Số điện thoại'} rules={[
              {required: true, message: 'Yêu cầu nhập số điện thoại'},
              {pattern: vietnamPhoneRegex, message: 'Số điện thoại không hợp lệ'}

            ]}>
              <AppInput type={'text'} />
            </Form.Item>
            <Form.Item>
              <AppInput type={'email'} title={'Email'} disabled value={profile.email} />
            </Form.Item>
            <Form.Item>
              <PositionSelect value={profile.positionId} title={'Vị trí'} disabled/>
            </Form.Item>
          </Form>

      </ActionModal>
    </Spin>
  );
}
