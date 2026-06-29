import {Metadata} from 'next';

export const metadata: Metadata = {
    title: "Đánh giá",
};

export default function DanhGiaLayout({children}: { children: React.ReactNode }) {
    return children;
}