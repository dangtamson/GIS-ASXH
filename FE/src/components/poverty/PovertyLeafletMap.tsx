"use client";

import canThoBoundaryGeoJson from "@/components/poverty/command-dashboard/data/cantho.json";
import { getHouseholdContextCardTheme, getHouseholdSummaryCardTheme, resolveLatestHouseholdContextHistory } from "@/components/poverty/poverty-context-utils";
import { api, ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { HouseholdDetailResponse, HouseholdFieldPhoto, PovertyArea, PovertyMarker, ProvinceOption, WardOption } from "@/types/poverty";
import { formatNumber, getValidGeoPosition, householdStatusLabel, householdStatusOptions, normalizePovertyType, povertyTypeColor, povertyTypeLabel, povertyTypeOptions } from "@/components/poverty/poverty-utils";
import { buildPovertyMapAreaSummaries, DEFAULT_CANTHO_PROVINCE_CODE, filterPovertyMarkersBySelectedArea, hasUnresolvedStandardizedLocation } from "@/components/poverty/poverty-location-utils";
import PovertyAssessmentTimelinePanel from "@/components/poverty/PovertyAssessmentTimelinePanel";
import PovertyAssessmentTimelineModal from "@/components/poverty/PovertyAssessmentTimelineModal";
import PovertySupportTimelinePanel from "@/components/poverty/PovertySupportTimelinePanel";
import PovertySupportTimelineModal from "@/components/poverty/PovertySupportTimelineModal";
import { buildPovertyMemberTotalsFromMarkers } from "@/components/poverty/poverty-member-totals-utils";
import ActionIcon from "@/components/controller/ActionIcon";
import { Alert, App, Button, Checkbox, Col, Empty, Form, Input, InputNumber, Modal, Row, Select, Skeleton, Space, Tabs, Tag, Tooltip } from "antd";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import L, { type LatLngExpression, type LeafletEvent } from "leaflet";
import "leaflet.heat";
import "leaflet.markercluster";
import { Activity, ChevronLeft, ChevronRight, CircleHelp, Crosshair, Home, ImageIcon, Layers, LocateFixed, MapPinPlus, Maximize2, Navigation, RotateCcw, Search, UserRound, UsersRound, X, TagIcon, Sliders } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { type MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CircleMarker, GeoJSON, MapContainer, Pane, ScaleControl, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";

type PovertyLeafletMapProps = {
    markers: PovertyMarker[];
    mode?: "admin" | "public";
    loading?: boolean;
    focusedMarkerId?: string | null;
    highlightedWardName?: string | null;
    canCreateHousehold?: boolean;
    canCreateHouseholdOnMap?: boolean;
    canEditMarkerPosition?: boolean;
    canViewAssessmentTimeline?: boolean;
    canUpdateHousehold?: boolean;
    canViewHouseholdDetail?: boolean;
    onRefresh?: () => void | Promise<void>;
    onMarkerPositionChange?: (marker: PovertyMarker, latitude: number, longitude: number) => Promise<void>;
};

type MarkerPosition = {
    latitude: number;
    longitude: number;
};

type HouseholdEditForm = {
    code?: string;
    year?: number;
    povertyType?: string;
    status?: string;
    provinceCode?: string;
    wardCode?: string;
    areaId?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
};

const DEFAULT_CENTER: LatLngExpression = [10.0452, 105.7469];
const DEFAULT_ZOOM = 12;
const currentYear = new Date().getFullYear();
const DETAIL_CARD_ICON_WRAPPER_CLASSNAME = "h-8 w-8";
const DETAIL_CARD_ICON_SIZE = 16;

const PovertyCoordinatePicker = dynamic(() => import("@/components/poverty/PovertyCoordinatePicker"), {
    ssr: false,
    loading: () => (
        <div className="flex h-[260px] items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500">
            Đang tải bản đồ chọn tọa độ...
        </div>
    ),
});

const GOOGLE_SUBDOMAINS = ["mt0", "mt1", "mt2", "mt3"];
const GOOGLE_LAYERS = {
    streets: { label: "Đường phố", layer: "m" },
    satellite: { label: "Vệ tinh", layer: "s" },
    hybrid: { label: "Hybrid", layer: "y" },
    terrain: { label: "Địa hình", layer: "p" },
} as const;
const BASE_LAYER_PREVIEW_IMAGES: Record<GoogleLayerKey, string> = {
    streets: "/images/poverty/map-preview-streets.png",
    satellite: "/images/poverty/map-preview-satellite.png",
    hybrid: "/images/poverty/map-preview-hybrid.png",
    terrain: "/images/poverty/map-preview-terrain.png",
};

type GoogleLayerKey = keyof typeof GOOGLE_LAYERS;
type PovertyVisibilityKey = "POOR" | "NEAR_POOR" | "NONE";
type CheckboxValue = string | number | boolean;
type PhotoPreviewMap = Record<string, string>;
type HeatLayerKey = "householdHeat" | "supportHeat" | "wardBoundary";
type LeftPanelTabKey = "list" | "area";
type WardBoundaryProperties = {
    name?: string;
    level?: string;
    mergedFrom?: string;
    province?: string;
};
const MARKER_LABEL_MIN_ZOOM = 13;
const MARKER_LABEL_MAX_COUNT = 60;
const WARD_BOUNDARY_DATA = canThoBoundaryGeoJson as FeatureCollection<Geometry, WardBoundaryProperties>;
const NEARBY_RADIUS_OPTIONS_KM = [1, 2, 5, 10] as const;

const toMarkerPosition = (marker: PovertyMarker): MarkerPosition | null => {
    return getValidGeoPosition(marker.latitude, marker.longitude);
};

const getHouseholdHeatWeight = (marker: PovertyMarker) => {
    const povertyType = normalizePovertyType(marker.povertyType);
    if (povertyType === "POOR") return 1;
    if (povertyType === "NEAR_POOR") return 0.74;
    if (povertyType === "NONE") return 0.28;
    return 0.5;
};

const getSupportHeatWeight = (marker: PovertyMarker) => {
    const supportCount = Number(marker.supportCount ?? 0);
    const supportTotalAmount = Number(marker.supportTotalAmount ?? 0);
    if (supportCount <= 0 && supportTotalAmount <= 0) return 0;

    const countScore = Math.min(0.48, supportCount * 0.14);
    const amountScore = Math.min(0.32, Math.log10(Math.max(supportTotalAmount, 0) + 1) / 6);
    return Math.min(1, 0.2 + countScore + amountScore);
};

const getBaseLayerPreviewUrl = (baseLayer: GoogleLayerKey) => BASE_LAYER_PREVIEW_IMAGES[baseLayer];

const buildGoogleMapsDirectionsUrl = (latitude: number, longitude: number) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}&travelmode=driving`;

const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("vi-VN");
};

const normalizeLocationName = (value?: string | null) =>
    String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

const distanceInMeters = (from: [number, number], to: [number, number]) => {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRadians(to[0] - from[0]);
    const dLng = toRadians(to[1] - from[1]);
    const lat1 = toRadians(from[0]);
    const lat2 = toRadians(to[0]);

    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
};

const markerIcon = (povertyType?: string | null) => {
    const normalizedType = normalizePovertyType(povertyType);
    const isPoor = normalizedType === "POOR";
    const markerTypeClass = isPoor ? "poverty-map-marker--poor" : "poverty-map-marker--near-poor";
    const iconUrl = isPoor
        ? "/images/poverty/marker-poor.png"
        : "/images/poverty/marker-near-poor.png";

    return L.divIcon({
        className: "poverty-map-marker-container",
        html: `
            <span class="poverty-map-marker ${markerTypeClass}">
                <span class="poverty-map-marker__pulse" aria-hidden="true"></span>
                <img class="poverty-map-marker__image" src="${iconUrl}" alt="" />
            </span>
        `,
        iconSize: [42, 42],
        iconAnchor: [21, 42],
        popupAnchor: [0, -40],
    });
};

const clusterIcon = (cluster: L.MarkerCluster) => {
    const count = cluster.getChildCount();
    const size = count >= 100 ? 52 : count >= 10 ? 46 : 40;

    return L.divIcon({
        className: "poverty-map-cluster",
        html: `
            <span style="
                display:flex;
                width:${size}px;
                height:${size}px;
                align-items:center;
                justify-content:center;
                border-radius:999px;
                background:#0f766e;
                border:4px solid rgba(204,251,241,.95);
                color:#fff;
                font-weight:700;
                font-size:13px;
                box-shadow:0 10px 26px rgba(15,23,42,.28);
            ">${count}</span>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

const fetchPhotoPreviewUrls = async (photos: HouseholdFieldPhoto[]): Promise<PhotoPreviewMap> => {
    const entries = await Promise.all(photos.map(async (photo) => {
        try {
            const response = await api.get<{ previewUrl?: string }>(endpoints.admin.filePreview(photo.uuid, 600));
            return [photo.uuid, String(response.previewUrl ?? "")] as const;
        } catch {
            return [photo.uuid, ""] as const;
        }
    }));
    return Object.fromEntries(entries.filter(([, url]) => url));
};

const schedulePopupRootUnmounts = (roots: Root[]) => {
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            roots.forEach((root) => root.unmount());
        });
    });
};

function MarkerPopupContent({
    marker,
}: {
    marker: PovertyMarker;
}) {
    const povertyType = normalizePovertyType(marker.povertyType);
    const iconClassName = povertyType === "POOR"
        ? "bg-red-50 text-red-600"
        : povertyType === "NEAR_POOR"
            ? "bg-amber-50 text-amber-600"
            : "bg-slate-100 text-slate-600";

    return (
        <div className="flex min-w-[190px] max-w-[240px] items-start gap-2.5 text-[13px] leading-5 text-gray-700">
            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
                <UserRound size={15} strokeWidth={2} />
            </span>
            <div className="min-w-0">
                <div className="font-semibold text-gray-900">{marker.code || `Hộ #${marker.id}`}</div>
                <div className="truncate text-gray-600">{marker.headFullName || "Chưa có thông tin chủ hộ"}</div>
            </div>
        </div>
    );
}

function FitBoundsControl({ markers, disabled }: { markers: PovertyMarker[]; disabled?: boolean }) {
    const map = useMap();

    const fitMarkers = useCallback(() => {
        const positions = markers
            .map(toMarkerPosition)
            .filter((position): position is MarkerPosition => Boolean(position))
            .map((position) => [position.latitude, position.longitude] as [number, number]);

        if (positions.length === 0) {
            map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
            return;
        }

        map.fitBounds(positions, { padding: [48, 48], maxZoom: 17 });
    }, [map, markers]);

    useEffect(() => {
        if (disabled) return;
        fitMarkers();
    }, [disabled, fitMarkers]);

    return null;
}

function FocusMarkerControl({
    focusedMarkerId,
    focusRequestKey,
    markers,
    markerRefs,
    clusterGroupRef,
}: {
    focusedMarkerId?: string | null;
    focusRequestKey: number;
    markers: PovertyMarker[];
    markerRefs: MutableRefObject<Record<string, L.Marker | null>>;
    clusterGroupRef: MutableRefObject<L.MarkerClusterGroup | null>;
}) {
    const map = useMap();

    useEffect(() => {
        if (!focusedMarkerId) return;
        const marker = markers.find((item) => item.id === focusedMarkerId);
        if (!marker) return;
        const position = toMarkerPosition(marker);
        if (!position) return;

        const leafletMarker = markerRefs.current[focusedMarkerId];
        if (leafletMarker && clusterGroupRef.current) {
            clusterGroupRef.current.zoomToShowLayer(leafletMarker, () => {
                map.flyTo([position.latitude, position.longitude], Math.max(map.getZoom(), 17), {
                    animate: true,
                    duration: 0.8,
                });

                window.setTimeout(() => {
                    leafletMarker.openTooltip();
                }, 650);
            });
            return;
        }

        map.flyTo([position.latitude, position.longitude], Math.max(map.getZoom(), 17), {
            animate: true,
            duration: 1.1,
        });

        window.setTimeout(() => {
            markerRefs.current[focusedMarkerId]?.openTooltip();
        }, 700);
    }, [clusterGroupRef, focusRequestKey, focusedMarkerId, map, markerRefs, markers]);

    return null;
}

function MapResizeOnLayoutChange({ resizeKey }: { resizeKey: string }) {
    const map = useMap();

    useEffect(() => {
        const rafId = window.requestAnimationFrame(() => {
            map.invalidateSize({ pan: false, animate: false });
        });
        const timeoutId = window.setTimeout(() => {
            map.invalidateSize({ pan: false, animate: false });
        }, 220);

        return () => {
            window.cancelAnimationFrame(rafId);
            window.clearTimeout(timeoutId);
        };
    }, [map, resizeKey]);

    return null;
}

function HouseholdCreatePointPicker({
    enabled,
    onSelect,
}: {
    enabled: boolean;
    onSelect: (latitude: number, longitude: number) => void;
}) {
    const map = useMap();

    useEffect(() => {
        const container = map.getContainer();
        const previousCursor = container.style.cursor;
        container.style.cursor = enabled ? "crosshair" : previousCursor || "";

        return () => {
            container.style.cursor = previousCursor;
        };
    }, [enabled, map]);

    useMapEvents({
        click(event) {
            if (!enabled) return;
            onSelect(
                Number(event.latlng.lat.toFixed(7)),
                Number(event.latlng.lng.toFixed(7))
            );
        },
    });

    return null;
}

function HeatmapLayer({
    markers,
    visible,
    gradient,
    radius,
    blur,
    minOpacity,
    max,
    weightResolver,
}: {
    markers: PovertyMarker[];
    visible: boolean;
    gradient: Record<number, string>;
    radius: number;
    blur: number;
    minOpacity: number;
    max: number;
    weightResolver: (marker: PovertyMarker) => number;
}) {
    const map = useMap();

    useEffect(() => {
        if (!visible) return;

        const points = markers
            .map((marker) => {
                const position = toMarkerPosition(marker);
                if (!position) return null;
                const weight = weightResolver(marker);
                if (!Number.isFinite(weight) || weight <= 0) return null;
                return [position.latitude, position.longitude, weight] as [number, number, number];
            })
            .filter((value): value is [number, number, number] => Boolean(value));

        if (points.length === 0) return;

        const heatLayer = (L as typeof L & {
            heatLayer: (latlngs: [number, number, number][], options: Record<string, unknown>) => L.Layer;
        }).heatLayer(points, {
            radius,
            blur,
            max,
            minOpacity,
            maxZoom: 18,
            gradient,
        });

        heatLayer.addTo(map);

        return () => {
            map.removeLayer(heatLayer);
        };
    }, [blur, gradient, map, markers, max, minOpacity, radius, visible, weightResolver]);

    return null;
}

function WardBoundaryLayer({
    visible,
    highlightedWardName,
    suppressLabels,
}: {
    visible: boolean;
    highlightedWardName?: string | null;
    suppressLabels?: boolean;
}) {
    const map = useMap();
    const boundaryRef = useRef<L.GeoJSON | null>(null);
    const [zoom, setZoom] = useState(map.getZoom());

    const onEachFeature = useCallback((feature: Feature<Geometry, WardBoundaryProperties>, layer: L.Layer) => {
        const name = feature.properties?.name || "Xã/Phường";
        const level = feature.properties?.level || "";
        const mergedFrom = feature.properties?.mergedFrom;
        const title = [level, name].filter(Boolean).join(" ");
        const lines = [`<strong>${title || "Xã/Phường"}</strong>`];
        if (mergedFrom) lines.push(`<span style="font-size:11px;color:#64748b">${mergedFrom}</span>`);

        layer.bindTooltip(lines.join("<br/>"), {
            sticky: true,
            direction: "top",
            opacity: 1,
            className: "poverty-boundary-tooltip-shell",
        });

        const isHighlighted = normalizeLocationName(highlightedWardName) === normalizeLocationName(feature.properties?.name);
        if (layer instanceof L.Path) {
            layer.setStyle({
                color: isHighlighted ? "#dc2626" : "#2563eb",
                weight: isHighlighted ? 2.5 : 1.1,
                opacity: isHighlighted ? 1 : 0.9,
                fillColor: isHighlighted ? "#fecaca" : "#60a5fa",
                fillOpacity: isHighlighted ? 0.14 : 0.02,
                dashArray: isHighlighted ? "" : "4 3",
            });
        }

        layer.on({
            mouseover: () => {
                if (layer instanceof L.Path) {
                    layer.setStyle({
                        color: isHighlighted ? "#b91c1c" : "#1d4ed8",
                        weight: isHighlighted ? 3 : 2,
                        fillOpacity: isHighlighted ? 0.18 : 0.08,
                    });
                }
            },
            mouseout: () => {
                if (layer instanceof L.Path) {
                    layer.setStyle({
                        color: isHighlighted ? "#dc2626" : "#2563eb",
                        weight: isHighlighted ? 2.5 : 1.1,
                        opacity: isHighlighted ? 1 : 0.9,
                        fillColor: isHighlighted ? "#fecaca" : "#60a5fa",
                        fillOpacity: isHighlighted ? 0.14 : 0.02,
                        dashArray: isHighlighted ? "" : "4 3",
                    });
                }
            },
        });
    }, [highlightedWardName]);

    useEffect(() => {
        const handleZoom = () => setZoom(map.getZoom());
        map.on("zoomend", handleZoom);
        return () => {
            map.off("zoomend", handleZoom);
        };
    }, [map]);

    useEffect(() => {
        const layer = boundaryRef.current;
        if (!layer) return;

        const shouldShowLabels = !suppressLabels && zoom >= 13.5;
        layer.eachLayer((item) => {
            const element = (item as L.Path & { getElement?: () => Element | null }).getElement?.();
            if (element instanceof SVGElement) {
                element.setAttribute("tabindex", "-1");
                element.setAttribute("focusable", "false");
                element.style.outline = "none";
            }
            const tooltip = (item as L.Layer & { getTooltip?: () => L.Tooltip | undefined }).getTooltip?.();
            if (!tooltip) return;
            if (shouldShowLabels) {
                (item as L.Layer & { openTooltip?: () => void }).openTooltip?.();
            } else {
                (item as L.Layer & { closeTooltip?: () => void }).closeTooltip?.();
            }
        });
    }, [suppressLabels, zoom]);

    if (!visible) return null;

    return (
        <Pane name="ward-boundary-pane" style={{ zIndex: 410 }}>
            <GeoJSON
                ref={boundaryRef}
                data={WARD_BOUNDARY_DATA}
                pane="ward-boundary-pane"
                style={() => ({
                    color: "#2563eb",
                    weight: 1.1,
                    opacity: 0.9,
                    fillColor: "#60a5fa",
                    fillOpacity: 0.02,
                    dashArray: "4 3",
                })}
                onEachFeature={onEachFeature}
            />
        </Pane>
    );
}

function ClusteredMarkers({
    markers,
    markerRefs: markerRefsRef,
    clusterGroupRef,
    onMarkerSelect,
    onMarkerDragEnd,
    onOpenPhotoGallery,
    onOpenAssessmentTimeline,
    onOpenSupportTimeline,
    canEditMarkerPosition,
    canViewAssessmentTimeline,
}: {
    markers: PovertyMarker[];
    markerRefs: MutableRefObject<Record<string, L.Marker | null>>;
    clusterGroupRef: MutableRefObject<L.MarkerClusterGroup | null>;
    onMarkerSelect: (marker: PovertyMarker) => void;
    onMarkerDragEnd: (marker: PovertyMarker, event: LeafletEvent) => void;
    onOpenPhotoGallery: (marker: PovertyMarker) => void;
    onOpenAssessmentTimeline: (marker: PovertyMarker) => void;
    onOpenSupportTimeline: (marker: PovertyMarker) => void;
    canEditMarkerPosition?: boolean;
    canViewAssessmentTimeline?: boolean;
}) {
    const map = useMap();

    useEffect(() => {
        const clusterGroup = L.markerClusterGroup({
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 46,
            disableClusteringAtZoom: 18,
            iconCreateFunction: clusterIcon,
        });

        const popupRoots: Root[] = [];
        markerRefsRef.current = {};
        const updateTooltipVisibility = () => {
            const shouldShowLabels = map.getZoom() >= MARKER_LABEL_MIN_ZOOM && markers.length <= MARKER_LABEL_MAX_COUNT;
            Object.values(markerRefsRef.current).forEach((leafletMarker) => {
                if (!leafletMarker) return;
                if (shouldShowLabels) {
                    leafletMarker.openTooltip();
                } else {
                    leafletMarker.closeTooltip();
                }
            });
        };

        markers.forEach((marker) => {
            const position = toMarkerPosition(marker);
            if (!position) return;

            const leafletMarker = L.marker([position.latitude, position.longitude], {
                icon: markerIcon(marker.povertyType),
                draggable: Boolean(canEditMarkerPosition),
            });
            const popupContainer = document.createElement("div");
            const popupRoot = createRoot(popupContainer);
            popupRoot.render(
                <MarkerPopupContent marker={marker} />
            );
            popupRoots.push(popupRoot);
            leafletMarker.bindTooltip(popupContainer, {
                permanent: true,
                direction: "top",
                offset: [0, -30],
                opacity: 1,
                interactive: false,
                className: "poverty-map-marker-label",
            });
            leafletMarker.on("click", () => {
                leafletMarker.closeTooltip();
                onMarkerSelect(marker);
            });
            leafletMarker.on("dragend", (event) => onMarkerDragEnd(marker, event));
            markerRefsRef.current[marker.id] = leafletMarker;
            clusterGroup.addLayer(leafletMarker);
        });

        clusterGroupRef.current = clusterGroup;
        map.addLayer(clusterGroup);
        updateTooltipVisibility();
        map.on("zoomend", updateTooltipVisibility);

        return () => {
            map.off("zoomend", updateTooltipVisibility);
            map.removeLayer(clusterGroup);
            schedulePopupRootUnmounts(popupRoots);
            clusterGroupRef.current = null;
            markerRefsRef.current = {};
        };
    }, [canEditMarkerPosition, canViewAssessmentTimeline, clusterGroupRef, map, markerRefsRef, markers, onMarkerDragEnd, onMarkerSelect, onOpenPhotoGallery, onOpenAssessmentTimeline, onOpenSupportTimeline]);

    return null;
}

function MapActions({
    baseLayer,
    markers,
    loading,
    canCreateHousehold,
    canCreateHouseholdOnMap,
    canEditMarkerPosition,
    createSelectionMode,
    onCreateHouseholdClick,
    onBaseLayerChange,
    onRefresh,
}: {
    baseLayer: GoogleLayerKey;
    markers: PovertyMarker[];
    loading?: boolean;
    canCreateHousehold?: boolean;
    canCreateHouseholdOnMap?: boolean;
    canEditMarkerPosition?: boolean;
    createSelectionMode?: boolean;
    onCreateHouseholdClick: () => void;
    onBaseLayerChange: (value: GoogleLayerKey) => void;
    onRefresh: () => void;
}) {
    const { notification } = App.useApp();
    const map = useMap();
    const controlRef = useRef<HTMLDivElement | null>(null);
    const utilityControlRef = useRef<HTMLDivElement | null>(null);
    const mapElementRef = useRef<HTMLElement | null>(null);
    const isClient = true;
    const [locating, setLocating] = useState(false);
    const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
    const [baseLayerPickerOpen, setBaseLayerPickerOpen] = useState(false);
    const [legendOpen, setLegendOpen] = useState(false);
    const [nearbyPickerOpen, setNearbyPickerOpen] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number | null>(null);
    const canCreateHouseholdFromMap = Boolean(canCreateHousehold && canCreateHouseholdOnMap);

    const poorMarkerCount = useMemo(
        () => markers.filter((marker) => normalizePovertyType(marker.povertyType) === "POOR").length,
        [markers]
    );
    const nearPoorMarkerCount = useMemo(
        () => markers.filter((marker) => normalizePovertyType(marker.povertyType) === "NEAR_POOR").length,
        [markers]
    );
    const nearbyPoorMarkers = useMemo(
        () => markers
            .filter((marker) => {
                const povertyType = normalizePovertyType(marker.povertyType);
                return povertyType === "POOR" || povertyType === "NEAR_POOR";
            })
            .map((marker) => {
                const position = toMarkerPosition(marker);
                if (!position) return null;
                return [position.latitude, position.longitude] as [number, number];
            })
            .filter((position): position is [number, number] => Boolean(position)),
        [markers]
    );
    const nearbyHouseholdCount = useMemo(() => {
        if (!currentPosition || !nearbyRadiusKm) return 0;
        const maxDistance = nearbyRadiusKm * 1000;
        return nearbyPoorMarkers.filter((position) => distanceInMeters(currentPosition, position) <= maxDistance).length;
    }, [currentPosition, nearbyPoorMarkers, nearbyRadiusKm]);

    const fitMarkers = useCallback(() => {
        const positions = markers
            .map(toMarkerPosition)
            .filter((position): position is MarkerPosition => Boolean(position))
            .map((position) => [position.latitude, position.longitude] as [number, number]);

        if (positions.length === 0) {
            map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
            return;
        }

        map.fitBounds(positions, { padding: [48, 48], maxZoom: 17 });
    }, [map, markers]);

    const toggleFullscreen = useCallback(() => {
        const element = mapElementRef.current ?? map.getContainer();
        mapElementRef.current = element;
        if (!document.fullscreenElement) {
            void element.requestFullscreen?.();
            return;
        }
        void document.exitFullscreen?.();
    }, [map]);

    const locateCurrentPosition = useCallback(() => {
        if (!navigator.geolocation) {
            notification.warning({ message: "Trình duyệt không hỗ trợ định vị hiện tại" });
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nextPosition: [number, number] = [
                    Number(position.coords.latitude.toFixed(7)),
                    Number(position.coords.longitude.toFixed(7)),
                ];
                setCurrentPosition(nextPosition);
                map.flyTo(nextPosition, Math.max(map.getZoom(), 17), { duration: 0.9 });
                setLocating(false);
            },
            (error) => {
                notification.warning({
                    message: "Không thể lấy vị trí hiện tại",
                    description: error.message || "Vui lòng kiểm tra quyền truy cập vị trí của trình duyệt.",
                });
                setLocating(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000,
            }
        );
    }, [map, notification]);

    useEffect(() => {
        if (!controlRef.current) return;
        L.DomEvent.disableClickPropagation(controlRef.current);
        L.DomEvent.disableScrollPropagation(controlRef.current);
    }, []);

    useEffect(() => {
        if (!utilityControlRef.current) return;
        L.DomEvent.disableClickPropagation(utilityControlRef.current);
        L.DomEvent.disableScrollPropagation(utilityControlRef.current);
    }, []);

    useEffect(() => {
        if (!currentPosition || !nearbyRadiusKm) return;
        if (!map || !(map as L.Map & { _loaded?: boolean })._loaded) return;
        if (!map.getContainer()) return;

        try {
            const radiusInMeters = nearbyRadiusKm * 1000;
            const radiusCircle = L.circle(currentPosition, { radius: radiusInMeters });
            const bounds = radiusCircle.getBounds();
            map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
        } catch (error) {
            // Ignore transient map state errors during rapid layout changes.
            console.debug("fitBounds error:", error);
        }
    }, [currentPosition, map, nearbyRadiusKm]);

    useEffect(() => {
        if (!currentPosition || !nearbyRadiusKm) return;
        if (!map || !(map as L.Map & { _loaded?: boolean })._loaded) return;
        if (!map.getContainer()) return;

        try {
            const radiusLayer = L.circle(currentPosition, {
                radius: nearbyRadiusKm * 1000,
                color: "#2563eb",
                fillColor: "#60a5fa",
                fillOpacity: 0.12,
                weight: 2,
                dashArray: "6 6",
            });

            radiusLayer.addTo(map);
            return () => {
                if (map && map.hasLayer(radiusLayer)) {
                    map.removeLayer(radiusLayer);
                }
            };
        } catch (error) {
            console.debug("radiusLayer error:", error);
            return undefined;
        }
    }, [currentPosition, map, nearbyRadiusKm]);

    if (!isClient) {
        return (
            <>
                <div className="leaflet-right">
                    <div className="leaflet-control relative mt-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                        <Space orientation="vertical" size={6}>
                            <Button aria-label="Chọn lớp nền" icon={<Layers size={16} />} disabled />
                            <Button aria-label="Chú thích" icon={<TagIcon size={16} />} disabled />
                            <Button aria-label="Tìm hộ quanh tôi" icon={<Search size={16} />} disabled />
                            <Button aria-label="Vị trí hiện tại" icon={<LocateFixed size={16} />} disabled />
                            <Button aria-label="Căn bản đồ theo tất cả điểm" icon={<Crosshair size={16} />} disabled />
                            <Button aria-label="Thêm hộ mới trên bản đồ" icon={<MapPinPlus size={16} />} disabled />
                            <Button aria-label="Toàn màn hình" icon={<Maximize2 size={16} />} disabled />
                            <Button aria-label="Tải lại điểm" icon={<RotateCcw size={16} />} disabled />
                            <Button aria-label="Hướng dẫn thao tác bản đồ" icon={<CircleHelp size={16} />} disabled />
                        </Space>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="leaflet-right">
                <div ref={controlRef} className="leaflet-control relative mt-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                    {baseLayerPickerOpen ? (
                        <div className="absolute right-full top-0 z-[700] mr-2 w-[260px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lớp nền</p>
                                    <p className="text-sm font-semibold text-gray-900">Chọn kiểu hiển thị bản đồ</p>
                                </div>
                                <Tooltip title="Thu gọn">
                                    <Button
                                        type="text"
                                        size="small"
                                        aria-label="Thu gọn chọn lớp nền"
                                        icon={<X size={14} />}
                                        onClick={() => setBaseLayerPickerOpen(false)}
                                    />
                                </Tooltip>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {(Object.keys(GOOGLE_LAYERS) as GoogleLayerKey[]).map((layerKey) => {
                                    const selected = layerKey === baseLayer;
                                    return (
                                        <button
                                            key={layerKey}
                                            type="button"
                                            className={`overflow-hidden rounded-xl border text-left transition ${selected ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200 hover:border-blue-300"}`}
                                            onClick={() => {
                                                onBaseLayerChange(layerKey);
                                                setBaseLayerPickerOpen(false);
                                            }}
                                        >
                                            <div
                                                className="h-20 w-full bg-cover bg-center"
                                                style={{ backgroundImage: `url(${getBaseLayerPreviewUrl(layerKey)})` }}
                                            />
                                            <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                                                <span className="text-xs font-medium text-gray-700">{GOOGLE_LAYERS[layerKey].label}</span>
                                                {selected ? <span className="h-2 w-2 rounded-full bg-blue-500" /> : null}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}

                    {legendOpen ? (
                        <div className="absolute right-full top-[52px] z-[700] mr-2 w-[240px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Chú thích</p>
                                </div>
                                <Tooltip title="Thu gọn">
                                    <Button
                                        type="text"
                                        size="small"
                                        aria-label="Thu gọn chú thích"
                                        icon={<X size={14} />}
                                        onClick={() => setLegendOpen(false)}
                                    />
                                </Tooltip>
                            </div>

                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50/70 px-2.5 py-2">
                                    <span className="flex items-center gap-2 text-sm text-gray-700">
                                        <img src="/images/poverty/marker-poor.png" alt="" className="h-7 w-7 shrink-0 object-contain" />
                                        Hộ nghèo
                                    </span>
                                    <span className="text-xs font-semibold text-red-700">{poorMarkerCount.toLocaleString("vi-VN")}</span>
                                </div>

                                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-amber-50/70 px-2.5 py-2">
                                    <span className="flex items-center gap-2 text-sm text-gray-700">
                                        <img src="/images/poverty/marker-near-poor.png" alt="" className="h-7 w-7 shrink-0 object-contain" />
                                        Hộ cận nghèo
                                    </span>
                                    <span className="text-xs font-semibold text-amber-700">{nearPoorMarkerCount.toLocaleString("vi-VN")}</span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {nearbyPickerOpen ? (
                        <div className="absolute right-full top-[104px] z-[700] mr-2 w-[260px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Xung quanh tôi</p>
                                    <p className="text-sm font-semibold text-gray-900">Hộ nghèo/cận nghèo theo bán kính</p>
                                </div>
                                <Tooltip title="Thu gọn">
                                    <Button
                                        type="text"
                                        size="small"
                                        aria-label="Thu gọn tìm quanh tôi"
                                        icon={<X size={14} />}
                                        onClick={() => setNearbyPickerOpen(false)}
                                    />
                                </Tooltip>
                            </div>

                            {currentPosition ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-4 gap-2">
                                        {NEARBY_RADIUS_OPTIONS_KM.map((km) => {
                                            const selected = nearbyRadiusKm === km;
                                            return (
                                                <Button
                                                    key={km}
                                                    size="small"
                                                    type={selected ? "primary" : "default"}
                                                    onClick={() => setNearbyRadiusKm(km)}
                                                >
                                                    {km}km
                                                </Button>
                                            );
                                        })}
                                    </div>

                                    <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-gray-700">
                                        {nearbyRadiusKm
                                            ? <span>Có <strong>{nearbyHouseholdCount.toLocaleString("vi-VN")}</strong> hộ nghèo/cận nghèo trong phạm vi {nearbyRadiusKm}km.</span>
                                            : <span>Chọn bán kính để hiển thị vùng lân cận.</span>}
                                    </div>

                                    <Button
                                        block
                                        size="small"
                                        onClick={() => setNearbyRadiusKm(null)}
                                        disabled={!nearbyRadiusKm}
                                    >
                                        Xóa bán kính
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
                                        Cần xác định vị trí hiện tại trước khi tìm hộ lân cận.
                                    </p>
                                    <Button block size="small" type="primary" onClick={locateCurrentPosition} loading={locating}>
                                        Lấy vị trí hiện tại
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : null}

                    <Space orientation="vertical" size={6}>
                        <Tooltip title="Chọn lớp nền" placement="left">
                            <Button
                                aria-label="Chọn lớp nền"
                                icon={<Layers size={16} />}
                                type={baseLayerPickerOpen ? "primary" : "default"}
                                onClick={() => {
                                    setLegendOpen(false);
                                    setNearbyPickerOpen(false);
                                    setBaseLayerPickerOpen((value) => !value);
                                }}
                            />
                        </Tooltip>
                        <Tooltip title="Chú thích" placement="left">
                            <Button
                                aria-label="Chú thích"
                                icon={<TagIcon size={16} />}
                                type={legendOpen ? "primary" : "default"}
                                onClick={() => {
                                    setBaseLayerPickerOpen(false);
                                    setNearbyPickerOpen(false);
                                    setLegendOpen((value) => !value);
                                }}
                            />
                        </Tooltip>
                        <Tooltip title="Tìm hộ quanh tôi" placement="left">
                            <Button
                                aria-label="Tìm hộ quanh tôi"
                                icon={<Search size={16} />}
                                type={nearbyPickerOpen ? "primary" : "default"}
                                onClick={() => {
                                    setBaseLayerPickerOpen(false);
                                    setLegendOpen(false);
                                    setNearbyPickerOpen((value) => !value);
                                }}
                            />
                        </Tooltip>
                        {canCreateHouseholdFromMap ? (
                            <Tooltip title={createSelectionMode ? "Hủy chọn vị trí thêm hộ" : "Thêm hộ mới trên bản đồ"} placement="left">
                                <Button
                                    aria-label={createSelectionMode ? "Hủy chọn vị trí thêm hộ" : "Thêm hộ mới trên bản đồ"}
                                    icon={<MapPinPlus size={16} />}
                                    type={createSelectionMode ? "primary" : "default"}
                                    onClick={onCreateHouseholdClick}
                                />
                            </Tooltip>
                        ) : null}
                    </Space>
                </div>
            </div>
            <div className="leaflet-bottom leaflet-right">
                <div ref={utilityControlRef} className="leaflet-control relative mb-[52px] mr-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                    {guideOpen ? (
                        <div className="absolute bottom-0 right-full z-[700] mr-2 w-[260px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Hướng dẫn</p>
                                    <p className="text-sm font-semibold text-gray-900">Thao tác bản đồ</p>
                                </div>
                                <Tooltip title="Thu gọn">
                                    <Button
                                        type="text"
                                        size="small"
                                        aria-label="Thu gọn hướng dẫn thao tác bản đồ"
                                        icon={<X size={14} />}
                                        onClick={() => setGuideOpen(false)}
                                    />
                                </Tooltip>
                            </div>

                            <div className="space-y-2.5 text-sm text-gray-600">
                                <div className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2.5">
                                    {canEditMarkerPosition ? "Kéo marker để cập nhật vĩ độ, kinh độ." : "Bạn chỉ có quyền xem marker trên bản đồ."}
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2.5">
                                    Bấm marker để mở panel chi tiết ngay trong khung bản đồ.
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2.5">
                                    Dùng bộ lọc, heatmap và ranh giới hành chính để xem phân bố tổng quan.
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <Space orientation="vertical" size={6}>
                        <Tooltip title="Vị trí hiện tại" placement="left">
                            <Button aria-label="Vị trí hiện tại" icon={<LocateFixed size={16} />} loading={locating} onClick={locateCurrentPosition} />
                        </Tooltip>
                        <Tooltip title="Căn bản đồ theo tất cả điểm" placement="left">
                            <Button aria-label="Căn bản đồ theo tất cả điểm" icon={<Crosshair size={16} />} onClick={fitMarkers} />
                        </Tooltip>
                        <Tooltip title="Toàn màn hình" placement="left">
                            <Button aria-label="Toàn màn hình" icon={<Maximize2 size={16} />} onClick={toggleFullscreen} />
                        </Tooltip>
                        <Tooltip title="Tải lại điểm" placement="left">
                            <Button aria-label="Tải lại điểm" icon={<RotateCcw size={16} />} loading={loading} onClick={onRefresh} />
                        </Tooltip>
                        <Tooltip title="Hướng dẫn thao tác bản đồ" placement="left">
                            <Button
                                aria-label="Hướng dẫn thao tác bản đồ"
                                icon={<CircleHelp size={16} />}
                                type={guideOpen ? "primary" : "default"}
                                onClick={() => setGuideOpen((value) => !value)}
                            />
                        </Tooltip>
                    </Space>
                </div>
            </div>
            {currentPosition ? (
                <>
                    <CircleMarker
                        center={currentPosition}
                        radius={9}
                        pathOptions={{
                            color: "#1d4ed8",
                            fillColor: "#3b82f6",
                            fillOpacity: 0.7,
                            weight: 3,
                        }}
                    />
                </>
            ) : null}
        </>
    );
}

function MapLayerControls({
    visibleTypes,
    visibleHeatLayers,
    visibleCount,
    supportedCount,
    unsupportedCount,
    onVisibleHeatLayersChange,
    onVisibleTypesChange,
}: {
    visibleTypes: PovertyVisibilityKey[];
    visibleHeatLayers: HeatLayerKey[];
    visibleCount: number;
    supportedCount: number;
    unsupportedCount: number;
    onVisibleHeatLayersChange: (value: HeatLayerKey[]) => void;
    onVisibleTypesChange: (value: PovertyVisibilityKey[]) => void;
}) {
    const controlRef = useRef<HTMLDivElement | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (!controlRef.current) return;
        L.DomEvent.disableClickPropagation(controlRef.current);
        L.DomEvent.disableScrollPropagation(controlRef.current);
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 767px)");
        const updateIsMobile = () => {
            const nextIsMobile = mediaQuery.matches;
            setCollapsed(nextIsMobile);
        };

        updateIsMobile();
        mediaQuery.addEventListener("change", updateIsMobile);

        return () => {
            mediaQuery.removeEventListener("change", updateIsMobile);
        };
    }, []);

    return (
        <div className="leaflet-right mt-2">
            <div ref={controlRef} className="leaflet-control relative rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                {!collapsed ? (
                    <div className="absolute right-full top-0 z-[700] mr-2 w-[min(320px,calc(100vw-48px))] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                <Sliders size={16} />
                                Điều khiển bản đồ
                            </div>
                            <Tooltip title="Thu gọn">
                                <Button
                                    aria-label="Thu gọn điều khiển bản đồ"
                                    size="small"
                                    type="text"
                                    icon={<X size={15} />}
                                    onClick={() => setCollapsed(true)}
                                />
                            </Tooltip>
                        </div>

                        <div>
                            <div className="text-xs font-semibold uppercase text-gray-500">Hiển thị điểm</div>
                            <Checkbox.Group
                                className="mt-2 grid grid-cols-1 gap-2 text-sm"
                                value={visibleTypes}
                                options={[
                                    { label: "Hộ nghèo", value: "POOR" },
                                    { label: "Hộ cận nghèo", value: "NEAR_POOR" },
                                    { label: "Thoát nghèo", value: "NONE" },
                                ]}
                                onChange={(values: CheckboxValue[]) => {
                                    const nextValues = values as PovertyVisibilityKey[];
                                    onVisibleTypesChange(nextValues.length > 0 ? nextValues : ["POOR", "NEAR_POOR", "NONE"]);
                                }}
                            />
                            <div className="mt-2 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600">
                                Đang hiển thị {visibleCount.toLocaleString("vi-VN")} điểm
                            </div>
                        </div>

                        <div className="mt-3 border-t border-gray-100 pt-3">
                            <div className="text-xs font-semibold uppercase text-gray-500">Mật độ</div>
                            <Checkbox.Group
                                className="mt-2 grid grid-cols-1 gap-2 text-sm"
                                value={visibleHeatLayers.filter((value) => value !== "wardBoundary")}
                                options={[
                                    { label: "Mật độ hộ nghèo/cận nghèo", value: "householdHeat" },
                                    { label: "Mật độ hỗ trợ", value: "supportHeat" },
                                ]}
                                onChange={(values: CheckboxValue[]) => {
                                    const nextOverlayValues = values as HeatLayerKey[];
                                    const hasWardBoundary = visibleHeatLayers.includes("wardBoundary");
                                    onVisibleHeatLayersChange([
                                        ...(hasWardBoundary ? ["wardBoundary" as HeatLayerKey] : []),
                                        ...nextOverlayValues,
                                    ]);
                                }}
                            />
                            <div className="mt-2 space-y-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-gray-600">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="inline-flex items-center gap-2">
                                        <span className="h-2.5 w-8 rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-red-500" />
                                        Mật độ hộ nghèo/cận nghèo
                                    </span>
                                    <span>{visibleCount.toLocaleString("vi-VN")} điểm</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="inline-flex items-center gap-2">
                                        <span className="h-2.5 w-8 rounded-full bg-gradient-to-r from-cyan-300 via-emerald-400 to-teal-600" />
                                        Mật độ hỗ trợ
                                    </span>
                                    <span>{supportedCount.toLocaleString("vi-VN")} có hỗ trợ / {unsupportedCount.toLocaleString("vi-VN")} chưa có</span>
                                </div>

                            </div>
                        </div>

                        <div className="mt-3 border-t border-gray-100 pt-3">
                            <div className="text-xs font-semibold uppercase text-gray-500">Ranh giới hành chính</div>
                            <Checkbox.Group
                                className="mt-2 grid grid-cols-1 gap-2 text-sm"
                                value={visibleHeatLayers.filter((value) => value === "wardBoundary")}
                                options={[
                                    { label: "Ranh giới xã/phường", value: "wardBoundary" },
                                ]}
                                onChange={(values: CheckboxValue[]) => {
                                    const hasWardBoundary = values.includes("wardBoundary");
                                    const nextOverlayValues = visibleHeatLayers.filter((value) => value !== "wardBoundary");
                                    onVisibleHeatLayersChange([
                                        ...(hasWardBoundary ? ["wardBoundary" as HeatLayerKey] : []),
                                        ...nextOverlayValues,
                                    ]);
                                }}
                            />
                        </div>
                    </div>
                ) : null}

                <Tooltip title={collapsed ? "Mở điều khiển bản đồ" : "Thu gọn điều khiển bản đồ"} placement="left">
                    <Button
                        aria-label={collapsed ? "Mở điều khiển bản đồ" : "Thu gọn điều khiển bản đồ"}
                        type={collapsed ? "default" : "primary"}
                        icon={<Sliders size={16} />}
                        onClick={() => setCollapsed((value) => !value)}
                    />
                </Tooltip>
            </div>
        </div>
    );
}

function MarkerDetailPanel({
    marker,
    mode,
    detail,
    loading,
    previewUrls,
    canViewHouseholdDetail,
    canUpdateHousehold,
    onClose,
    onViewHousehold,
    onOpenPhotoGallery,
    onOpenAssessmentTimeline,
    onOpenSupportTimeline,
    onEditHousehold,
}: {
    marker: PovertyMarker | null;
    mode: "admin" | "public";
    detail: HouseholdDetailResponse | null;
    loading?: boolean;
    previewUrls: PhotoPreviewMap;
    canViewHouseholdDetail?: boolean;
    canUpdateHousehold?: boolean;
    onClose: () => void;
    onViewHousehold: (marker: PovertyMarker) => void;
    onOpenPhotoGallery: (marker: PovertyMarker) => void;
    onOpenAssessmentTimeline: (marker: PovertyMarker) => void;
    onOpenSupportTimeline: (marker: PovertyMarker) => void;
    onEditHousehold: (marker: PovertyMarker) => void;
}) {
    if (!marker) return null;
    const isPublicMode = mode === "public";

    const household = detail?.household ?? marker;
    const assessments = detail?.assessments ?? [];
    const supports = detail?.supports ?? [];
    const latestContextHistory = resolveLatestHouseholdContextHistory(detail?.latestContextHistory ?? null, detail?.contextHistories ?? []);
    const ownerTheme = getHouseholdSummaryCardTheme("owner");
    const membersTheme = getHouseholdSummaryCardTheme("members");
    const locationTheme = getHouseholdSummaryCardTheme("location");
    const familySituationTheme = getHouseholdContextCardTheme("familySituation");
    const currentStatusTheme = getHouseholdContextCardTheme("currentStatus");
    const photos = detail?.fieldPhotos ?? marker.fieldPhotos ?? [];
    const area = [household.provinceName, household.wardName, household.areaName].filter(Boolean).join(" / ") || "-";
    const coverPhoto = photos[0] ?? null;
    const coverUrl = coverPhoto ? previewUrls[coverPhoto.uuid] : "";
    const galleryMarker = {
        ...marker,
        fieldPhotos: photos,
    };
    const householdPosition = getValidGeoPosition(household.latitude, household.longitude);
    const directionUrl = householdPosition
        ? buildGoogleMapsDirectionsUrl(householdPosition.latitude, householdPosition.longitude)
        : null;
    const latestContextRecordedAt = latestContextHistory?.recordedAt ? formatDate(latestContextHistory.recordedAt) : "-";

    return (
        <div className="absolute inset-y-4 left-4 z-[810] w-[min(420px,calc(100%-32px))] overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur-sm">
            <div className="flex h-full flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Chi tiết hộ trên bản đồ</p>
                        <h4 className="mt-1 truncate text-base font-semibold text-gray-900">{household.code || `Hộ #${household.id}`}</h4>
                    </div>
                    <div className="flex items-center gap-1">
                        <Tooltip title={directionUrl ? "Chỉ đường bằng Google Maps" : "Hộ này chưa có tọa độ để chỉ đường"}>
                            <Button
                                type="text"
                                aria-label="Chỉ đường bằng Google Maps"
                                icon={<Navigation size={16} />}
                                className="inline-flex items-center justify-center rounded-lg !text-blue-600 hover:!bg-blue-50 hover:!text-blue-700 disabled:!text-gray-300 "
                                style={{ backgroundColor: "rgb(240, 232, 255)" }}
                                disabled={!directionUrl}
                                onClick={() => {
                                    if (!directionUrl) return;
                                    window.open(directionUrl, "_blank", "noopener,noreferrer");
                                }}
                            />
                        </Tooltip>
                        {canViewHouseholdDetail ? (
                            <Tooltip title="Xem chi tiết hộ">
                                <Button
                                    type="text"
                                    aria-label="Xem chi tiết hộ"
                                    icon={<ActionIcon action="view" />}
                                    onClick={() => onViewHousehold(marker)}
                                />
                            </Tooltip>
                        ) : null}
                        {canUpdateHousehold && !isPublicMode ? (
                            <Tooltip title="Sửa thông tin hộ">
                                <Button
                                    type="text"
                                    aria-label="Sửa thông tin hộ"
                                    icon={<ActionIcon action="edit" />}
                                    onClick={() => onEditHousehold(marker)}
                                />
                            </Tooltip>
                        ) : null}

                        <Tooltip title="Đóng panel">
                            <Button type="text" aria-label="Đóng panel" icon={<X size={16} />} onClick={onClose} />
                        </Tooltip>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 p-4">
                    {loading ? (
                        <div className="space-y-4">
                            <Skeleton.Image active className="!h-[190px] !w-full !rounded-2xl" />
                            <Skeleton active paragraph={{ rows: 4 }} />
                            <Skeleton active paragraph={{ rows: 5 }} />
                            <Skeleton active paragraph={{ rows: 4 }} />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {!isPublicMode ? (
                                <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                                    <button
                                        type="button"
                                        className="relative block h-[190px] w-full overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-200 text-left"
                                        onClick={() => onOpenPhotoGallery(galleryMarker)}
                                        disabled={photos.length === 0}
                                    >
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={coverPhoto?.fileName || "Ảnh hộ"} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-500">
                                                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                                                    <ImageIcon size={24} />
                                                </span>
                                                <span className="text-sm font-medium">{photos.length > 0 ? "Đang tải ảnh xem trước" : "Chưa có ảnh thực tế"}</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 py-3 text-white">
                                            <div className="flex items-end justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-base font-semibold">{household.headFullName || "Chưa có thông tin chủ hộ"}</div>
                                                    <div className="truncate text-xs text-white/80">{area}</div>
                                                </div>
                                                <div className="rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium">
                                                    {photos.length.toLocaleString("vi-VN")} ảnh
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </section>
                            ) : null}

                            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <Tag className="m-0" color={povertyTypeColor(household.povertyType)}>{povertyTypeLabel(household.povertyType)}</Tag>
                                    <Tag className="m-0" color={household.status === "ACTIVE" ? "green" : "default"}>{householdStatusLabel(household.status)}</Tag>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className={`rounded-xl p-3 ${ownerTheme.cardClassName}`}>
                                        <div className="flex items-start gap-3">
                                            <span className={`inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm ${DETAIL_CARD_ICON_WRAPPER_CLASSNAME} ${ownerTheme.iconClassName}`}>
                                                <UserRound size={DETAIL_CARD_ICON_SIZE} />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-xs font-semibold uppercase ${ownerTheme.labelClassName}`}>Chủ hộ</p>
                                                <p className={`mt-2 truncate text-sm font-semibold ${ownerTheme.textClassName}`}>{household.headFullName || "-"}</p>
                                                {!isPublicMode ? (
                                                    <p className="mt-2 text-xs text-slate-500">CCCD: {household.headCitizenId || "-"}</p>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`rounded-xl p-3 ${membersTheme.cardClassName}`}>
                                        <div className="flex items-start gap-3">
                                            <span className={`inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm ${DETAIL_CARD_ICON_WRAPPER_CLASSNAME} ${membersTheme.iconClassName}`}>
                                                <UsersRound size={DETAIL_CARD_ICON_SIZE} />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-xs font-semibold uppercase ${membersTheme.labelClassName}`}>Nhân khẩu</p>
                                                <p className={`mt-2 text-sm font-semibold ${membersTheme.textClassName}`}>{Number(household.memberCount ?? 0).toLocaleString("vi-VN")} người</p>
                                                <p className="mt-2 text-xs text-slate-500">Năm quản lý: {household.year || "-"}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`rounded-xl p-3 sm:col-span-2 ${locationTheme.cardClassName}`}>
                                        <div className="flex items-start gap-3">
                                            <span className={`inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm ${DETAIL_CARD_ICON_WRAPPER_CLASSNAME} ${locationTheme.iconClassName}`}>
                                                <MapPinPlus size={DETAIL_CARD_ICON_SIZE} />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-xs font-semibold uppercase ${locationTheme.labelClassName}`}>Địa bàn</p>
                                                <p className={`mt-2 break-words text-sm font-semibold ${locationTheme.textClassName}`}>{area}</p>
                                                <p className="mt-2 break-words text-xs text-slate-500">Địa chỉ: {household.address || "-"}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {!isPublicMode ? (
                                <>
                                    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                        <div className="mb-3">
                                            <p className="text-sm font-semibold text-gray-900">Hiện trạng và hoàn cảnh</p>
                                            <p className="text-xs text-gray-500">Cập nhật gần nhất: {latestContextRecordedAt}</p>
                                        </div>
                                        <div className={`rounded-xl p-3 ${familySituationTheme.cardClassName}`}>
                                            <div className="flex items-start gap-3">
                                                <span className={`inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm ${DETAIL_CARD_ICON_WRAPPER_CLASSNAME} ${familySituationTheme.iconClassName}`}>
                                                    <Home size={DETAIL_CARD_ICON_SIZE} />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-xs font-semibold uppercase ${familySituationTheme.labelClassName}`}>Hoàn cảnh gia đình</p>
                                                    <div className={`mt-2 min-h-[44px] break-words text-sm ${familySituationTheme.textClassName}`}>{latestContextHistory?.familySituation || "-"}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`mt-2 rounded-xl p-3 ${currentStatusTheme.cardClassName}`}>
                                            <div className="flex items-start gap-3">
                                                <span className={`inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm ${DETAIL_CARD_ICON_WRAPPER_CLASSNAME} ${currentStatusTheme.iconClassName}`}>
                                                    <Activity size={DETAIL_CARD_ICON_SIZE} />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-xs font-semibold uppercase ${currentStatusTheme.labelClassName}`}>Hiện trạng</p>
                                                    <div className={`mt-2 min-h-[44px] break-words text-sm ${currentStatusTheme.textClassName}`}>{latestContextHistory?.currentStatus || "-"}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">Quá trình đánh giá</p>
                                                <p className="text-xs text-gray-500">Theo dõi diễn biến đánh giá từ đầu đến hiện tại.</p>
                                            </div>
                                            <Tooltip title="Xem chi tiết">
                                                <Button
                                                    type="text"
                                                    aria-label="Xem quá trình đánh giá"
                                                    icon={<ActionIcon action="timeline" />}
                                                    onClick={() => onOpenAssessmentTimeline(marker)}
                                                />
                                            </Tooltip>
                                        </div>
                                        <PovertyAssessmentTimelinePanel household={household} assessments={assessments} loading={loading} showHouseholdInfo={false} variant="compact" />
                                    </section>

                                    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">Quá trình hỗ trợ</p>
                                                <p className="text-xs text-gray-500">Theo dõi các đợt hỗ trợ đã ghi nhận.</p>
                                            </div>
                                            <Tooltip title="Xem chi tiết">
                                                <Button
                                                    type="text"
                                                    aria-label="Xem quá trình hỗ trợ"
                                                    icon={<ActionIcon action="supportTimeline" />}
                                                    onClick={() => onOpenSupportTimeline(marker)}
                                                />
                                            </Tooltip>
                                        </div>
                                        <PovertySupportTimelinePanel supports={supports} loading={loading} variant="compact" />
                                    </section>
                                </>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function FieldPhotoGalleryModal({
    marker,
    open,
    onClose,
}: {
    marker: PovertyMarker | null;
    open: boolean;
    onClose: () => void;
}) {
    const photos = useMemo(() => marker?.fieldPhotos ?? [], [marker?.fieldPhotos]);
    const photoIds = useMemo(() => photos.map((photo) => photo.uuid).join("|"), [photos]);
    const [previewUrls, setPreviewUrls] = useState<PhotoPreviewMap>({});
    const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

    useEffect(() => {
        if (!open || photos.length === 0) {
            window.setTimeout(() => {
                setPreviewUrls({});
                setSelectedPhotoId(null);
            }, 0);
            return;
        }

        let cancelled = false;
        window.setTimeout(() => {
            if (!cancelled) {
                setSelectedPhotoId((current) => current && photos.some((photo) => photo.uuid === current) ? current : photos[0]?.uuid ?? null);
            }
        }, 0);

        void fetchPhotoPreviewUrls(photos).then((urls) => {
            if (!cancelled) setPreviewUrls(urls);
        });

        return () => {
            cancelled = true;
        };
    }, [open, photoIds, photos]);

    const selectedPhoto = photos.find((photo) => photo.uuid === selectedPhotoId) ?? photos[0] ?? null;
    const selectedPreviewUrl = selectedPhoto ? previewUrls[selectedPhoto.uuid] : "";

    return (
        <Modal
            title={`Ảnh thực tế ${marker?.code ? `- ${marker.code}` : ""}`}
            open={open}
            onCancel={onClose}
            footer={null}
            width={920}
            style={{ maxWidth: "calc(100vw - 32px)" }}
        >
            {photos.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 md:min-h-[480px]">
                        {selectedPreviewUrl ? (
                            <img src={selectedPreviewUrl} alt={selectedPhoto?.fileName ?? "Ảnh thực tế"} className="max-h-[70vh] max-w-full object-contain" />
                        ) : (
                            <div className="text-sm text-gray-500">Không thể tải ảnh xem trước</div>
                        )}
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {photos.map((photo) => {
                            const previewUrl = previewUrls[photo.uuid];
                            const selected = photo.uuid === selectedPhoto?.uuid;
                            return (
                                <button
                                    key={photo.uuid}
                                    type="button"
                                    className={`h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-gray-100 ${selected ? "border-red-500 ring-2 ring-red-100" : "border-gray-200"}`}
                                    onClick={() => setSelectedPhotoId(photo.uuid)}
                                >
                                    {previewUrl ? (
                                        <img src={previewUrl} alt={photo.fileName} className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] text-gray-500">Ảnh</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <Empty description="Chưa có ảnh thực tế" />
            )}
        </Modal>
    );
}

export default function PovertyLeafletMap({
    markers,
    mode = "admin",
    loading,
    focusedMarkerId,
    canCreateHousehold,
    canCreateHouseholdOnMap,
    canEditMarkerPosition,
    canViewAssessmentTimeline,
    canUpdateHousehold,
    canViewHouseholdDetail,
    onRefresh = async () => undefined,
    onMarkerPositionChange = async () => undefined,
}: PovertyLeafletMapProps) {
    const isPublicMode = mode === "public";
    const router = useRouter();
    const { notification } = App.useApp();
    const [editForm] = Form.useForm<HouseholdEditForm>();
    const [createForm] = Form.useForm<HouseholdEditForm>();
    const [baseLayer, setBaseLayer] = useState<GoogleLayerKey>("streets");
    const [visibleTypes, setVisibleTypes] = useState<PovertyVisibilityKey[]>(["POOR", "NEAR_POOR", "NONE"]);
    const [visibleHeatLayers, setVisibleHeatLayers] = useState<HeatLayerKey[]>(["wardBoundary", "householdHeat", "supportHeat"]);
    const [activeMarkerId, setActiveMarkerId] = useState<string | null>(focusedMarkerId ?? null);
    const [focusRequestKey, setFocusRequestKey] = useState(0);
    const [photoGalleryMarker, setPhotoGalleryMarker] = useState<PovertyMarker | null>(null);
    const [assessmentTimelineMarker, setAssessmentTimelineMarker] = useState<PovertyMarker | null>(null);
    const [supportTimelineMarker, setSupportTimelineMarker] = useState<PovertyMarker | null>(null);
    const [selectedDetailMarker, setSelectedDetailMarker] = useState<PovertyMarker | null>(null);
    const [selectedDetail, setSelectedDetail] = useState<HouseholdDetailResponse | null>(null);
    const [selectedDetailPreviewUrls, setSelectedDetailPreviewUrls] = useState<PhotoPreviewMap>({});
    const [selectedDetailLoading, setSelectedDetailLoading] = useState(false);
    const [editingHousehold, setEditingHousehold] = useState<PovertyMarker | null>(null);
    const [savingHousehold, setSavingHousehold] = useState(false);
    const [creatingHousehold, setCreatingHousehold] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createSelectionMode, setCreateSelectionMode] = useState(false);
    const [createCoordinatePickerOpen, setCreateCoordinatePickerOpen] = useState(false);
    const [listSearch, setListSearch] = useState("");
    const [activeLeftTab, setActiveLeftTab] = useState<LeftPanelTabKey>("list");
    const [selectedAreaKey, setSelectedAreaKey] = useState<string | null>(null);
    const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
    const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
    const [editWardOptions, setEditWardOptions] = useState<WardOption[]>([]);
    const [editAreaOptions, setEditAreaOptions] = useState<PovertyArea[]>([]);
    const [createWardOptions, setCreateWardOptions] = useState<WardOption[]>([]);
    const [createAreaOptions, setCreateAreaOptions] = useState<PovertyArea[]>([]);
    const markerRefs = useRef<Record<string, L.Marker | null>>({});
    const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
    const activeFocusMarkerId = activeMarkerId ?? focusedMarkerId;
    const createLatitudeValue = Form.useWatch("latitude", createForm);
    const createLongitudeValue = Form.useWatch("longitude", createForm);
    const editProvinceCode = Form.useWatch("provinceCode", editForm);
    const editWardCode = Form.useWatch("wardCode", editForm);
    const createProvinceCode = Form.useWatch("provinceCode", createForm);
    const createWardCode = Form.useWatch("wardCode", createForm);

    const provinceSelectOptions = useMemo(
        () => provinceOptions.map((item) => ({ value: item.code, label: item.fullName || item.name })),
        [provinceOptions]
    );
    const editWardSelectOptions = useMemo(
        () => editWardOptions.map((item) => ({ value: item.code, label: item.fullName || item.name })),
        [editWardOptions]
    );
    const editAreaSelectOptions = useMemo(
        () => editAreaOptions.map((item) => ({ value: item.id, label: item.name })),
        [editAreaOptions]
    );
    const createWardSelectOptions = useMemo(
        () => createWardOptions.map((item) => ({ value: item.code, label: item.fullName || item.name })),
        [createWardOptions]
    );
    const createAreaSelectOptions = useMemo(
        () => createAreaOptions.map((item) => ({ value: item.id, label: item.name })),
        [createAreaOptions]
    );

    const loadProvinces = useCallback(async () => {
        const data = await api.get<{ items?: ProvinceOption[] }>(endpoints.poverty.locationProvinces);
        setProvinceOptions(data.items ?? []);
    }, []);

    const loadWards = useCallback(async (provinceCode: string, target: "edit" | "create") => {
        const data = await api.get<{ items?: WardOption[] }>(endpoints.poverty.locationWards(provinceCode));
        if (target === "edit") {
            setEditWardOptions(data.items ?? []);
        } else {
            setCreateWardOptions(data.items ?? []);
        }
    }, []);

    const loadAreas = useCallback(async (wardCode: string, target: "edit" | "create") => {
        const data = await api.get<{ items?: PovertyArea[] }>(endpoints.poverty.locationAreas(wardCode));
        if (target === "edit") {
            setEditAreaOptions(data.items ?? []);
        } else {
            setCreateAreaOptions(data.items ?? []);
        }
    }, []);

    useEffect(() => {
        if (focusedMarkerId) setActiveMarkerId(focusedMarkerId);
    }, [focusedMarkerId]);

    useEffect(() => {
        if (isPublicMode) return;
        void loadProvinces();
    }, [isPublicMode, loadProvinces]);

    useEffect(() => {
        if (isPublicMode) return;
        if (!editProvinceCode) return;
        void loadWards(String(editProvinceCode), "edit");
    }, [editProvinceCode, isPublicMode, loadWards]);

    useEffect(() => {
        if (isPublicMode) return;
        if (!editWardCode) {
            setEditAreaOptions([]);
            return;
        }
        void loadAreas(String(editWardCode), "edit");
    }, [editWardCode, isPublicMode, loadAreas]);

    useEffect(() => {
        if (isPublicMode) return;
        if (!createProvinceCode) return;
        void loadWards(String(createProvinceCode), "create");
    }, [createProvinceCode, isPublicMode, loadWards]);

    useEffect(() => {
        if (isPublicMode) return;
        if (!createWardCode) {
            setCreateAreaOptions([]);
            return;
        }
        void loadAreas(String(createWardCode), "create");
    }, [createWardCode, isPublicMode, loadAreas]);

    const areaSummaries = useMemo(
        () => buildPovertyMapAreaSummaries(markers),
        [markers]
    );
    const markersBySelectedArea = useMemo(
        () => filterPovertyMarkersBySelectedArea(markers, selectedAreaKey),
        [markers, selectedAreaKey]
    );
    const selectedAreaSummary = useMemo(
        () => areaSummaries.find((item) => item.key === selectedAreaKey) ?? null,
        [areaSummaries, selectedAreaKey]
    );
    const overallPoorCount = useMemo(
        () => areaSummaries.reduce((total, item) => total + item.poorCount, 0),
        [areaSummaries]
    );
    const overallNearPoorCount = useMemo(
        () => areaSummaries.reduce((total, item) => total + item.nearPoorCount, 0),
        [areaSummaries]
    );
    const validMarkers = useMemo(
        () => markersBySelectedArea.filter((marker) => toMarkerPosition(marker)),
        [markersBySelectedArea]
    );
    const visibleMarkers = useMemo(
        () => validMarkers.filter((marker) => {
            const povertyType = normalizePovertyType(marker.povertyType);
            return povertyType ? visibleTypes.includes(povertyType) : false;
        }),
        [validMarkers, visibleTypes]
    );
    const filteredListMarkers = useMemo(() => {
        const keyword = listSearch.trim().toLowerCase();
        if (!keyword) return markersBySelectedArea;

        return markersBySelectedArea.filter((marker) => {
            const searchableText = [
                marker.headFullName,
                marker.areaName,
                marker.wardName,
                marker.provinceName,
                marker.address,
            ].filter(Boolean).join(" ").toLowerCase();

            return searchableText.includes(keyword);
        });
    }, [listSearch, markersBySelectedArea]);
    const poorCount = useMemo(
        () => markersBySelectedArea.filter((item) => normalizePovertyType(item.povertyType) === "POOR").length,
        [markersBySelectedArea]
    );
    const nearPoorCount = useMemo(
        () => markersBySelectedArea.filter((item) => normalizePovertyType(item.povertyType) === "NEAR_POOR").length,
        [markersBySelectedArea]
    );
    const noneCount = useMemo(
        () => markersBySelectedArea.filter((item) => normalizePovertyType(item.povertyType) === "NONE").length,
        [markersBySelectedArea]
    );
    const visiblePoorCount = useMemo(
        () => visibleMarkers.filter((item) => normalizePovertyType(item.povertyType) === "POOR").length,
        [visibleMarkers]
    );
    const visibleNearPoorCount = useMemo(
        () => visibleMarkers.filter((item) => normalizePovertyType(item.povertyType) === "NEAR_POOR").length,
        [visibleMarkers]
    );
    const visibleNoneCount = useMemo(
        () => visibleMarkers.filter((item) => normalizePovertyType(item.povertyType) === "NONE").length,
        [visibleMarkers]
    );
    const memberTotals = useMemo(
        () => buildPovertyMemberTotalsFromMarkers(markers),
        [markers]
    );
    const supportedCount = useMemo(
        () => markersBySelectedArea.filter((item) => Number(item.supportCount ?? 0) > 0 || Number(item.supportTotalAmount ?? 0) > 0).length,
        [markersBySelectedArea]
    );
    const unsupportedCount = useMemo(
        () => Math.max(markersBySelectedArea.length - supportedCount, 0),
        [markersBySelectedArea.length, supportedCount]
    );
    const visibleSupportedCount = useMemo(
        () => visibleMarkers.filter((item) => Number(item.supportCount ?? 0) > 0 || Number(item.supportTotalAmount ?? 0) > 0).length,
        [visibleMarkers]
    );
    const supportRate = useMemo(
        () => markersBySelectedArea.length > 0 ? Math.round((supportedCount / markersBySelectedArea.length) * 100) : 0,
        [markersBySelectedArea.length, supportedCount]
    );
    const coordinateRate = useMemo(
        () => markersBySelectedArea.length > 0 ? Math.round((validMarkers.length / markersBySelectedArea.length) * 100) : 0,
        [markersBySelectedArea.length, validMarkers.length]
    );

    useEffect(() => {
        if (selectedAreaKey && !areaSummaries.some((item) => item.key === selectedAreaKey)) {
            setSelectedAreaKey(null);
        }
    }, [areaSummaries, selectedAreaKey]);

    useEffect(() => {
        if (activeMarkerId && !markersBySelectedArea.some((item) => item.id === activeMarkerId)) {
            setActiveMarkerId(null);
        }

        if (selectedDetailMarker?.id && !markersBySelectedArea.some((item) => item.id === selectedDetailMarker.id)) {
            setSelectedDetailMarker(null);
            setSelectedDetail(null);
            setSelectedDetailPreviewUrls({});
            setSelectedDetailLoading(false);
        }
    }, [activeMarkerId, markersBySelectedArea, selectedDetailMarker?.id]);

    const selectedGoogleLayer = GOOGLE_LAYERS[baseLayer];
    const selectedDetailPhotos = useMemo(
        () => selectedDetail?.fieldPhotos ?? [],
        [selectedDetail?.fieldPhotos]
    );
    const selectedDetailPhotoIds = useMemo(
        () => selectedDetailPhotos.map((photo) => photo.uuid).join("|"),
        [selectedDetailPhotos]
    );
    const mapGridClassName = leftPanelCollapsed
        ? "grid min-w-0 gap-4 bg-gray-50 p-4 2xl:grid-cols-[minmax(0,1fr)_320px]"
        : "grid min-w-0 gap-4 bg-gray-50 p-4 2xl:grid-cols-[360px_minmax(0,1fr)_320px]";
    const listTabLabel = (
        <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeLeftTab === "list"
                ? "bg-cyan-600 text-white shadow-sm"
                : "bg-cyan-50 text-cyan-700"
                }`}
        >
            <UsersRound size={14} />
            <span>Danh sách</span>
            <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${activeLeftTab === "list"
                    ? "bg-white/18 text-white"
                    : "bg-white text-cyan-700"
                    }`}
            >
                {markersBySelectedArea.length.toLocaleString("vi-VN")}
            </span>
        </span>
    );
    const areaTabLabel = (
        <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeLeftTab === "area"
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-sky-50 text-sky-700"
                }`}
        >
            <Home size={14} />
            <span>Khu vực</span>
            <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${activeLeftTab === "area"
                    ? "bg-white/18 text-white"
                    : "bg-white text-sky-700"
                    }`}
            >
                {areaSummaries.length.toLocaleString("vi-VN")}
            </span>
        </span>
    );

    const openMarkerDetailPanel = useCallback((marker: PovertyMarker) => {
        if (selectedDetailMarker?.id && selectedDetailMarker.id !== marker.id) {
            markerRefs.current[selectedDetailMarker.id]?.openTooltip();
        }
        setSelectedDetailMarker(marker);
        setSelectedDetail(null);
        setSelectedDetailPreviewUrls({});
        setSelectedDetailLoading(!isPublicMode);
        setActiveMarkerId(marker.id);
    }, [isPublicMode, markerRefs, selectedDetailMarker?.id]);

    const focusMarkerFromList = useCallback((marker: PovertyMarker) => {
        const position = toMarkerPosition(marker);
        if (!position) {
            notification.warning({ message: "Hộ này chưa cập nhật tọa độ" });
            return;
        }

        const povertyType = normalizePovertyType(marker.povertyType);
        if (povertyType && !visibleTypes.includes(povertyType)) {
            setVisibleTypes((current) => current.includes(povertyType) ? current : [...current, povertyType]);
        }
        setActiveMarkerId(marker.id);
        setFocusRequestKey((value) => value + 1);
        openMarkerDetailPanel(marker);
    }, [notification, openMarkerDetailPanel, visibleTypes]);

    const handleDragEnd = useCallback(async (marker: PovertyMarker, event: LeafletEvent) => {
        const target = event.target as L.Marker;
        const position = target.getLatLng();
        await onMarkerPositionChange(marker, Number(position.lat.toFixed(7)), Number(position.lng.toFixed(7)));
    }, [onMarkerPositionChange]);

    const closeMarkerDetailPanel = useCallback(() => {
        if (selectedDetailMarker?.id) {
            markerRefs.current[selectedDetailMarker.id]?.openTooltip();
        }
        setSelectedDetailMarker(null);
        setSelectedDetail(null);
        setSelectedDetailPreviewUrls({});
        setSelectedDetailLoading(false);
    }, [markerRefs, selectedDetailMarker?.id]);

    const openEditHousehold = useCallback((marker: PovertyMarker) => {
        setEditingHousehold(marker);
        editForm.setFieldsValue({
            code: marker.code ?? undefined,
            year: marker.year,
            povertyType: String(marker.povertyType ?? "POOR"),
            status: String(marker.status ?? "ACTIVE"),
            provinceCode: marker.provinceCode ?? undefined,
            wardCode: marker.wardCode ?? undefined,
            areaId: marker.areaId ?? undefined,
            address: marker.address ?? undefined,
        });
    }, [editForm]);

    const startCreateHousehold = useCallback(() => {
        setCreateModalOpen(false);
        setCreateCoordinatePickerOpen(false);
        setCreateSelectionMode(true);
        notification.info({
            message: "Chọn vị trí trên bản đồ",
            description: "Bấm lên bản đồ để lấy tọa độ và mở form thêm mới hộ.",
        });
    }, [notification]);

    const cancelCreateHouseholdSelection = useCallback(() => {
        setCreateSelectionMode(false);
    }, []);

    const handleCreatePointSelected = useCallback((latitude: number, longitude: number) => {
        setCreateSelectionMode(false);
        createForm.resetFields();
        createForm.setFieldsValue({
            year: currentYear,
            povertyType: "POOR",
            status: "ACTIVE",
            provinceCode: DEFAULT_CANTHO_PROVINCE_CODE,
            latitude,
            longitude,
        });
        setCreateCoordinatePickerOpen(false);
        setCreateModalOpen(true);
    }, [createForm]);

    const saveHousehold = useCallback(async () => {
        if (!editingHousehold) return;
        const values = await editForm.validateFields();
        setSavingHousehold(true);
        try {
            await api.patch(endpoints.poverty.household(editingHousehold.id), values);
            notification.success({ message: "Đã cập nhật thông tin hộ" });
            setEditingHousehold(null);
            await onRefresh();
        } catch (error) {
            notification.error({
                message: "Không thể cập nhật hộ",
                description: error instanceof ApiError ? error.message : "Vui lòng kiểm tra dữ liệu",
            });
        } finally {
            setSavingHousehold(false);
        }
    }, [editForm, editingHousehold, notification, onRefresh]);

    const saveCreatedHousehold = useCallback(async () => {
        const values = await createForm.validateFields();
        setCreatingHousehold(true);
        try {
            const response = await api.post<{ item?: PovertyMarker }>(endpoints.poverty.householdsFromMap, values);
            const createdHouseholdId = response.item?.id ?? null;
            const createdPovertyType = normalizePovertyType(String(values.povertyType ?? "POOR"));

            notification.success({ message: "Đã thêm mới hộ" });
            setCreateModalOpen(false);
            setCreateCoordinatePickerOpen(false);
            await onRefresh();

            if (createdPovertyType && !visibleTypes.includes(createdPovertyType)) {
                setVisibleTypes((current) => current.includes(createdPovertyType) ? current : [...current, createdPovertyType]);
            }
            if (createdHouseholdId) {
                setActiveMarkerId(createdHouseholdId);
                setFocusRequestKey((value) => value + 1);
            }
        } catch (error) {
            notification.error({
                message: "Không thể thêm mới hộ",
                description: error instanceof ApiError ? error.message : "Vui lòng kiểm tra dữ liệu",
            });
        } finally {
            setCreatingHousehold(false);
        }
    }, [createForm, notification, onRefresh, visibleTypes]);

    useEffect(() => {
        if (isPublicMode) {
            setSelectedDetailLoading(false);
            return;
        }
        if (!selectedDetailMarker?.id) return;

        let cancelled = false;
        void api.get<HouseholdDetailResponse>(endpoints.poverty.household(selectedDetailMarker.id))
            .then((data) => {
                if (!cancelled) setSelectedDetail(data);
            })
            .catch((error) => {
                if (cancelled) return;
                notification.error({
                    message: "Không thể tải chi tiết hộ trên bản đồ",
                    description: error instanceof ApiError ? error.message : "Vui lòng thử lại",
                });
            })
            .finally(() => {
                if (!cancelled) setSelectedDetailLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isPublicMode, notification, selectedDetailMarker?.id]);

    useEffect(() => {
        if (isPublicMode) return;
        if (selectedDetailPhotos.length === 0) return;

        let cancelled = false;
        void fetchPhotoPreviewUrls(selectedDetailPhotos).then((urls) => {
            if (!cancelled) setSelectedDetailPreviewUrls(urls);
        });

        return () => {
            cancelled = true;
        };
    }, [isPublicMode, selectedDetailPhotoIds, selectedDetailPhotos]);

    return (
        <>
            <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-gray-800">Bản đồ hộ nghèo/cận nghèo</h3>
                    </div>
                </div>

                <div className={mapGridClassName}>
                    <aside className={`order-2 min-w-0 space-y-4 xl:order-1 ${leftPanelCollapsed ? "xl:hidden" : ""}`}>
                        <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                                <div className="min-w-0">
                                    <h4 className="text-sm font-semibold text-gray-800">Hộ và khu vực</h4>
                                    <p className="mt-1 text-xs text-gray-500">
                                        {selectedAreaSummary
                                            ? `${selectedAreaSummary.areaName} • ${markersBySelectedArea.length.toLocaleString("vi-VN")} hộ theo bộ lọc`
                                            : `${markers.length.toLocaleString("vi-VN")} hộ theo bộ lọc hiện tại`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {canCreateHousehold ? (
                                        <Tooltip title={createSelectionMode ? "Hủy chọn vị trí thêm hộ" : "Thêm mới hộ"}>
                                            <Button
                                                aria-label={createSelectionMode ? "Hủy chọn vị trí thêm hộ" : "Thêm mới hộ"}
                                                icon={<MapPinPlus size={16} />}
                                                type={createSelectionMode ? "primary" : "default"}
                                                onClick={() => {
                                                    if (createSelectionMode) {
                                                        cancelCreateHouseholdSelection();
                                                        return;
                                                    }
                                                    startCreateHousehold();
                                                }}
                                            />
                                        </Tooltip>
                                    ) : null}
                                    <Tooltip title="Tải lại danh sách">
                                        <Button aria-label="Tải lại danh sách hộ" icon={<RotateCcw size={16} />} loading={loading} onClick={onRefresh} />
                                    </Tooltip>
                                </div>
                            </div>
                            <Tabs
                                activeKey={activeLeftTab}
                                onChange={(value) => setActiveLeftTab(value as LeftPanelTabKey)}
                                className="poverty-map-left-tabs px-3 pt-3"
                                centered
                                tabBarGutter={8}
                                items={[
                                    {
                                        key: "list",
                                        label: listTabLabel,
                                        children: (
                                            <>
                                                <div className="border-b border-gray-100 bg-white px-3 py-3">
                                                    <Input
                                                        allowClear
                                                        value={listSearch}
                                                        prefix={<Search size={15} className="text-gray-400" />}
                                                        placeholder="Tìm tên chủ hộ hoặc khu vực"
                                                        onChange={(event) => setListSearch(event.target.value)}
                                                    />
                                                </div>

                                                <div className="max-h-[420px] space-y-2 overflow-y-auto bg-gray-50 p-3 md:max-h-[620px]">
                                                    {filteredListMarkers.length > 0 ? filteredListMarkers.map((marker) => {
                                                        const position = toMarkerPosition(marker);
                                                        const normalizedType = normalizePovertyType(marker.povertyType);
                                                        const isPoor = normalizedType === "POOR";
                                                        const isActive = marker.id === activeFocusMarkerId;
                                                        const area = [marker.provinceName, marker.wardName, marker.areaName].filter(Boolean).join(" / ");
                                                        const toneClassName = normalizedType === "POOR"
                                                            ? "border-red-200 bg-red-50/70 hover:border-red-300 hover:bg-red-50"
                                                            : normalizedType === "NEAR_POOR"
                                                                ? "border-amber-200 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-50"
                                                                : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-50";
                                                        const activeClassName = normalizedType === "POOR"
                                                            ? "border-red-500 ring-2 ring-red-100"
                                                            : normalizedType === "NEAR_POOR"
                                                                ? "border-amber-500 ring-2 ring-amber-100"
                                                                : "border-slate-500 ring-2 ring-slate-100";

                                                        return (
                                                            <div
                                                                key={marker.id}
                                                                role="button"
                                                                tabIndex={0}
                                                                className={`w-full rounded-lg border p-3 text-left shadow-sm transition ${isActive ? activeClassName : toneClassName}`}
                                                                onClick={() => focusMarkerFromList(marker)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Enter" || event.key === " ") {
                                                                        event.preventDefault();
                                                                        focusMarkerFromList(marker);
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex min-w-0 items-start justify-between gap-1">
                                                                    <div className="min-w-0">
                                                                        <div className="truncate text-sm font-semibold text-gray-900">{marker.code || `Hộ #${marker.id}`}</div>
                                                                        <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-gray-600">
                                                                            <UserRound size={15} strokeWidth={1.9} className="shrink-0" />
                                                                            <div className="truncate text-sm font-semibold text-gray-500">{marker.headFullName || "Chưa có thông tin chủ hộ"}</div>
                                                                        </div>

                                                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                                            <Tag className="m-0" color={isPoor ? "red" : normalizedType === "NEAR_POOR" ? "gold" : "default"}>{povertyTypeLabel(marker.povertyType)}</Tag>
                                                                            <Tag className="m-0" color={marker.status === "ACTIVE" ? "green" : "default"}>{householdStatusLabel(marker.status)}</Tag>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex shrink-0 items-center gap-1">
                                                                        {canViewHouseholdDetail ? (
                                                                            <Tooltip title="Xem chi tiết hộ">
                                                                                <Button
                                                                                    className="rounded-full"
                                                                                    type="text"
                                                                                    aria-label="Xem chi tiết hộ"
                                                                                    icon={<ActionIcon action="view" />}
                                                                                    onClick={(event) => {
                                                                                        event.stopPropagation();
                                                                                        router.push(`/ho-ngheo/${marker.id}?from=map&householdId=${marker.id}`);
                                                                                    }}
                                                                                />
                                                                            </Tooltip>
                                                                        ) : null}
                                                                        {canUpdateHousehold ? (
                                                                            <Tooltip title="Sửa thông tin hộ">
                                                                                <Button
                                                                                    className="rounded-full"
                                                                                    type="text"
                                                                                    aria-label="Sửa thông tin hộ"
                                                                                    icon={<ActionIcon action="edit" />}
                                                                                    onClick={(event) => {
                                                                                        event.stopPropagation();
                                                                                        openEditHousehold(marker);
                                                                                    }}
                                                                                />
                                                                            </Tooltip>
                                                                        ) : null}
                                                                    </div>
                                                                </div>

                                                                <div className="mt-3 space-y-1 text-xs text-gray-600">
                                                                    <div className="line-clamp-2">{area || "Chưa có địa bàn"}</div>
                                                                    <div className="line-clamp-2">{marker.address || "Chưa có địa chỉ"}</div>
                                                                </div>

                                                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                                                    {position ? (
                                                                        <div className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                                                                            <LocateFixed size={14} />
                                                                            Zoom tới điểm
                                                                        </div>
                                                                    ) : (
                                                                        <span />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    }) : (
                                                        <div className="rounded-lg bg-white py-8">
                                                            <Empty description={markersBySelectedArea.length > 0 ? "Không tìm thấy hộ phù hợp" : "Chưa có dữ liệu hộ"} />
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ),
                                    },
                                    {
                                        key: "area",
                                        label: areaTabLabel,
                                        children: (
                                            <div className="max-h-[490px] space-y-3 overflow-y-auto bg-gray-50 p-3 md:max-h-[690px]">
                                                <button
                                                    type="button"
                                                    className={`w-full rounded-xl border p-3 text-left shadow-sm transition ${!selectedAreaKey
                                                        ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
                                                        : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40"
                                                        }`}
                                                    onClick={() => setSelectedAreaKey(null)}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-sm font-semibold text-slate-900">Tất cả khu vực</div>
                                                            <p className="mt-1 text-xs text-slate-500">Tổng quan toàn bộ khu vực theo bộ lọc hiện tại</p>
                                                        </div>
                                                        <span className="rounded-full bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white">
                                                            {markers.length.toLocaleString("vi-VN")}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                                        <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
                                                            Hộ nghèo: <span className="font-semibold">{overallPoorCount.toLocaleString("vi-VN")}</span>
                                                        </div>
                                                        <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
                                                            Cận nghèo: <span className="font-semibold">{overallNearPoorCount.toLocaleString("vi-VN")}</span>
                                                        </div>
                                                    </div>
                                                </button>

                                                {areaSummaries.length > 0 ? areaSummaries.map((summary) => {
                                                    const isActive = summary.key === selectedAreaKey;

                                                    return (
                                                        <button
                                                            key={summary.key}
                                                            type="button"
                                                            className={`w-full rounded-xl border p-3 text-left shadow-sm transition ${isActive
                                                                ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
                                                                : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40"
                                                                }`}
                                                            onClick={() => setSelectedAreaKey(summary.key)}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-semibold text-slate-900">{summary.areaName}</div>
                                                                </div>
                                                                <span className="rounded-full bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white">
                                                                    {summary.totalCount.toLocaleString("vi-VN")}
                                                                </span>
                                                            </div>
                                                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                                                <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
                                                                    Hộ nghèo: <span className="font-semibold">{summary.poorCount.toLocaleString("vi-VN")}</span>
                                                                </div>
                                                                <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
                                                                    Cận nghèo: <span className="font-semibold">{summary.nearPoorCount.toLocaleString("vi-VN")}</span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                }) : (
                                                    <div className="rounded-lg bg-white py-8">
                                                        <Empty description="Chưa có dữ liệu khu vực" />
                                                    </div>
                                                )}
                                            </div>
                                        ),
                                    },
                                ]}
                            />
                        </div>
                    </aside>

                    <div className={`relative order-1 h-[500px] min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white md:h-[750px] xl:order-2 ${createSelectionMode ? "poverty-map--create-mode" : ""}`}>
                        {createSelectionMode ? (
                            <div className="pointer-events-none absolute inset-x-4 top-4 z-[530] flex justify-center">
                                <div className="pointer-events-auto flex max-w-[520px] items-center gap-3 rounded-xl border border-blue-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                        <MapPinPlus size={18} />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900">Chọn vị trí để thêm mới hộ</p>
                                        <p className="text-xs text-gray-500">Bấm trực tiếp lên bản đồ để lấy tọa độ và mở form thêm mới.</p>
                                    </div>
                                    <Button size="small" onClick={cancelCreateHouseholdSelection}>Hủy</Button>
                                </div>
                            </div>
                        ) : null}
                        <MarkerDetailPanel
                            marker={selectedDetailMarker}
                            mode={mode}
                            detail={selectedDetail}
                            loading={selectedDetailLoading}
                            previewUrls={selectedDetailPreviewUrls}
                            canViewHouseholdDetail={canViewHouseholdDetail}
                            canUpdateHousehold={canUpdateHousehold}
                            onClose={closeMarkerDetailPanel}
                            onViewHousehold={(marker) => router.push(`/ho-ngheo/${marker.id}?from=map&householdId=${marker.id}`)}
                            onOpenPhotoGallery={setPhotoGalleryMarker}
                            onOpenAssessmentTimeline={setAssessmentTimelineMarker}
                            onOpenSupportTimeline={setSupportTimelineMarker}
                            onEditHousehold={openEditHousehold}
                        />
                        <div className="pointer-events-none absolute left-2 top-1/2 z-[530] -translate-y-1/2">
                            <Tooltip title={leftPanelCollapsed ? "Mở rộng danh sách bên trái" : "Thu gọn danh sách bên trái"}>
                                <Button
                                    type="default"
                                    size="medium"
                                    className="pointer-events-auto shadow-md"
                                    icon={leftPanelCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                                    onClick={() => setLeftPanelCollapsed((value) => !value)}
                                />
                            </Tooltip>
                        </div>
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
                                url={`https://{s}.google.com/vt/lyrs=${selectedGoogleLayer.layer}&hl=vi&x={x}&y={y}&z={z}`}
                                subdomains={GOOGLE_SUBDOMAINS}
                                maxZoom={21}
                                attribution="Map data &copy; Google"
                            />
                            <WardBoundaryLayer
                                visible={visibleHeatLayers.includes("wardBoundary")}
                                suppressLabels={createSelectionMode}
                            />
                            <HeatmapLayer
                                markers={visibleMarkers}
                                visible={visibleHeatLayers.includes("householdHeat")}
                                radius={28}
                                blur={22}
                                minOpacity={0.2}
                                max={1}
                                gradient={{
                                    0.2: "#fcd34d",
                                    0.45: "#fb923c",
                                    0.7: "#f97316",
                                    1: "#dc2626",
                                }}
                                weightResolver={getHouseholdHeatWeight}
                            />
                            <HeatmapLayer
                                markers={visibleMarkers}
                                visible={visibleHeatLayers.includes("supportHeat")}
                                radius={24}
                                blur={18}
                                minOpacity={0.18}
                                max={1}
                                gradient={{
                                    0.2: "#67e8f9",
                                    0.45: "#34d399",
                                    0.7: "#10b981",
                                    1: "#0f766e",
                                }}
                                weightResolver={getSupportHeatWeight}
                            />
                            <ScaleControl position="bottomleft" />
                            <FitBoundsControl markers={visibleMarkers} disabled={Boolean(activeFocusMarkerId)} />
                            <MapLayerControls
                                visibleTypes={visibleTypes}
                                visibleHeatLayers={visibleHeatLayers}
                                visibleCount={visibleMarkers.length}
                                supportedCount={visibleSupportedCount}
                                unsupportedCount={Math.max(visibleMarkers.length - visibleSupportedCount, 0)}
                                onVisibleHeatLayersChange={setVisibleHeatLayers}
                                onVisibleTypesChange={setVisibleTypes}
                            />
                            <MapActions
                                baseLayer={baseLayer}
                                markers={visibleMarkers}
                                loading={loading}
                                canCreateHousehold={canCreateHousehold}
                                canCreateHouseholdOnMap={canCreateHouseholdOnMap}
                                canEditMarkerPosition={canEditMarkerPosition}
                                createSelectionMode={createSelectionMode}
                                onCreateHouseholdClick={() => {
                                    if (createSelectionMode) {
                                        cancelCreateHouseholdSelection();
                                        return;
                                    }
                                    startCreateHousehold();
                                }}
                                onBaseLayerChange={setBaseLayer}
                                onRefresh={onRefresh}
                            />
                            <HouseholdCreatePointPicker
                                enabled={createSelectionMode}
                                onSelect={handleCreatePointSelected}
                            />
                            <ClusteredMarkers
                                markers={visibleMarkers}
                                markerRefs={markerRefs}
                                clusterGroupRef={clusterGroupRef}
                                onMarkerSelect={openMarkerDetailPanel}
                                onMarkerDragEnd={(marker, event) => void handleDragEnd(marker, event)}
                                onOpenPhotoGallery={setPhotoGalleryMarker}
                                onOpenAssessmentTimeline={setAssessmentTimelineMarker}
                                onOpenSupportTimeline={setSupportTimelineMarker}
                                canEditMarkerPosition={canEditMarkerPosition}
                                canViewAssessmentTimeline={canViewAssessmentTimeline}
                            />
                            <FocusMarkerControl
                                focusedMarkerId={activeFocusMarkerId}
                                focusRequestKey={focusRequestKey}
                                markers={visibleMarkers}
                                markerRefs={markerRefs}
                                clusterGroupRef={clusterGroupRef}
                            />
                            <MapResizeOnLayoutChange resizeKey={leftPanelCollapsed ? "collapsed" : "expanded"} />
                        </MapContainer>
                    </div>

                    <aside className="order-3 min-w-0 space-y-4">
                        <div className="overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Hộ nghèo/cận nghèo</p>
                                    <h4 className="mt-1 text-sm font-semibold text-slate-900">Tổng số hộ: {markersBySelectedArea.length.toLocaleString("vi-VN")}</h4>
                                    <p className="mt-1 text-xs text-slate-600">Đang hiển thị trên bản đồ: {visibleMarkers.length.toLocaleString("vi-VN")} hộ</p>
                                </div>
                                <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                                    {markersBySelectedArea.length > 0 ? `${Math.round((visibleMarkers.length / markersBySelectedArea.length) * 100)}%` : "0%"}
                                </div>
                            </div>

                            <div className="mt-3 grid gap-2">
                                <div className="rounded-lg border border-red-100 bg-white/90 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-medium text-red-600">Hộ nghèo</span>
                                        <span className="font-semibold text-slate-800">{poorCount.toLocaleString("vi-VN")} (đang hiển thị {visiblePoorCount.toLocaleString("vi-VN")})</span>
                                    </div>
                                </div>
                                <div className="rounded-lg border border-amber-100 bg-white/90 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-medium text-amber-600">Hộ cận nghèo</span>
                                        <span className="font-semibold text-slate-800">{nearPoorCount.toLocaleString("vi-VN")} (đang hiển thị {visibleNearPoorCount.toLocaleString("vi-VN")})</span>
                                    </div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-medium text-slate-600">Thoát nghèo</span>
                                        <span className="font-semibold text-slate-800">{noneCount.toLocaleString("vi-VN")} (đang hiển thị {visibleNoneCount.toLocaleString("vi-VN")})</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-rose-50 p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Nhân khẩu nhóm hộ mục tiêu</p>
                                    <h4 className="mt-1 text-sm font-semibold text-slate-900">
                                        Tổng nhân khẩu: {formatNumber(memberTotals.total)}
                                    </h4>
                                </div>
                            </div>

                            <div className="mt-3 grid gap-2">
                                <div className="rounded-lg border border-rose-100 bg-white/90 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-medium text-rose-600">Nhân khẩu hộ nghèo</span>
                                        <span className="font-semibold text-slate-800">{formatNumber(memberTotals.poor)}</span>
                                    </div>
                                </div>
                                <div className="rounded-lg border border-orange-100 bg-white/90 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-medium text-orange-600">Nhân khẩu cận nghèo</span>
                                        <span className="font-semibold text-slate-800">{formatNumber(memberTotals.nearPoor)}</span>
                                    </div>
                                </div>
                                <div className="rounded-lg border border-violet-100 bg-white/90 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-medium text-violet-600">Tổng nhân khẩu mục tiêu</span>
                                        <span className="font-semibold text-slate-800">{formatNumber(memberTotals.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4 shadow-sm">
                            <h4 className="text-sm font-semibold text-slate-900">Theo dõi hỗ trợ</h4>
                            <div className="mt-3 space-y-3 text-xs text-slate-700">
                                <div className="rounded-lg border border-white/70 bg-white/80 p-3">
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <span className="font-medium text-emerald-700">Tình hình hỗ trợ</span>
                                        <span className="font-semibold">{supportedCount.toLocaleString("vi-VN")} / {markersBySelectedArea.length.toLocaleString("vi-VN")} ({supportRate}%)</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
                                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${supportRate}%` }} />
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-600">Chưa hỗ trợ: {unsupportedCount.toLocaleString("vi-VN")} hộ</p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-blue-100 via-teal-50 to-indigo-50 p-4 shadow-sm">
                            <h4 className="text-sm font-semibold text-slate-900">Tọa độ</h4>
                            <div className="mt-3 space-y-3 text-xs text-slate-700">
                                <div className="rounded-lg border border-white/70 bg-white/80 p-3">
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <span className="font-medium text-blue-700">Tiến độ cập nhật tọa độ</span>
                                        <span className="font-semibold">{validMarkers.length.toLocaleString("vi-VN")} / {markersBySelectedArea.length.toLocaleString("vi-VN")} ({coordinateRate}%)</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${coordinateRate}%` }} />
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-600">Chưa có tọa độ: {Math.max(markersBySelectedArea.length - validMarkers.length, 0).toLocaleString("vi-VN")} hộ</p>
                                </div>
                            </div>
                        </div>

                    </aside>
                </div>
            </div>
            {!isPublicMode ? (
                <>
                    <FieldPhotoGalleryModal
                        marker={photoGalleryMarker}
                        open={Boolean(photoGalleryMarker)}
                        onClose={() => setPhotoGalleryMarker(null)}
                    />
                    <PovertyAssessmentTimelineModal
                        household={assessmentTimelineMarker}
                        open={Boolean(assessmentTimelineMarker)}
                        onClose={() => setAssessmentTimelineMarker(null)}
                    />
                    <PovertySupportTimelineModal
                        household={supportTimelineMarker}
                        open={Boolean(supportTimelineMarker)}
                        onClose={() => setSupportTimelineMarker(null)}
                    />
                </>
            ) : null}
            <Modal
                title="Thêm mới hộ"
                open={createModalOpen}
                onCancel={() => {
                    setCreateModalOpen(false);
                    setCreateCoordinatePickerOpen(false);
                }}
                onOk={saveCreatedHousehold}
                confirmLoading={creatingHousehold}
                width={900}
                style={{ maxWidth: "calc(100vw - 32px)" }}
                styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowX: "hidden", overflowY: "auto" } }}
                okText="Lưu"
                cancelText="Hủy"
            >
                <Form form={createForm} layout="vertical" className="[&_.ant-form-item]:mb-0">
                    <div className="space-y-5">
                        <section className="min-w-0">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Thông tin hộ</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} md={8}><Form.Item name="code" label="Mã hộ"><Input /></Form.Item></Col>
                                <Col xs={24} sm={12} md={6}><Form.Item name="povertyType" label="Loại hộ" rules={[{ required: true }]}><Select options={povertyTypeOptions} /></Form.Item></Col>
                                <Col xs={24} sm={12} md={6}><Form.Item name="status" label="Trạng thái"><Select options={householdStatusOptions} /></Form.Item></Col>
                                <Col xs={24} sm={12} md={4}><Form.Item name="year" label="Năm" rules={[{ required: true }]}><InputNumber className="w-full" min={1900} max={2200} /></Form.Item></Col>
                            </Row>
                        </section>

                        <section className="min-w-0 border-t border-gray-100 pt-4">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Địa bàn cư trú</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="provinceCode" label="Tỉnh/Thành phố" rules={[{ required: true }]}>
                                        <Select
                                            showSearch
                                            optionFilterProp="label"
                                            options={provinceSelectOptions}
                                            onChange={() => createForm.setFieldsValue({ wardCode: undefined, areaId: undefined })}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="wardCode" label="Xã/Phường" rules={[{ required: true }]}>
                                        <Select
                                            showSearch
                                            optionFilterProp="label"
                                            options={createWardSelectOptions}
                                            onChange={() => createForm.setFieldsValue({ areaId: undefined })}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="areaId" label="Thôn/Khu vực" rules={[{ required: true }]}>
                                        <Select showSearch optionFilterProp="label" options={createAreaSelectOptions} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24}><Form.Item name="address" label="Địa chỉ cụ thể"><Input /></Form.Item></Col>
                            </Row>
                        </section>

                        <section className="min-w-0 border-t border-gray-100 pt-4">
                            <div className="mb-3">
                                <div>
                                    <div className="text-sm font-semibold text-gray-800">Tọa độ bản đồ</div>
                                    <p className="mt-1 text-xs text-gray-500">Đã lấy từ vị trí vừa chọn trên bản đồ. Có thể chỉnh lại thủ công hoặc chọn lại trên mini map.</p>
                                </div>
                            </div>
                            <Row align="bottom" gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={8} lg={8}><Form.Item name="latitude" label="Vĩ độ" rules={[{ required: true }]}><InputNumber className="w-full" style={{ width: "100%" }} min={-90} max={90} precision={7} /></Form.Item></Col>
                                <Col xs={24} sm={12} md={8} lg={8}><Form.Item name="longitude" label="Kinh độ" rules={[{ required: true }]}><InputNumber className="w-full" style={{ width: "100%" }} min={-180} max={180} precision={7} /></Form.Item></Col>
                                <Col xs={24} md={8} lg={8}>
                                    <Button
                                        className="w-full"
                                        icon={<LocateFixed size={16} />}
                                        onClick={() => setCreateCoordinatePickerOpen((value) => !value)}
                                    >
                                        {createCoordinatePickerOpen ? "Ẩn bản đồ" : "Chọn lại trên bản đồ"}
                                    </Button>
                                </Col>
                            </Row>
                            {createCoordinatePickerOpen ? (
                                <div className="mt-4">
                                    <PovertyCoordinatePicker
                                        latitude={typeof createLatitudeValue === "number" ? createLatitudeValue : null}
                                        longitude={typeof createLongitudeValue === "number" ? createLongitudeValue : null}
                                        onChange={(latitude, longitude) => createForm.setFieldsValue({ latitude, longitude })}
                                    />
                                </div>
                            ) : null}
                        </section>
                    </div>
                </Form>
            </Modal>
            <Modal
                title="Cập nhật thông tin hộ"
                open={Boolean(editingHousehold)}
                onCancel={() => setEditingHousehold(null)}
                onOk={saveHousehold}
                confirmLoading={savingHousehold}
                width={820}
                style={{ maxWidth: "calc(100vw - 32px)" }}
                styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowX: "hidden", overflowY: "auto" } }}
                okText="Lưu"
                cancelText="Hủy"
            >
                <Form form={editForm} layout="vertical" className="[&_.ant-form-item]:mb-0">
                    <div className="space-y-5">
                        <section className="min-w-0">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Thông tin hộ</div>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} md={8}><Form.Item name="code" label="Mã hộ"><Input /></Form.Item></Col>

                                <Col xs={24} sm={12} md={6}><Form.Item name="povertyType" label="Loại hộ" rules={[{ required: true }]}><Select options={povertyTypeOptions} /></Form.Item></Col>
                                <Col xs={24} sm={12} md={6}><Form.Item name="status" label="Trạng thái"><Select options={householdStatusOptions} /></Form.Item></Col>
                                <Col xs={24} sm={12} md={4}><Form.Item name="year" label="Năm" rules={[{ required: true }]}><InputNumber className="w-full" min={1900} max={2200} /></Form.Item></Col>
                            </Row>
                        </section>

                        <section className="min-w-0 border-t border-gray-100 pt-4">
                            <div className="mb-3 text-sm font-semibold text-gray-800">Địa bàn cư trú</div>
                            {editingHousehold && hasUnresolvedStandardizedLocation(editingHousehold) ? (
                                <Alert
                                    className="mb-4"
                                    type="warning"
                                    showIcon
                                    message="Địa bàn cũ chưa chuẩn hóa hoàn toàn, vui lòng chọn lại theo danh mục chuẩn."
                                    description={[editingHousehold.provinceName, editingHousehold.wardName, editingHousehold.areaName].filter(Boolean).join(" / ")}
                                />
                            ) : null}
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="provinceCode" label="Tỉnh/Thành phố" rules={[{ required: true }]}>
                                        <Select
                                            showSearch
                                            optionFilterProp="label"
                                            options={provinceSelectOptions}
                                            onChange={() => editForm.setFieldsValue({ wardCode: undefined, areaId: undefined })}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="wardCode" label="Xã/Phường" rules={[{ required: true }]}>
                                        <Select
                                            showSearch
                                            optionFilterProp="label"
                                            options={editWardSelectOptions}
                                            onChange={() => editForm.setFieldsValue({ areaId: undefined })}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} md={8}>
                                    <Form.Item name="areaId" label="Thôn/Khu vực" rules={[{ required: true }]}>
                                        <Select showSearch optionFilterProp="label" options={editAreaSelectOptions} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24}><Form.Item name="address" label="Địa chỉ cụ thể"><Input /></Form.Item></Col>
                            </Row>
                        </section>
                    </div>
                </Form>
            </Modal>
        </>
    );
}
