import CategoriesTablePage from "@/components/app/CategoriesTablePage";

export default async function CategoryPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    return <CategoriesTablePage slug={slug} />;
}
