"use client";

import L from "leaflet";
import { GeoJSON, MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { FeatureCollection, Geometry } from "geojson";
import { getPublicSocialAssistanceMapMeasureValue } from "@/lib/social-assistance-utils";
import type { SocialAssistanceMapMeasure } from "@/lib/social-assistance-utils";
import { useEffect, useMemo } from "react";
import type { SocialAssistancePublicMapItem } from "@/types/social-assistance";

const GOOGLE_SUBDOMAINS = ["mt0", "mt1", "mt2", "mt3"];

type WardProperties = { adcode?: number; name?: string; parent?: { adcode?: number } };
type Props = {
    features: FeatureCollection<Geometry, WardProperties>;
    items: SocialAssistancePublicMapItem[];
    measure?: SocialAssistanceMapMeasure;
    heightClassName?: string;
};

function FitResultsBounds({ data }: { data: FeatureCollection<Geometry, WardProperties> }) {
    const map = useMap();
    useEffect(() => {
        const layer = L.geoJSON(data);
        const bounds = layer.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12, animate: false });
    }, [data, map]);
    return null;
}

export default function PublicResultsLeafletMap({
    features,
    items,
    measure = "recipients",
    heightClassName = "h-[62vh] min-h-[420px]"
}: Props) {
    const wardTotals = useMemo(() => {
        const totals = new Map<string, { recipientCount: number; deliveredCashAmount: number; deliveredItemCount: number }>();
        for (const item of items) {
            const key = `${item.provinceCode}:${item.wardCode}`;
            const current = totals.get(key) ?? { recipientCount: 0, deliveredCashAmount: 0, deliveredItemCount: 0 };
            current.recipientCount += item.recipientCount;
            current.deliveredCashAmount += item.deliveredCashAmount;
            current.deliveredItemCount += item.deliveredItemCount;
            totals.set(key, current);
        }
        return totals;
    }, [items]);
    const maxMeasureValue = Math.max(1, ...[...wardTotals.values()].map((value) =>
        getPublicSocialAssistanceMapMeasureValue(value, measure)
    ));

    return (
        <MapContainer center={[10.05, 105.75]} zoom={9} minZoom={3} maxZoom={21} zoomControl={false} attributionControl={false} className={`${heightClassName} w-full bg-slate-100 !overflow-clip [contain:paint]`}>
            <TileLayer
                url="https://{s}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}"
                subdomains={GOOGLE_SUBDOMAINS}
                maxZoom={21}
                attribution="Map data &copy; Google"
            />
            <ZoomControl position="bottomright" />
            <FitResultsBounds data={features} />
            <GeoJSON
                key={JSON.stringify([measure, [...wardTotals]])}
                data={features}
                style={(feature) => {
                    const properties = feature?.properties as WardProperties | undefined;
                    const provinceCode = String(properties?.parent?.adcode ?? "");
                    const wardCode = String(properties?.adcode ?? "");
                    const total = wardTotals.get(`${provinceCode}:${wardCode}`);
                    const ratio = total ? getPublicSocialAssistanceMapMeasureValue(total, measure) / maxMeasureValue : 0;
                    const fillColor = !total ? "#e2e8f0" : ratio > 0.66 ? "#e11d48" : ratio > 0.33 ? "#0284c7" : "#7dd3fc";
                    return { color: "#1e293b", weight: 1.25, opacity: 0.85, fillColor, fillOpacity: total ? 0.72 : 0.3 };
                }}
                onEachFeature={(feature, layer) => {
                    const properties = feature.properties as WardProperties;
                    const provinceCode = String(properties.parent?.adcode ?? "");
                    const wardCode = String(properties.adcode ?? "");
                    const total = wardTotals.get(`${provinceCode}:${wardCode}`);
                    if (total) {
                        const wardName = properties.name ?? `Xã/phường ${wardCode}`;
                        layer.bindPopup(
                            `<div style="min-width:190px;font-family:var(--font-plus-jakarta),sans-serif;padding:2px 0;">` +
                            `<div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e2e8f0;">${wardName}</div>` +
                            `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#475569;margin-bottom:3px;"><span>Lượt hỗ trợ</span><strong style="color:#11409a;">${total.recipientCount.toLocaleString("vi-VN")}</strong></div>` +
                            `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#475569;margin-bottom:3px;"><span>Tiền mặt</span><strong style="color:#059669;">${total.deliveredCashAmount.toLocaleString("vi-VN")} đ</strong></div>` +
                            `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#475569;"><span>Hiện vật</span><strong style="color:#b45309;">${total.deliveredItemCount.toLocaleString("vi-VN")} lượt</strong></div>` +
                            `</div>`
                        );
                    }
                }}
            />
        </MapContainer>
    );
}