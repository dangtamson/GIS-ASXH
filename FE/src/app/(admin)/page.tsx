import type {Metadata} from "next";
import DefaultFeatureRootPage from "@/components/app/DefaultFeatureRootPage";

export const metadata: Metadata = {
  title: "Tổng quan",
};

export default function HomePage() {
  return <DefaultFeatureRootPage />;
}
