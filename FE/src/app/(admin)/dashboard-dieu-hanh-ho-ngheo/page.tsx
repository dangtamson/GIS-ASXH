import { redirectWithQuery } from "../redirect-with-query";

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
    redirectWithQuery("/ho-ngheo/dashboard-dieu-hanh", await searchParams);
}
