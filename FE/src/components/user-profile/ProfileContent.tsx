"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import UserInfoCard from "@/components/user-profile/UserInfoCard";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import {Col, Row} from "antd";

export type ProfileViewData = {
    uuid: string;
    fullName: string;
    email: string;
    phone: string;
    roleName: string;
    workspaceName: string;
    positionId: string;
    organization: string
};

const EMPTY_PROFILE: ProfileViewData = {
    uuid: "",
    fullName: "-",
    email: "-",
    phone: "-",
    roleName: "-",
    workspaceName: "-",
    positionId: '',
    organization: '-'
};



function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function mapMeResponseToProfile(data: unknown): ProfileViewData {
    const root = asRecord(data) || {};
    const account = asRecord(root.account) || {};
    const workspaces = Array.isArray(root.workspaces) ? root.workspaces : [];
    const firstWorkspace = asRecord(workspaces[0]) || {};
    const workspace = asRecord(firstWorkspace.workspace) || {};
    const role = asRecord(firstWorkspace.role) || {};
    const membership = asRecord(firstWorkspace.membership) || {};
    const fullName = String(account.fullName || "").trim() || "-";
    const organization = asRecord(firstWorkspace.organization) || {};

    return {
        uuid: String(account.uuid) || '',
        fullName,
        email: String(account.email || "").trim() || "-",
        phone: String(account.phone || "").trim() || "-",
        roleName: String(role.name || role.code || "").trim() || "-",
        workspaceName: String(workspace.name || "").trim() || "-",
        positionId: String(membership.positionId || "").trim() || "",
        organization: String(organization?.name || '').trim() || "-",
    };
}

export default function ProfileContent() {
    const [profile, setProfile] = useState<ProfileViewData>(EMPTY_PROFILE);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get<unknown>(endpoints.auth.me);
            setProfile(mapMeResponseToProfile(response));
        } catch {
            setProfile(EMPTY_PROFILE);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);


    return (
        <div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5  lg:p-6">
                <h3 className="mb-5 text-lg font-semibold lg:mb-7">Thông tin cá nhân</h3>
                <Row gutter={[16,16]}>
                    <Col span={24}>
                        <UserMetaCard profile={profile} isLoading={loading} onRefresh={() => loadProfile()}/>
                    </Col>
                    <Col span={24}>
                        <UserInfoCard profile={profile} isLoading={loading} />
                    </Col>
                </Row>
            </div>
        </div>
    );
}
