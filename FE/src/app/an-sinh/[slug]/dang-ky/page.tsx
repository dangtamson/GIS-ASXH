import PublicRequestForm from "@/components/social-assistance/PublicRequestForm";
import { App } from "antd";
import type { SocialAssistanceRequestSource } from "@/types/social-assistance";

const PUBLIC_SOURCES = new Set<SocialAssistanceRequestSource>(["MAP", "WEBSITE", "FACEBOOK", "ZALO_OA", "OTHER"]);

export default async function Page({
    params,
    searchParams
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ source?: string }>;
}) {
    const [{ slug }, query] = await Promise.all([params, searchParams]);
    const requestedSource = query.source?.toUpperCase() as SocialAssistanceRequestSource | undefined;
    const source = requestedSource && PUBLIC_SOURCES.has(requestedSource) && requestedSource !== "STAFF"
        ? requestedSource
        : "WEBSITE";

    return (
        <App>
            <PublicRequestForm slug={slug} source={source} />
        </App>
    );
}