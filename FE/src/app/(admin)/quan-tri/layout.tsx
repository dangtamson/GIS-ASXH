import {Metadata} from 'next';

export const metadata: Metadata = {
    title: "Quản trị hệ thống",
};

export default function QuanTriHeThongLayout({children}: { children: React.ReactNode }) {
    return children;
}