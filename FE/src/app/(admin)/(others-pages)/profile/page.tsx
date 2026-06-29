import ProfileContent from "@/components/user-profile/ProfileContent";
import {Metadata} from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Thông tin tài khoản",
};

export default function Profile() {
  return <ProfileContent />;
}
