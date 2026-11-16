import PublicPortalHomePage from "@/components/social-assistance/PublicPortalHomePage";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    return <PublicPortalHomePage slug={slug} />;
}