import {Metadata} from 'next';

export const metadata: Metadata = {
    title: "Báo cáo",
};

export default function BaoCaoLayout({children}: { children: React.ReactNode }) {
    return children;
}