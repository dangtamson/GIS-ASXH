import PovertyPublicMapPage from "@/components/poverty/PovertyPublicMapPage";

export default async function Page({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    return <PovertyPublicMapPage slug={slug} />;
}
