import PovertyAreaManagementPage from "@/components/poverty/PovertyAreaManagementPage";

type Props = {
    params: Promise<{
        wardCode: string;
    }>;
};

export default async function Page({ params }: Props) {
    const { wardCode } = await params;
    return <PovertyAreaManagementPage wardCode={wardCode} />;
}
