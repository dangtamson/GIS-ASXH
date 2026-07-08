"use client";

"use client";

import { COLLECTION_MAP_LAYER_Z_INDEX } from "@/components/poverty/collection/poverty-collection-utils";
import { getValidGeoPosition } from "@/components/poverty/poverty-utils";
import { App, Button, Tooltip } from "antd";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

type PovertyCoordinatePickerProps = {
    latitude?: number | null;
    longitude?: number | null;
    onChange: (latitude: number, longitude: number) => void;
};

const DEFAULT_CENTER: [number, number] = [10.0452, 105.7469];
const DEFAULT_ZOOM = 13;
const GOOGLE_SUBDOMAINS = ["mt0", "mt1", "mt2", "mt3"];
const pickerIcon = L.divIcon({
    className: "poverty-coordinate-picker-marker",
    html: '<span style="display:block;width:20px;height:20px;border-radius:999px;background:#1677ff;border:4px solid #dbeafe;box-shadow:0 8px 22px rgba(15,23,42,.32);"></span>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
});

function MapClickHandler({ onChange }: { onChange: (latitude: number, longitude: number) => void }) {
    useMapEvents({
        click: (event) => {
            onChange(Number(event.latlng.lat.toFixed(7)), Number(event.latlng.lng.toFixed(7)));
        },
    });

    return null;
}

function SyncMapView({ position }: { position: [number, number] | null }) {
    const map = useMap();

    useEffect(() => {
        window.setTimeout(() => map.invalidateSize(), 80);
    }, [map]);

    useEffect(() => {
        if (!position) return;
        map.flyTo(position, Math.max(map.getZoom(), 16), { duration: 0.7 });
    }, [map, position]);

    return null;
}

function CurrentLocationControl({ onChange }: { onChange: (latitude: number, longitude: number) => void }) {
    const { notification } = App.useApp();
    const map = useMap();
    const [locating, setLocating] = useState(false);

    const locateCurrentPosition = useCallback(() => {
        if (!navigator.geolocation) {
            notification.warning({ message: "Trình duyệt không hỗ trợ định vị hiện tại" });
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latitude = Number(position.coords.latitude.toFixed(7));
                const longitude = Number(position.coords.longitude.toFixed(7));
                onChange(latitude, longitude);
                map.flyTo([latitude, longitude], Math.max(map.getZoom(), 17), { duration: 0.8 });
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
    }, [map, notification, onChange]);

    return (
        <div className="leaflet-top leaflet-right">
            <div className="leaflet-control rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                <Tooltip title="Lấy vị trí hiện tại" placement="left">
                    <Button aria-label="Lấy vị trí hiện tại" icon={<LocateFixed size={16} />} loading={locating} onClick={locateCurrentPosition} />
                </Tooltip>
            </div>
        </div>
    );
}

export default function PovertyCoordinatePicker({
    latitude,
    longitude,
    onChange,
}: PovertyCoordinatePickerProps) {
    const position = getValidGeoPosition(latitude, longitude);
    const markerPosition: [number, number] | null = position ? [position.latitude, position.longitude] : null;

    return (
        <div
            className="relative min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white"
            style={{ zIndex: COLLECTION_MAP_LAYER_Z_INDEX }}
        >
            <div className="border-b border-gray-100 px-3 py-2 text-xs text-gray-500">
                Click trên bản đồ hoặc kéo marker để cập nhật vĩ độ, kinh độ.
            </div>
            <div className="relative h-[260px] min-w-0" style={{ zIndex: COLLECTION_MAP_LAYER_Z_INDEX }}>
                <MapContainer
                    center={markerPosition ?? DEFAULT_CENTER}
                    zoom={markerPosition ? 16 : DEFAULT_ZOOM}
                    minZoom={3}
                    maxZoom={21}
                    scrollWheelZoom
                    className="h-full w-full"
                    attributionControl={false}
                >
                    <TileLayer
                        url="https://{s}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}"
                        subdomains={GOOGLE_SUBDOMAINS}
                        maxZoom={21}
                        attribution="Map data &copy; Google"
                    />
                    <MapClickHandler onChange={onChange} />
                    <SyncMapView position={markerPosition} />
                    <CurrentLocationControl onChange={onChange} />
                    {markerPosition ? (
                        <Marker
                            position={markerPosition}
                            icon={pickerIcon}
                            draggable
                            eventHandlers={{
                                dragend: (event) => {
                                    const nextPosition = event.target.getLatLng();
                                    onChange(Number(nextPosition.lat.toFixed(7)), Number(nextPosition.lng.toFixed(7)));
                                },
                            }}
                        />
                    ) : null}
                </MapContainer>
            </div>
        </div>
    );
}
