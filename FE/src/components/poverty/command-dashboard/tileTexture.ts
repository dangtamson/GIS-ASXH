import { useEffect, useState } from "react";
import {
    CanvasTexture,
    LinearFilter,
    SRGBColorSpace,
    type Texture,
} from "three";
import type { CommandMapBaseLayer } from "./useCommandDashboardStore";

type GeoFeature = {
    geometry: {
        coordinates: number[][][][];
    };
};

type GeoJsonData = {
    features: GeoFeature[];
};

const TILE_SIZE = 256;
const DEFAULT_ZOOM = 11;
const SELECTED_REGION_ZOOM = 14;
const MAX_TEXTURE_SIZE = 2048;

const googleLayerByBaseLayer: Record<CommandMapBaseLayer, string> = {
    terrain: "p",
    roadmap: "m",
    satellite: "s",
};

const tileUrl = (x: number, y: number, z: number, baseLayer: CommandMapBaseLayer) =>
    `/api/map-tiles/google/${z}/${x}/${y}?lyrs=${googleLayerByBaseLayer[baseLayer]}`;

export function useCanThoTileTexture(data: GeoJsonData, baseLayer: CommandMapBaseLayer, zoom = DEFAULT_ZOOM) {
    const [texture, setTexture] = useState<Texture | null>(null);

    useEffect(() => {
        let disposed = false;
        let activeTexture: Texture | null = null;

        createTileTexture(data, baseLayer, zoom)
            .then((nextTexture) => {
                if (disposed) {
                    nextTexture.dispose();
                    return;
                }

                activeTexture = nextTexture;
                setTexture(nextTexture);
            })
            .catch((error) => {
                console.warn("Không tải được tile nền bản đồ 3D", error);
                setTexture(null);
            });

        return () => {
            disposed = true;
            activeTexture?.dispose();
        };
    }, [data, baseLayer, zoom]);

    return texture;
}

export const commandMapTileZoom = {
    default: DEFAULT_ZOOM,
    selectedRegion: SELECTED_REGION_ZOOM,
} as const;

async function createTileTexture(data: GeoJsonData, baseLayer: CommandMapBaseLayer, zoom: number) {
    const bounds = getMercatorPixelBounds(data, zoom);
    const width = Math.max(1, Math.ceil(bounds.maxX - bounds.minX));
    const height = Math.max(1, Math.ceil(bounds.maxY - bounds.minY));
    const scale = Math.min(1, MAX_TEXTURE_SIZE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    if (!ctx) {
        throw new Error("Canvas 2D context is unavailable");
    }

    ctx.fillStyle = "#f8efe3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const tilePromises: Promise<void>[] = [];
    for (let x = bounds.minTileX; x <= bounds.maxTileX; x += 1) {
        for (let y = bounds.minTileY; y <= bounds.maxTileY; y += 1) {
            tilePromises.push(
                loadImage(tileUrl(x, y, zoom, baseLayer)).then((image) => {
                    const dx = (x * TILE_SIZE - bounds.minX) * scale;
                    const dy = (y * TILE_SIZE - bounds.minY) * scale;
                    ctx.drawImage(image, dx, dy, TILE_SIZE * scale, TILE_SIZE * scale);
                })
            );
        }
    }

    await Promise.all(tilePromises);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;

    return texture;
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();

        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load tile: ${src}`));
        image.src = src;
    });
}

function getMercatorPixelBounds(data: GeoJsonData, zoom: number) {
    const worldSize = TILE_SIZE * 2 ** zoom;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    data.features.forEach((feature) => {
        feature.geometry.coordinates.forEach((polygon) => {
            polygon.forEach((ring) => {
                ring.forEach((coord) => {
                    const [x, y] = lonLatToPixel(coord as [number, number], worldSize);

                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                });
            });
        });
    });

    return {
        minX,
        minY,
        maxX,
        maxY,
        minTileX: Math.floor(minX / TILE_SIZE),
        minTileY: Math.floor(minY / TILE_SIZE),
        maxTileX: Math.floor(maxX / TILE_SIZE),
        maxTileY: Math.floor(maxY / TILE_SIZE),
    };
}

function lonLatToPixel([longitude, latitude]: [number, number], worldSize: number) {
    const sinLat = Math.sin((latitude * Math.PI) / 180);
    const x = ((longitude + 180) / 360) * worldSize;
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize;

    return [x, y];
}
