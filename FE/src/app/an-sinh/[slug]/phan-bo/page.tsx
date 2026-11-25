import PublicAllocationPage from "@/components/social-assistance/PublicAllocationPage";
import { App } from "antd";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    return (
        <App>
            <PublicAllocationPage slug={slug} />
        </App>
    );
}