import PublicProgramsPage from "@/components/social-assistance/PublicProgramsPage";
import { App } from "antd";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    return (
        <App>
            <PublicProgramsPage slug={slug} />
        </App>
    );
}