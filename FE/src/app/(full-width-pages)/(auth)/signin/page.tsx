import SignInForm from "@/components/auth/SignInForm";
import {Metadata} from "next";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập vào hệ thống",
};

export default function SignIn() {
  return <SignInForm />;
}
