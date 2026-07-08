import PovertyPublicHouseholdDetailPage from "@/components/poverty/PovertyPublicHouseholdDetailPage";

export default async function Page({
    params,
}: {
    params: Promise<{ slug: string; householdId: string }>;
}) {
    const { slug, householdId } = await params;

    return <PovertyPublicHouseholdDetailPage slug={slug} householdId={householdId} />;
}
