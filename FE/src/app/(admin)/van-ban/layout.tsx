import {Metadata} from 'next';

export const metadata: Metadata = {
    title: "Văn bản",
};

export default function VanBanLayout({children}: { children: React.ReactNode }) {
    return children;
}