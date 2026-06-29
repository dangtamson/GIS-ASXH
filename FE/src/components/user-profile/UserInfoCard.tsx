"use client";
import React, {useEffect, useState} from "react";
import type { ProfileViewData } from "./ProfileContent";
import {notification, Spin} from "antd";
import {ApiResponse} from "@/types/api";
import {endpoints} from "@/lib/endpoints";
import {api} from "@/lib/api";

type UserInfoCardProps = {
  profile: ProfileViewData;
  isLoading?: boolean;
};
export default function UserInfoCard({ profile, isLoading = false }: UserInfoCardProps) {
  const [loading, setLoading] = useState<boolean>(false)
  const [chucVu, setChucVu] = useState<{name: string, uuid: string}>()

  const layChucVu = async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<{name: string, uuid: string}>>(`${endpoints.admin.categoryItems}/${profile.positionId}`)
      setChucVu(res.item)
    }
    catch (e) {
      notification.error({title: 'Lỗi', description: 'Lỗi lấy chức vụ'})
    }
    finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if(profile.positionId)
      void layChucVu()
  }, [profile])

  return (
      <Spin spinning={isLoading || loading}>
        <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
                Thông tin chung
              </h4>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                    Họ và tên
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {profile.fullName}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                    Địa chỉ mail
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {profile.email}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                    Số điện thoại
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {profile.phone}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                    Chức năng
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {profile.roleName}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                    Chức vụ
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {chucVu?.name}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                    Cơ quan
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {profile.organization}
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </Spin>
  );
}
