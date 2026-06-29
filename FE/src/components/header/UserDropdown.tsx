"use client";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Account, clearSession, getAccount, getWorkspaceId, setActiveWorkspaceContext } from "@/lib/auth";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import ChangePasswordPopup from "../user-profile/ChangePasswordPopup";
import WorkspaceSelect from "../controller/input/WorkspaceSelect";
import {
    LockKeyhole,
    CircleUserRound,
    LogOut,
    RefreshCcw,
    Check,
    Building2,
} from "lucide-react";

type UserDropdownProps = {
  triggerClassName?: string;
  labelClassName?: string;
  iconClassName?: string;
};

export default function UserDropdown({
  triggerClassName = "",
  labelClassName = "",
  iconClassName = "",
}: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isWorkspaceSwitcherOpen, setIsWorkspaceSwitcherOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [workspaceSwitchError, setWorkspaceSwitchError] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const router = useRouter();

  useEffect(() => {
    const acc = getAccount();
    setAccount(acc);
    setSelectedWorkspaceId(getWorkspaceId() || acc?.workspaceId || "");
  }, []);

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }

  function closeDropdown() {
    setIsOpen(false);
    setIsWorkspaceSwitcherOpen(false);
    setWorkspaceSwitchError(null);
  }

  function openChangePasswordPopup() {
    setIsChangePasswordOpen(true);
  }

  function closeChangePasswordPopup() {
    setIsChangePasswordOpen(false);
  }

  const handleLogout = () => {
    clearSession();
    setIsOpen(false);
    router.replace("/signin");
  };

  const handleToggleWorkspaceSwitcher = () => {
    setWorkspaceSwitchError(null);
    setSelectedWorkspaceId(getWorkspaceId() || account?.workspaceId || "");
    setIsWorkspaceSwitcherOpen((prev) => !prev);
  };

  const handleWorkspaceChange = async (workspaceId?: string) => {
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    const currentWorkspaceId = String(getWorkspaceId() || account?.workspaceId || "").trim();

    setSelectedWorkspaceId(normalizedWorkspaceId);
    setWorkspaceSwitchError(null);

    if (!normalizedWorkspaceId || normalizedWorkspaceId === currentWorkspaceId) {
      return;
    }

    try {
      setIsSwitchingWorkspace(true);
      const nextAccount = setActiveWorkspaceContext(normalizedWorkspaceId);
      setAccount(nextAccount);
      closeDropdown();
      window.location.reload();
    } catch (error) {
      setWorkspaceSwitchError(error instanceof Error ? error.message : "Không thể chuyển workspace.");
    } finally {
      setIsSwitchingWorkspace(false);
    }
  };

  const workspaceEntries = Array.isArray(account?.workspaces) ? account.workspaces : [];
  const selectedWorkspace = workspaceEntries.find((entry) => {
    const entryWorkspaceId = String(
      entry?.profile?.workspaceId ||
      entry?.membership?.workspaceId ||
      entry?.workspace?.id ||
      entry?.workspace?.uuid ||
      entry?.id ||
      entry?.uuid ||
      ""
    ).trim();

    return entryWorkspaceId && entryWorkspaceId === selectedWorkspaceId;
  });
  const selectedWorkspaceName =
    selectedWorkspace?.workspace?.name ||
    selectedWorkspace?.name ||
    account?.workspace?.name ||
    (selectedWorkspaceId ? `Workspace ${selectedWorkspaceId.slice(0, 8)}` : "Chưa chọn workspace");

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className={`dropdown-toggle flex max-w-[420px] items-center ${triggerClassName}`}
      >

        <span className={`mr-1 block max-w-[50ch] truncate whitespace-nowrap font-medium text-white ${labelClassName}`}>
          {account?.fullName || account?.email || "Người dùng"}
        </span>

        <svg
          className={`text-white transition-transform duration-200 ${iconClassName} ${isOpen ? "rotate-180" : ""
            }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        {/* <div>
          <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">
            {account?.fullName || "Người dùng"}
          </span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
            {account?.email || "-"}
          </span>
        </div> */}

        <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="/profile"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <CircleUserRound className="text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300" size={20} />
              Chỉnh sửa thông tin
            </DropdownItem>
          </li>
          <li>
            <DropdownItem
              tag="button"
              onClick={openChangePasswordPopup}
              onItemClick={closeDropdown}
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <LockKeyhole className="text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300" size={20} />
              Đổi mật khẩu
            </DropdownItem>
          </li>
          {
            account?.isSuperAdmin && <li>
              <div className="px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-white/5">
                <button
                  type="button"
                  onClick={handleToggleWorkspaceSwitcher}
                  className="flex w-full items-center gap-3 font-medium text-gray-700 group text-theme-sm dark:text-gray-400 dark:hover:text-gray-300"
                >
                  <Building2 className="text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300" size={20} />
                  {selectedWorkspaceId ? (
                      <span className="flex-1 text-left"> {selectedWorkspaceName}</span>
                  ) : null}
                </button>

                {isWorkspaceSwitcherOpen ? (
                  <div className="mt-3 space-y-2" onClick={(event) => event.stopPropagation()}>
                    <WorkspaceSelect
                      hideTitle
                      value={selectedWorkspaceId || undefined}
                      onChange={(value) => {
                        void handleWorkspaceChange(value);
                      }}
                      placeholder="Chọn workspace"
                      allowClear={false}
                      disabled={isSwitchingWorkspace}
                      getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
                    />

                    {workspaceSwitchError ? (
                      <p className="text-xs text-red-600">{workspaceSwitchError}</p>
                    ) : null}

                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {isSwitchingWorkspace ? (
                        <>
                          <RefreshCcw size={14} className="animate-spin" />
                          <span>Đang chuyển workspace...</span>
                        </>
                      ) : selectedWorkspaceId ? (
                        <>
                          <Check size={14} />
                          <span>Workspace hiện tại: {selectedWorkspaceName}</span>
                        </>
                      ) : (
                        <span>Chọn workspace để cập nhật ngữ cảnh làm việc.</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              </li>
          }
          {/* <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="/profile"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <svg
                className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10.4858 3.5L13.5182 3.5C13.9233 3.5 14.2518 3.82851 14.2518 4.23377C14.2518 5.9529 16.1129 7.02795 17.602 6.1682C17.9528 5.96567 18.4014 6.08586 18.6039 6.43667L20.1203 9.0631C20.3229 9.41407 20.2027 9.86286 19.8517 10.0655C18.3625 10.9253 18.3625 13.0747 19.8517 13.9345C20.2026 14.1372 20.3229 14.5859 20.1203 14.9369L18.6039 17.5634C18.4013 17.9142 17.9528 18.0344 17.602 17.8318C16.1129 16.9721 14.2518 18.0471 14.2518 19.7663C14.2518 20.1715 13.9233 20.5 13.5182 20.5H10.4858C10.0804 20.5 9.75182 20.1714 9.75182 19.766C9.75182 18.0461 7.88983 16.9717 6.40067 17.8314C6.04945 18.0342 5.60037 17.9139 5.39767 17.5628L3.88167 14.937C3.67903 14.586 3.79928 14.1372 4.15026 13.9346C5.63949 13.0748 5.63946 10.9253 4.15025 10.0655C3.79926 9.86282 3.67901 9.41401 3.88165 9.06303L5.39764 6.43725C5.60034 6.08617 6.04943 5.96581 6.40065 6.16858C7.88982 7.02836 9.75182 5.9539 9.75182 4.23399C9.75182 3.82862 10.0804 3.5 10.4858 3.5ZM13.5182 2L10.4858 2C9.25201 2 8.25182 3.00019 8.25182 4.23399C8.25182 4.79884 7.64013 5.15215 7.15065 4.86955C6.08213 4.25263 4.71559 4.61859 4.0986 5.68725L2.58261 8.31303C1.96575 9.38146 2.33183 10.7477 3.40025 11.3645C3.88948 11.647 3.88947 12.3531 3.40026 12.6355C2.33184 13.2524 1.96578 14.6186 2.58263 15.687L4.09863 18.3128C4.71562 19.3814 6.08215 19.7474 7.15067 19.1305C7.64015 18.8479 8.25182 19.2012 8.25182 19.766C8.25182 20.9998 9.25201 22 10.4858 22H13.5182C14.7519 22 15.7518 20.9998 15.7518 19.7663C15.7518 19.2015 16.3632 18.8487 16.852 19.1309C17.9202 19.7476 19.2862 19.3816 19.9029 18.3134L21.4193 15.6869C22.0361 14.6185 21.6701 13.2523 20.6017 12.6355C20.1125 12.3531 20.1125 11.647 20.6017 11.3645C21.6701 10.7477 22.0362 9.38152 21.4193 8.3131L19.903 5.68667C19.2862 4.61842 17.9202 4.25241 16.852 4.86917C16.3632 5.15138 15.7518 4.79856 15.7518 4.23377C15.7518 3.00024 14.7519 2 13.5182 2ZM9.6659 11.9999C9.6659 10.7103 10.7113 9.66493 12.0009 9.66493C13.2905 9.66493 14.3359 10.7103 14.3359 11.9999C14.3359 13.2895 13.2905 14.3349 12.0009 14.3349C10.7113 14.3349 9.6659 13.2895 9.6659 11.9999ZM12.0009 8.16493C9.88289 8.16493 8.1659 9.88191 8.1659 11.9999C8.1659 14.1179 9.88289 15.8349 12.0009 15.8349C14.1189 15.8349 15.8359 14.1179 15.8359 11.9999C15.8359 9.88191 14.1189 8.16493 12.0009 8.16493Z"
                  fill=""
                />
              </svg>
              Cài đặt tài khoản
            </DropdownItem>
          </li>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="/profile"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <svg
                className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M3.5 12C3.5 7.30558 7.30558 3.5 12 3.5C16.6944 3.5 20.5 7.30558 20.5 12C20.5 16.6944 16.6944 20.5 12 20.5C7.30558 20.5 3.5 16.6944 3.5 12ZM12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM11.0991 7.52507C11.0991 8.02213 11.5021 8.42507 11.9991 8.42507H12.0001C12.4972 8.42507 12.9001 8.02213 12.9001 7.52507C12.9001 7.02802 12.4972 6.62507 12.0001 6.62507H11.9991C11.5021 6.62507 11.0991 7.02802 11.0991 7.52507ZM12.0001 17.3714C11.5859 17.3714 11.2501 17.0356 11.2501 16.6214V10.9449C11.2501 10.5307 11.5859 10.1949 12.0001 10.1949C12.4143 10.1949 12.7501 10.5307 12.7501 10.9449V16.6214C12.7501 17.0356 12.4143 17.3714 12.0001 17.3714Z"
                  fill=""
                />
              </svg>
              Hỗ trợ
            </DropdownItem>
          </li> */}
        </ul>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 mt-3 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
        >
          <LogOut className="text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300" size={20} />
          Đăng xuất
        </button>
      </Dropdown>
      <ChangePasswordPopup
        open={isChangePasswordOpen}
        onClose={closeChangePasswordPopup}
      />
    </div>
  );
}
