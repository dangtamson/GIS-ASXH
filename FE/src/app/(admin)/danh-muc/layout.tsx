import {Metadata} from 'next';

export const metadata: Metadata = {
    title: "Danh mục",
};

export default function DanhMucLayout({children}: { children: React.ReactNode }) {
    return children;
}