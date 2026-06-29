import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export function redirectWithQuery(path: string, searchParams?: SearchParams) {
    const params = new URLSearchParams();

    Object.entries(searchParams ?? {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, item));
            return;
        }

        if (typeof value === "string") {
            params.set(key, value);
        }
    });

    const query = params.toString();
    redirect(query ? `${path}?${query}` : path);
}
