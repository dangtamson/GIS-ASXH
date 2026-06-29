import ChangePasswordPage from "./ChangePasswordPage";
import {Metadata} from "next";
import {Suspense} from "react";

export const metadata: Metadata = {
    title: "Thay đổi mật khẩu",
    description: "Thay đổi mật khẩu của bạn",
};

export default function Page() {
    return (
        <Suspense fallback={null}>
            <ChangePasswordPage />
        </Suspense>
    );
}
