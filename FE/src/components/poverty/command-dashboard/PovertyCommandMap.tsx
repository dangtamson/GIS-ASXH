"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { geoMercator, type GeoProjection } from "d3-geo";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
    Box2,
    Color,
    DoubleSide,
    Float32BufferAttribute,
    Mesh,
    NormalBlending,
    RepeatWrapping,
    SRGBColorSpace,
    Shape,
    ShapeGeometry,
    type Texture,
    TextureLoader,
    Vector2,
    Vector3,
    type Group,
} from "three";

import type { PovertyMarker } from "@/types/poverty";
import canThoMapData from "./data/cantho.json";
import PovertyCommandHeatmapLayer from "./PovertyCommandHeatmapLayer";
import {
    buildCommandMapHeatmapPoints,
    filterCommandMapMarkersBySelection,
    filterCommandMapItemsBySelection,
    getCommandMapFocusConfig,
    resolveCommandMapFeatureDisplayName,
    shouldFocusCommandMapSelection,
} from "./PovertyCommandMap.utils";
import { commandMapTileZoom, useCanThoTileTexture } from "./tileTexture";
import { useCommandDashboardStore } from "./useCommandDashboardStore";

type RegionStat = {
    area: string;
    poorCount: number;
    nearPoorCount: number;
    total: number;
};

type GeoFeature = {
    properties: {
        name: string;
        mergedFrom?: string;
        center?: number[];
        centroid?: number[];
    };
    geometry: {
        coordinates: number[][][][];
    };
};

type GeoJsonData = {
    features: GeoFeature[];
};

type RegionMeshData = {
    name: string;
    displayName: string;
    mergedFrom?: string;
    center: [number, number, number];
    bounds: Box2;
    points: Vector2[][];
    stat: RegionStat;
};

type PovertyCommandMapProps = {
    regions: RegionStat[];
    markers: PovertyMarker[];
    selectedRegionName?: string | null;
    preferDeepFocus?: boolean;
};

const EMPTY_STAT: RegionStat = {
    area: "Chưa có dữ liệu",
    poorCount: 0,
    nearPoorCount: 0,
    total: 0,
};

const normalizeKey = (value?: string | null) =>
    String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

const toLngLat = (value?: number[]): [number, number] => [
    Number(value?.[0] ?? 0),
    Number(value?.[1] ?? 0),
];

function fitProjection(data: GeoJsonData): GeoProjection {
    const projection = geoMercator().scale(7000).translate([0, 0]);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    data.features.forEach((feature) => {
        feature.geometry.coordinates.forEach((polygon) => {
            polygon.forEach((ring) => {
                ring.forEach((coord) => {
                    const projected = projection(coord as [number, number]);
                    if (!projected) return;
                    const [x, y] = projected;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                });
            });
        });
    });

    projection.translate([-(minX + maxX) / 2, -(minY + maxY) / 2]);
    return projection;
}

function useMapRegions(regions: RegionStat[], selectedRegionName?: string | null) {
    const mapData = canThoMapData as unknown as GeoJsonData;

    return useMemo(() => {
        const statByArea = new Map(regions.map((item) => [normalizeKey(item.area), item]));
        const projection = fitProjection(mapData);
        const bbox = new Box2();

        const toPoint = (coord: number[]) => {
            const projected = projection(coord as [number, number]);
            const point = projected ? new Vector2(projected[0], -projected[1]) : new Vector2(0, 0);
            bbox.expandByPoint(point);
            return point;
        };

        const items = mapData.features.map<RegionMeshData>((feature) => {
            const regionBounds = new Box2();
            const points = feature.geometry.coordinates.reduce<Vector2[][]>(
                (result, polygon) => [
                    ...result,
                    ...polygon.map((ring) => ring.map((coord) => {
                        const point = toPoint(coord);
                        regionBounds.expandByPoint(point);
                        return point;
                    })),
                ],
                []
            );
            const [x = 0, y = 0] = projection(toLngLat(feature.properties.centroid ?? feature.properties.center)) ?? [];
            const stat = statByArea.get(normalizeKey(feature.properties.name)) ?? EMPTY_STAT;

            return {
                name: feature.properties.name,
                displayName: resolveCommandMapFeatureDisplayName(feature.properties, selectedRegionName),
                mergedFrom: feature.properties.mergedFrom,
                center: [x, -y, 7],
                bounds: regionBounds,
                points,
                stat,
            };
        });
        const visibleItems = filterCommandMapItemsBySelection(items, selectedRegionName);

        return { items: visibleItems, bbox, projection };
    }, [mapData, regions, selectedRegionName]);
}

function useHeatmapPoints(markers: PovertyMarker[], projection: GeoProjection) {
    return useMemo(
        () => buildCommandMapHeatmapPoints(markers, (coordinates) => {
            const projected = projection(coordinates);
            return projected ? [projected[0], projected[1]] : null;
        }),
        [markers, projection]
    );
}

function TexturedShape({
    shape,
    bbox,
    mapTexture,
}: {
    shape: Shape[];
    bbox: Box2;
    mapTexture: Texture | null;
}) {
    const meshRef = useRef<Mesh>(null);

    useLayoutEffect(() => {
        if (!meshRef.current) return;
        const { geometry } = meshRef.current;
        const pos = geometry.attributes.position;
        const width = bbox.max.x - bbox.min.x || 1;
        const height = bbox.max.y - bbox.min.y || 1;
        const uv: number[] = [];
        for (let index = 0; index < pos.count; index += 1) {
            uv.push((pos.getX(index) - bbox.min.x) / width, (pos.getY(index) - bbox.min.y) / height);
        }
        geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
        geometry.attributes.uv.needsUpdate = true;
    }, [bbox, shape]);

    return (
        <mesh ref={meshRef} position-z={6.1}>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial
                key={mapTexture ? "tile" : "fallback"}
                color={mapTexture ? "#ffffff" : "#fff7ed"}
                map={mapTexture ?? null}
                roughness={0.55}
                metalness={0.12}
            />
        </mesh>
    );
}

function DataBar({ region, maxValue, visible }: { region: RegionMeshData; maxValue: number; visible: boolean }) {
    const ringRef = useRef<Mesh>(null);
    const total = Number(region.stat.total ?? 0);
    const height = total > 0 ? Math.max(3, Math.min(22, (total / Math.max(maxValue, 1)) * 22)) : 0;

    useFrame((_, delta) => {
        if (ringRef.current) ringRef.current.rotation.z += delta * 1.1;
    });

    if (!visible || height <= 0) return null;

    return (
        <group position={region.center}>
            <mesh position-z={height / 2}>
                <cylinderGeometry args={[0.65, 0.95, height, 20]} />
                <meshBasicMaterial color="#ef4444" transparent opacity={0.9} />
            </mesh>
            <mesh ref={ringRef}>
                <torusGeometry args={[2.1, 0.08, 8, 48]} />
                <meshBasicMaterial color="#fb923c" transparent opacity={0.9} />
            </mesh>
            <Html position={[0, 0, height + 2]} center distanceFactor={82}>
                <div className="pointer-events-none min-w-[132px] rounded-lg border border-orange-200 bg-white/95 px-2 py-1 text-center text-[11px] shadow-lg">
                    <div className="truncate font-semibold text-gray-900">{region.displayName}</div>
                    <div className="font-semibold text-red-600">{total.toLocaleString("vi-VN")} hộ</div>
                    <div className="text-[10px] text-rose-600">Nghèo: {region.stat.poorCount.toLocaleString("vi-VN")}</div>
                    <div className="text-[10px] text-orange-600">Cận nghèo: {region.stat.nearPoorCount.toLocaleString("vi-VN")}</div>
                </div>
            </Html>
        </group>
    );
}

function RegionMesh({
    region,
    bbox,
    maxValue,
    mapTexture,
    showBar,
}: {
    region: RegionMeshData;
    bbox: Box2;
    maxValue: number;
    mapTexture: Texture | null;
    showBar: boolean;
}) {
    const groupRef = useRef<Group>(null);
    const targetScale = useRef(new Vector3(1, 1, 1));
    const targetPosition = useRef(new Vector3(0, 0, 0));
    const [hovered, setHovered] = useState(false);
    const [shape, shapeGeometry] = useMemo(() => {
        const shapes = region.points.map((points) => new Shape(points));
        return [shapes, new ShapeGeometry(shapes)];
    }, [region.points]);

    useFrame(() => {
        if (!groupRef.current) return;
        groupRef.current.scale.lerp(targetScale.current, 0.14);
        groupRef.current.position.lerp(targetPosition.current, 0.14);
    });

    return (
        <group
            ref={groupRef}
            onPointerOver={(event) => {
                event.stopPropagation();
                targetScale.current.set(1, 1, 1);
                targetPosition.current.set(0, 0, 0.9);
                setHovered(true);
                document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
                targetScale.current.set(1, 1, 1);
                targetPosition.current.set(0, 0, 0);
                setHovered(false);
                document.body.style.cursor = "auto";
            }}
        >
            <TexturedShape shape={shape} bbox={bbox} mapTexture={mapTexture} />
            <mesh castShadow receiveShadow>
                <extrudeGeometry args={[shape, { depth: 6, steps: 1, bevelEnabled: false }]} />
                <meshStandardMaterial color={hovered ? "#fdba74" : "#fed7aa"} roughness={0.48} metalness={0.16} side={DoubleSide} />
            </mesh>
            <lineSegments position-z={6.25}>
                <edgesGeometry args={[shapeGeometry]} />
                <lineBasicMaterial color="#ffffff" transparent opacity={0.88} />
            </lineSegments>
            <DataBar region={region} maxValue={maxValue} visible={showBar} />
        </group>
    );
}

function BottomGrid({ visible }: { visible: boolean }) {
    const pulseUniformsRef = useRef({
        uTime: { value: 0.0 },
        uSpeed: { value: 10.0 },
        uWidth: { value: 20.0 },
        uColor: { value: new Color(0xea580c) },
        uDir: { value: 2.0 },
    });
    const ringOneRef = useRef<Mesh>(null);
    const ringTwoRef = useRef<Mesh>(null);
    const [rawGlow, rawGrid, rawGridMask, rawRingOne, rawRingTwo] = useLoader(TextureLoader, [
        "/images/poverty-dashboard/gaoguang1.png",
        "/images/poverty-dashboard/grid.png",
        "/images/poverty-dashboard/gridBlack.png",
        "/images/poverty-dashboard/rotationBorder1.png",
        "/images/poverty-dashboard/rotationBorder2.png",
    ]);

    const [glow, grid, gridMask, ringOne, ringTwo] = useMemo(() => {
        const nextGlow = rawGlow.clone();
        const nextGrid = rawGrid.clone();
        const nextGridMask = rawGridMask.clone();
        const nextRingOne = rawRingOne.clone();
        const nextRingTwo = rawRingTwo.clone();

        nextGlow.colorSpace = SRGBColorSpace;
        nextGlow.wrapS = RepeatWrapping;
        nextGlow.wrapT = RepeatWrapping;
        nextGlow.repeat.set(1, 1);
        [nextGrid, nextGridMask].forEach((texture) => {
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            texture.repeat.set(80, 80);
        });
        return [nextGlow, nextGrid, nextGridMask, nextRingOne, nextRingTwo];
    }, [rawGlow, rawGrid, rawGridMask, rawRingOne, rawRingTwo]);

    useFrame((_, delta) => {
        pulseUniformsRef.current.uTime.value += delta * 10;
        if (pulseUniformsRef.current.uTime.value > 100) {
            pulseUniformsRef.current.uTime.value = 0;
        }
        if (ringOneRef.current) ringOneRef.current.rotation.z += 0.001;
        if (ringTwoRef.current) ringTwoRef.current.rotation.z -= 0.004;
    });

    return (
        <group visible={visible} rotation-x={-Math.PI / 2} position-y={-0.1}>
            <mesh>
                <planeGeometry args={[300, 300]} />
                <meshBasicMaterial
                    transparent
                    blending={NormalBlending}
                    map={glow}
                    color="#fbdf88"
                    opacity={0.42}
                />
            </mesh>
            <mesh ref={ringOneRef} position-z={0.08}>
                <planeGeometry args={[240, 240]} />
                <meshBasicMaterial
                    transparent
                    map={ringOne}
                    color="#fbdf88"
                    opacity={0.18}
                    depthWrite={false}
                    blending={NormalBlending}
                />
            </mesh>
            <mesh ref={ringTwoRef} position-z={0.1}>
                <planeGeometry args={[225, 225]} />
                <meshBasicMaterial
                    transparent
                    map={ringTwo}
                    color="#fbdf88"
                    opacity={0.32}
                    depthWrite={false}
                    blending={NormalBlending}
                />
            </mesh>
            <mesh position-z={0.04}>
                <planeGeometry args={[1000, 1000]} />
                <meshBasicMaterial
                    transparent
                    map={grid}
                    alphaMap={gridMask}
                    color="#fbdf88"
                    opacity={0.08}
                    depthWrite={false}
                    blending={NormalBlending}
                />
            </mesh>
            <mesh position-z={0.05}>
                <planeGeometry args={[1000, 1000]} />
                <meshBasicMaterial
                    transparent
                    map={grid}
                    alphaMap={gridMask}
                    color="#ea580c"
                    opacity={0.34}
                    depthWrite={false}
                    blending={NormalBlending}
                    onBeforeCompile={(shader) => {
                        shader.uniforms = {
                            ...shader.uniforms,
                            ...pulseUniformsRef.current,
                        };
                        shader.vertexShader = shader.vertexShader.replace(
                            "void main() {",
                            `
                                varying vec3 vPosition;
                                void main() {
                                    vPosition = position;
                            `
                        );
                        shader.fragmentShader = shader.fragmentShader.replace(
                            "void main() {",
                            `
                                uniform float uTime;
                                uniform float uSpeed;
                                uniform float uWidth;
                                uniform vec3 uColor;
                                uniform float uDir;
                                varying vec3 vPosition;
                                void main() {
                            `
                        );
                        shader.fragmentShader = shader.fragmentShader.replace(
                            "#include <opaque_fragment>",
                            `
                                #ifdef OPAQUE
                                diffuseColor.a = 1.0;
                                #endif

                                #ifdef USE_TRANSMISSION
                                diffuseColor.a *= material.transmissionAlpha;
                                #endif

                                float r = uTime * uSpeed;
                                float w = 0.0;
                                if (w > uWidth) {
                                    w = uWidth;
                                } else {
                                    w = uTime * 5.0;
                                }

                                vec2 center = vec2(0.0, 0.0);
                                float rDistance = distance(vPosition.xz, center);
                                if (uDir == 2.0) {
                                    rDistance = distance(vPosition.xy, center);
                                }

                                if (rDistance > r && rDistance < r + 2.0 * w) {
                                    float per = 0.0;
                                    if (rDistance < r + w) {
                                        per = (rDistance - r) / w;
                                        outgoingLight = mix(outgoingLight, uColor, per);
                                        float alphaV = mix(0.0, diffuseColor.a, per);
                                        gl_FragColor = vec4(outgoingLight, alphaV);
                                    } else {
                                        per = (rDistance - r - w) / w;
                                        outgoingLight = mix(uColor, outgoingLight, per);
                                        float alphaV = mix(diffuseColor.a, 0.0, per);
                                        gl_FragColor = vec4(outgoingLight, alphaV);
                                    }
                                } else {
                                    gl_FragColor = vec4(outgoingLight, 0.0);
                                }
                            `
                        );
                    }}
                />
            </mesh>
        </group>
    );
}

function CloudLayer({ visible }: { visible: boolean }) {
    const cloudGroupRef = useRef<Group>(null);
    const primaryClusterRef = useRef<Group>(null);
    const rawCloudTexture = useLoader(TextureLoader, "/images/poverty-dashboard/cloud.png");
    const cloudTexture = useMemo(() => {
        const texture = rawCloudTexture.clone();
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
        return texture;
    }, [rawCloudTexture]);
    const cloudClusters = useMemo(() => [
        {
            position: [100, 60, 20] as [number, number, number],
            planes: [
                { offset: [0, 0, 0] as [number, number, number], scale: [52, 18, 1] as [number, number, number], opacity: 0.24 },
                { offset: [-12, 4, 6] as [number, number, number], scale: [36, 14, 1] as [number, number, number], opacity: 0.2 },
                { offset: [14, -3, -4] as [number, number, number], scale: [34, 12, 1] as [number, number, number], opacity: 0.18 },
                { offset: [6, 7, 8] as [number, number, number], scale: [28, 10, 1] as [number, number, number], opacity: 0.15 },
                { offset: [-20, -1, -7] as [number, number, number], scale: [24, 9, 1] as [number, number, number], opacity: 0.13 },
                { offset: [22, 5, 10] as [number, number, number], scale: [22, 8, 1] as [number, number, number], opacity: 0.12 },
            ],
        },
        {
            position: [-60, 60, 60] as [number, number, number],
            planes: [
                { offset: [0, 0, 0] as [number, number, number], scale: [48, 18, 1] as [number, number, number], opacity: 0.22 },
                { offset: [11, 3, -5] as [number, number, number], scale: [32, 12, 1] as [number, number, number], opacity: 0.18 },
                { offset: [-15, -2, 6] as [number, number, number], scale: [35, 12, 1] as [number, number, number], opacity: 0.18 },
                { offset: [-4, 6, 10] as [number, number, number], scale: [26, 10, 1] as [number, number, number], opacity: 0.14 },
                { offset: [18, -4, 8] as [number, number, number], scale: [23, 9, 1] as [number, number, number], opacity: 0.12 },
                { offset: [-22, 5, -8] as [number, number, number], scale: [21, 8, 1] as [number, number, number], opacity: 0.11 },
            ],
        },
        {
            position: [12, 56, 84] as [number, number, number],
            planes: [
                { offset: [0, 0, 0] as [number, number, number], scale: [42, 16, 1] as [number, number, number], opacity: 0.18 },
                { offset: [-14, 3, 5] as [number, number, number], scale: [28, 11, 1] as [number, number, number], opacity: 0.15 },
                { offset: [16, -2, -6] as [number, number, number], scale: [26, 10, 1] as [number, number, number], opacity: 0.14 },
                { offset: [4, 6, 9] as [number, number, number], scale: [20, 8, 1] as [number, number, number], opacity: 0.11 },
            ],
        },
    ], []);

    useFrame((_, delta) => {
        if (cloudGroupRef.current) {
            const elapsed = performance.now() * 0.001;
            cloudGroupRef.current.rotation.y = Math.cos(elapsed / 2) / 2;
            cloudGroupRef.current.rotation.x = Math.sin(elapsed / 2) / 2;
        }
        if (primaryClusterRef.current) {
            primaryClusterRef.current.rotation.y -= delta / 5;
        }
    });

    return (
        <group ref={cloudGroupRef} visible={visible} rotation={[-Math.PI / 2, 0, 0]}>
            {cloudClusters.map((cluster, clusterIndex) => (
                <group
                    key={clusterIndex}
                    ref={clusterIndex === 0 ? primaryClusterRef : undefined}
                    position={cluster.position}
                >
                    {cluster.planes.map((plane, planeIndex) => (
                        <mesh
                            key={planeIndex}
                            position={plane.offset}
                            scale={plane.scale}
                            raycast={() => null}
                        >
                            <planeGeometry args={[1, 1]} />
                            <meshBasicMaterial
                                transparent
                                opacity={plane.opacity}
                                map={cloudTexture}
                                depthWrite={false}
                                blending={NormalBlending}
                            />
                        </mesh>
                    ))}
                </group>
            ))}
        </group>
    );
}

function CameraFocus({
    target,
    selected,
    distance,
    controlsRef,
}: {
    target: [number, number, number];
    selected: boolean;
    distance: number;
    controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
    const camera = useThree((state) => state.camera);

    useEffect(() => {
        if (selected) {
            camera.position.set(
                target[0] + distance * 0.46,
                target[1] + distance * 0.92,
                target[2] + distance * 1.02
            );
        } else {
            camera.position.set(58, 124, 158);
        }
        controlsRef.current?.target.set(...target);
        controlsRef.current?.update();
        camera.lookAt(...target);
        camera.updateProjectionMatrix();
    }, [camera, controlsRef, distance, selected, target]);

    return null;
}

function Scene({ regions, markers, selectedRegionName, preferDeepFocus = false }: PovertyCommandMapProps) {
    const controlsRef = useRef<OrbitControlsImpl | null>(null);
    const { bar, cloud, rotation, baseLayer, heat } = useCommandDashboardStore();
    const mapData = canThoMapData as unknown as GeoJsonData;
    const { items, bbox, projection } = useMapRegions(regions, selectedRegionName);
    const visibleMarkers = useMemo(
        () => filterCommandMapMarkersBySelection(markers, selectedRegionName),
        [markers, selectedRegionName]
    );
    const heatmapPoints = useHeatmapPoints(visibleMarkers, projection);
    const maxValue = Math.max(1, ...items.map((item) => Number(item.stat.total ?? 0)));
    const hasFocusedSelection = shouldFocusCommandMapSelection({
        selectedRegionName,
        visibleRegionCount: items.length,
    });
    const selectedRegion = hasFocusedSelection ? items[0] : null;
    const selectedRegionKey = normalizeKey(selectedRegion?.name);
    const textureData = useMemo<GeoJsonData>(() => {
        if (!selectedRegionKey) return mapData;

        return {
            features: mapData.features.filter((feature) => normalizeKey(feature.properties.name) === selectedRegionKey),
        };
    }, [mapData, selectedRegionKey]);
    const textureBbox = selectedRegion?.bounds ?? bbox;
    const mapTexture = useCanThoTileTexture(
        textureData,
        baseLayer,
        selectedRegion ? commandMapTileZoom.selectedRegion : commandMapTileZoom.default
    );
    const focusTarget = useMemo<[number, number, number]>(() => {
        if (!selectedRegion) return [0, 0, 0];
        return [0, 8, 0];
    }, [selectedRegion]);
    const selectedRegionSize = useMemo(() => {
        if (!selectedRegion) return 0;
        const size = selectedRegion.bounds.getSize(new Vector2());
        return Math.max(size.x, size.y);
    }, [selectedRegion]);
    const fullMapSize = useMemo(() => {
        const size = bbox.getSize(new Vector2());
        return Math.max(size.x, size.y, 1);
    }, [bbox]);
    const selectedRegionCenter = useMemo(() => {
        if (!selectedRegion) return new Vector2(0, 0);
        return selectedRegion.bounds.getCenter(new Vector2());
    }, [selectedRegion]);
    const focusConfig = useMemo(
        () => getCommandMapFocusConfig({
            selectedRegionSize,
            fullMapSize,
            preferDeepFocus,
        }),
        [fullMapSize, preferDeepFocus, selectedRegionSize]
    );
    const selectedRegionScale = selectedRegion ? focusConfig.selectedRegionScale : 1;
    const mapGroupPosition: [number, number, number] = selectedRegion
        ? [
            -selectedRegionCenter.x * selectedRegionScale,
            0,
            selectedRegionCenter.y * selectedRegionScale,
        ]
        : [0, 0, 0];
    const focusDistance = selectedRegion ? focusConfig.focusDistance : 160;
    const heatmapLayerKey = useMemo(
        () => [
            hasFocusedSelection ? "focused" : "full",
            selectedRegion?.name ?? "all",
            heatmapPoints.length,
            Math.round(textureBbox.min.x),
            Math.round(textureBbox.min.y),
            Math.round(textureBbox.max.x),
            Math.round(textureBbox.max.y),
        ].join(":"),
        [hasFocusedSelection, heatmapPoints.length, selectedRegion?.name, textureBbox]
    );

    return (
        <>
            <CameraFocus
                target={focusTarget}
                selected={Boolean(selectedRegion)}
                distance={focusDistance}
                controlsRef={controlsRef}
            />
            <ambientLight intensity={1.2} />
            <directionalLight position={[80, 120, 110]} intensity={2.4} />
            <pointLight position={[-80, 90, -80]} intensity={0.9} color="#fdba74" />
            <CloudLayer visible={cloud} />
            <group
                rotation={[-Math.PI / 2, 0, 0]}
                position={mapGroupPosition}
                scale={[selectedRegionScale, selectedRegionScale, 1]}
            >
                {items.map((region) => (
                    <RegionMesh key={region.name} region={region} bbox={textureBbox} maxValue={maxValue} mapTexture={mapTexture} showBar={bar} />
                ))}
                <PovertyCommandHeatmapLayer key={heatmapLayerKey} bbox={textureBbox} points={heatmapPoints} visible={heat} />
            </group>
            <BottomGrid visible={rotation} />
            <OrbitControls
                ref={controlsRef}
                makeDefault
                enablePan
                enableZoom
                enableRotate
                enableDamping
                dampingFactor={0.08}
                zoomSpeed={0.35}
                minDistance={selectedRegion ? focusConfig.minDistance : 92}
                maxDistance={selectedRegion ? focusConfig.maxDistance : 310}
                maxPolarAngle={1.45}
                target={focusTarget}
            />
        </>
    );
}

export default function PovertyCommandMap({ regions, markers, selectedRegionName, preferDeepFocus }: PovertyCommandMapProps) {
    return (
        <div className="absolute inset-0">
            <Canvas
                flat
                camera={{ position: [-45, 128, 240], fov: 48, far: 2000, near: 1 }}
                dpr={[1, 1.7]}
            >
                <color attach="background" args={["#fff7ed"]} />
                <Scene
                    regions={regions}
                    markers={markers}
                    selectedRegionName={selectedRegionName}
                    preferDeepFocus={preferDeepFocus}
                />
            </Canvas>
        </div>
    );
}
