import PublicMapPage from "@/components/social-assistance/PublicMapPage";
import { App } from "antd";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    return (
        <App>
            <PublicMapPage slug={slug} />
        </App>
    );
}