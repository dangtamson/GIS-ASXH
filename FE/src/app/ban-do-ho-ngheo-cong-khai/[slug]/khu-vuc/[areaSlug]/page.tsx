import PovertyPublicAreaDetailPage from "@/components/poverty/PovertyPublicAreaDetailPage";

export default async function Page({
    params,
}: {
    params: Promise<{ slug: string; areaSlug: string }>;
}) {
    const { slug, areaSlug } = await params;

    return <PovertyPublicAreaDetailPage slug={slug} areaSlug={areaSlug} />;
}
