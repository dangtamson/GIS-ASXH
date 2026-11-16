"use client";

import L from "leaflet";
import { GeoJSON, MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { FeatureCollection, Geometry } from "geojson";
import { getPublicSocialAssistanceMapMeasureValue } from "@/lib/social-assistance-utils";
import type { SocialAssistanceMapMeasure } from "@/lib/social-assistance-utils";
import { useEffect, useMemo } from "react";
import type { SocialAssistancePublicMapItem } from "@/types/social-assistance";

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
        <MapContainer center={[10.05, 105.75]} zoom={9} zoomControl={false} className={`${heightClassName} w-full bg-slate-100 !overflow-clip [contain:paint]`}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                    const fillColor = !total ? "#dae2fd" : ratio > 0.66 ? "#dc2626" : ratio > 0.33 ? "#3dbeff" : "#c6e7ff";
                    return { color: "#334155", weight: 1.2, opacity: 0.9, fillColor, fillOpacity: total ? 0.78 : 0.35 };
                }}
                onEachFeature={(feature, layer) => {
                    const properties = feature.properties as WardProperties;
                    const provinceCode = String(properties.parent?.adcode ?? "");
                    const wardCode = String(properties.adcode ?? "");
                    const total = wardTotals.get(`${provinceCode}:${wardCode}`);
                    if (total) {
                        const wardName = properties.name ?? `Xã/phường ${wardCode}`;
                        layer.bindPopup(`${wardName}<br>${total.recipientCount.toLocaleString("vi-VN")} lượt hỗ trợ<br>${total.deliveredCashAmount.toLocaleString("vi-VN")} đ tiền mặt<br>${total.deliveredItemCount.toLocaleString("vi-VN")} lượt trao hiện vật`);
                    }
                }}
            />
        </MapContainer>
    );
}