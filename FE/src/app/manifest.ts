import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Thu thap ho ngheo",
        short_name: "Thu thap",
        description: "Mini app thu thap ho ngheo/can ngheo",
        start_url: "/ho-ngheo/thu-thap?source=pwa",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f7efe9",
        theme_color: "#e43d2f",
        icons: [
            {
                src: "/images/logo/logo-icon.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "any",
            },
            {
                src: "/images/logo/logo-icon.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "maskable",
            },
        ],
    };
}
