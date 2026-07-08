"use client";

import L from "leaflet";
import "leaflet.markercluster";
import { Button, Empty } from "antd";
import type { FeatureCollection, Geometry } from "geojson";
import { ChevronDown, Layers3, MapPinned } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GeoJSON, MapContainer, Pane, TileLayer, ZoomControl, useMap } from "react-leaflet";

import {
    buildPublicClusterIconHtml,
    buildPublicMarkerIconHtml,
    getPublicClusterBadgeSize,
} from "@/components/poverty/poverty-public-map-marker-utils";
import {
    getPublicBaseLayerLabel,
    getPublicClusterInteractionOptions,
    getPublicMapFitBoundsOptions,
    getPublicMapHeightClass,
} from "@/components/poverty/poverty-public-map-utils";
import { getValidGeoPosition, normalizePovertyType, povertyTypeLabel } from "@/components/poverty/poverty-utils";
import type { PublicPovertyMarker } from "@/types/poverty";

type PovertyPublicMapStageProps = {
    markers: PublicPovertyMarker[];
    loading?: boolean;
    title?: string;
    heightClassName?: string;
    onSelectHousehold?: (marker: PublicPovertyMarker) => void;
    boundaryGeoJson?: FeatureCollection<Geometry, { name?: string | null; level?: string | null; mergedFrom?: string | null; province?: string | null }> | null;
};

type GoogleLayerKey = "streets" | "satellite" | "hybrid";

const DEFAULT_CENTER: [number, number] = [10.0452, 105.7469];
const DEFAULT_ZOOM = 12;
const GOOGLE_SUBDOMAINS = ["mt0", "mt1", "mt2", "mt3"];
const GOOGLE_LAYERS: Record<GoogleLayerKey, { label: string; layer: string }> = {
    streets: { label: "Đường phố", layer: "m" },
    satellite: { label: "Vệ tinh", layer: "s" },
    hybrid: { label: "Hybrid", layer: "y" },
};

const createPublicLeafletMarkerIcon = (povertyType?: string | null) =>
    L.divIcon({
        className: "poverty-map-marker-container",
        html: buildPublicMarkerIconHtml(povertyType),
        iconSize: [42, 42],
        iconAnchor: [21, 42],
        popupAnchor: [0, -40],
    });

const createPublicLeafletClusterIcon = (cluster: L.MarkerCluster) => {
    const count = cluster.getChildCount();
    const size = getPublicClusterBadgeSize(count);

    return L.divIcon({
        className: "poverty-map-cluster",
        html: buildPublicClusterIconHtml(count),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

const schedulePopupRootUnmounts = (roots: Root[]) => {
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            roots.forEach((root) => root.unmount());
        });
    });
};

function PublicMarkerPopupContent({
    marker,
    onSelectHousehold,
}: {
    marker: PublicPovertyMarker;
    onSelectHousehold?: (marker: PublicPovertyMarker) => void;
}) {
    const povertyType = normalizePovertyType(marker.povertyType);

    return (
        <div className="w-[min(72vw,280px)] max-w-[280px] space-y-3 text-[13px] text-slate-600 sm:w-[260px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-semibold text-slate-900">{marker.headFullName || marker.code || "Hộ gia đình"}</span>
                </div>
                <span className={["inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold flex-shrink-0", povertyType === "POOR" ? "bg-rose-50 text-rose-600" : povertyType === "NEAR_POOR" ? "bg-amber-50 text-amber-600" : "bg-sky-50 text-sky-600"].join(" ")}>{povertyTypeLabel(marker.povertyType)}</span>
            </div>
            <div className="grid gap-2 rounded-2xl bg-slate-50 px-3 py-3">
                <div className="grid gap-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mã hộ</span>
                    <span className="break-words font-medium text-slate-700">{marker.code || "-"}</span>
                </div>
                <div className="grid gap-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Địa chỉ</span>
                    <span className="line-clamp-2 font-medium leading-5 text-slate-700">{marker.address || "Chưa cập nhật"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-0.5 rounded-xl bg-white/80 px-2.5 py-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Khu vực</span>
                        <span className="line-clamp-2 text-xs font-medium leading-5 text-slate-700">{marker.areaName || "Chưa cập nhật"}</span>
                    </div>
                    <div className="grid gap-0.5 rounded-xl bg-white/80 px-2.5 py-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Xã/Phường</span>
                        <span className="line-clamp-2 text-xs font-medium leading-5 text-slate-700">{marker.wardName || "Chưa cập nhật"}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-xl border border-slate-200 px-2 py-2">
                    <div className="font-semibold text-slate-900">{Number(marker.memberCount ?? 0).toLocaleString("vi-VN")}</div>
                    <div className="mt-1 text-[11px] text-slate-400">Thành viên</div>
                </div>
                <div className="rounded-xl border border-slate-200 px-2 py-2">
                    <div className="font-semibold text-slate-900">{Number(marker.fieldPhotoCount ?? 0).toLocaleString("vi-VN")}</div>
                    <div className="mt-1 text-[11px] text-slate-400">Ảnh</div>
                </div>
            </div>

            {onSelectHousehold ? (
                <Button type="primary" size="small" block onClick={() => onSelectHousehold(marker)}>
                    Xem chi tiết hộ
                </Button>
            ) : null}
        </div>
    );
}

function PublicMapFitBoundsControl({
    markers,
    boundaryGeoJson,
}: {
    markers: PublicPovertyMarker[];
    boundaryGeoJson?: FeatureCollection<Geometry> | null;
}) {
    const map = useMap();

    useEffect(() => {
        if (boundaryGeoJson?.features?.length) {
            const boundaryLayer = L.geoJSON(boundaryGeoJson);
            const bounds = boundaryLayer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, getPublicMapFitBoundsOptions());
                return;
            }
        }

        const positions = markers
            .map((marker) => getValidGeoPosition(marker.latitude, marker.longitude))
            .filter((position): position is { latitude: number; longitude: number } => Boolean(position))
            .map((position) => [position.latitude, position.longitude] as [number, number]);

        if (positions.length === 0) {
            map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
            return;
        }

        map.fitBounds(positions, getPublicMapFitBoundsOptions());
    }, [boundaryGeoJson, map, markers]);

    return null;
}

function PublicWardBoundaryLayer({
    boundaryGeoJson,
}: {
    boundaryGeoJson?: FeatureCollection<Geometry, { name?: string | null; level?: string | null; mergedFrom?: string | null }> | null;
}) {
    if (!boundaryGeoJson?.features?.length) return null;

    return (
        <Pane name="public-ward-boundary-pane" style={{ zIndex: 405 }}>
            <GeoJSON
                data={boundaryGeoJson}
                pane="public-ward-boundary-pane"
                style={() => ({
                    color: "#1d4ed8",
                    weight: 2,
                    opacity: 0.92,
                    fillColor: "#60a5fa",
                    fillOpacity: 0.08,
                    dashArray: "",
                })}
            />
        </Pane>
    );
}

function PublicClusteredMarkers({
    markers,
    onSelectHousehold,
    onPopupVisibilityChange,
}: {
    markers: PublicPovertyMarker[];
    onSelectHousehold?: (marker: PublicPovertyMarker) => void;
    onPopupVisibilityChange?: (open: boolean) => void;
}) {
    const map = useMap();

    useEffect(() => {
        const clusterGroup = L.markerClusterGroup({
            ...getPublicClusterInteractionOptions(),
            iconCreateFunction: createPublicLeafletClusterIcon,
        });
        const popupRoots: Root[] = [];

        markers.forEach((marker) => {
            const position = getValidGeoPosition(marker.latitude, marker.longitude);
            if (!position) return;

            const leafletMarker = L.marker([position.latitude, position.longitude], {
                icon: createPublicLeafletMarkerIcon(marker.povertyType),
                keyboard: true,
                title: marker.headFullName || marker.code || "Hộ gia đình",
            });
            const popupContainer = document.createElement("div");
            const popupRoot = createRoot(popupContainer);

            popupRoot.render(
                <PublicMarkerPopupContent
                    marker={marker}
                    onSelectHousehold={onSelectHousehold}
                />
            );
            popupRoots.push(popupRoot);

            leafletMarker.bindPopup(popupContainer, {
                minWidth: 0,
                maxWidth: 320,
                className: "public-poverty-map-popup",
                keepInView: true,
                autoPanPaddingTopLeft: [20, 112],
                autoPanPaddingBottomRight: [20, 124],
            });
            leafletMarker.off("click");
            leafletMarker.on("click", () => {
                map.stop();
                if (!leafletMarker.isPopupOpen()) {
                    leafletMarker.openPopup();
                }
            });
            leafletMarker.on("popupopen", () => onPopupVisibilityChange?.(true));
            leafletMarker.on("popupclose", () => onPopupVisibilityChange?.(false));
            clusterGroup.addLayer(leafletMarker);
        });

        clusterGroup.on("clusterclick", (event) => {
            event.layer.spiderfy();
        });

        map.addLayer(clusterGroup);

        return () => {
            map.removeLayer(clusterGroup);
            schedulePopupRootUnmounts(popupRoots);
        };
    }, [map, markers, onPopupVisibilityChange, onSelectHousehold]);

    return null;
}

export default function PovertyPublicMapStage({
    markers,
    loading,
    title = "Bản đồ số hộ nghèo",
    heightClassName = "h-[420px] md:h-[620px]",
    onSelectHousehold,
    boundaryGeoJson,
}: PovertyPublicMapStageProps) {
    const [baseLayer, setBaseLayer] = useState<GoogleLayerKey>("streets");
    const [layerMenuOpen, setLayerMenuOpen] = useState(false);
    const [popupOpen, setPopupOpen] = useState(false);
    const layerMenuRef = useRef<HTMLDivElement | null>(null);
    const validMarkers = useMemo(
        () => markers.filter((marker) => getValidGeoPosition(marker.latitude, marker.longitude)),
        [markers]
    );

    useEffect(() => {
        if (!layerMenuOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!layerMenuRef.current?.contains(event.target as Node)) {
                setLayerMenuOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [layerMenuOpen]);

    return (
        <div className={`public-map-shell relative overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.08)] ${heightClassName || getPublicMapHeightClass("ward")}`}>
            <div
                className={[
                    "pointer-events-none absolute inset-x-4 top-4 z-[520] flex flex-wrap items-start justify-between gap-3 transition duration-200",
                    popupOpen ? "max-md:pointer-events-none max-md:opacity-0 max-md:-translate-y-2" : "",
                ].join(" ").trim()}
            >
                <div className="pointer-events-auto inline-flex max-w-[calc(100%-88px)] items-center gap-2 rounded-full border border-white/80 bg-white/92 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur md:max-w-none md:px-4">
                    <MapPinned size={16} className="text-sky-600" />
                    <span className="truncate">{title}</span>
                </div>

                <div ref={layerMenuRef} className="pointer-events-auto relative">
                    <button
                        type="button"
                        onClick={() => setLayerMenuOpen((current) => !current)}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-white/80 bg-white/92 px-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-sky-200 hover:text-sky-700 md:px-4"
                        aria-expanded={layerMenuOpen}
                        aria-label="Chọn lớp nền bản đồ"
                    >
                        <Layers3 size={15} className="text-sky-600" />
                        <span className="sm:hidden">{getPublicBaseLayerLabel(baseLayer, "compact")}</span>
                        <span className="hidden sm:inline">Lớp nền:</span>
                        <span className="hidden sm:inline">{getPublicBaseLayerLabel(baseLayer)}</span>
                        <ChevronDown
                            size={15}
                            className={`text-slate-400 transition-transform ${layerMenuOpen ? "rotate-180" : ""}`}
                        />
                    </button>

                    {layerMenuOpen ? (
                        <div className="absolute right-0 top-[calc(100%+10px)] w-[min(120px,calc(100vw-48px))] max-w-[calc(100vw-48px)] rounded-[1.25rem] border border-white/80 bg-white/96 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur sm:w-[120px] sm:max-w-[120px]">
                            <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Lớp nền
                            </div>
                            <div className="space-y-1">
                                {Object.entries(GOOGLE_LAYERS).map(([key, item]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                            setBaseLayer(key as GoogleLayerKey);
                                            setLayerMenuOpen(false);
                                        }}
                                        className={[
                                            "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition",
                                            key === baseLayer
                                                ? "bg-sky-50 text-sky-700"
                                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                                        ].join(" ")}
                                    >
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {validMarkers.length === 0 && !boundaryGeoJson?.features?.length && !loading ? (
                <div className="absolute inset-0 z-[510] flex items-center justify-center bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(239,246,255,0.98))]">
                    <Empty description="Chưa có hộ đủ tọa độ để hiển thị trên bản đồ" />
                </div>
            ) : null}

            {loading ? (
                <div className="absolute inset-0 z-[510] bg-white/35 backdrop-blur-[2px]" />
            ) : null}

            <MapContainer
                center={DEFAULT_CENTER}
                zoom={DEFAULT_ZOOM}
                minZoom={3}
                maxZoom={21}
                zoomControl={false}
                scrollWheelZoom
                className="h-full w-full"
                attributionControl={false}
            >
                <ZoomControl position="bottomright" />
                <TileLayer
                    key={baseLayer}
                    url={`https://{s}.google.com/vt/lyrs=${GOOGLE_LAYERS[baseLayer].layer}&hl=vi&x={x}&y={y}&z={z}`}
                    subdomains={GOOGLE_SUBDOMAINS}
                    maxZoom={21}
                    attribution="Map data &copy; Google"
                />
                <PublicMapFitBoundsControl markers={validMarkers} boundaryGeoJson={boundaryGeoJson} />
                <PublicWardBoundaryLayer boundaryGeoJson={boundaryGeoJson} />
                <PublicClusteredMarkers
                    markers={validMarkers}
                    onSelectHousehold={onSelectHousehold}
                    onPopupVisibilityChange={setPopupOpen}
                />
            </MapContainer>

            <div
                className={[
                    "pointer-events-none absolute bottom-4 left-4 z-[520] flex flex-wrap gap-2 transition duration-200",
                    popupOpen ? "max-md:pointer-events-none max-md:opacity-0 max-md:translate-y-2" : "",
                ].join(" ").trim()}
            >
                <div className="pointer-events-auto rounded-2xl border border-white/80 bg-white/92 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur">
                    {boundaryGeoJson?.features?.length ? (
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full border border-blue-600 bg-blue-100" />
                            Ranh giới xã/phường
                        </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                        Hộ nghèo
                    </div>
                    <div className={`${boundaryGeoJson?.features?.length ? "mt-1" : ""} flex items-center gap-2`}>
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                        Hộ cận nghèo
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                        Hộ thường
                    </div>
                </div>
            </div>
        </div>
    );
}
