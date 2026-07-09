"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { geoMercator, type GeoProjection } from "d3-geo";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
    AdditiveBlending,
    Box2,
    Color,
    DoubleSide,
    Float32BufferAttribute,
    InstancedMesh,
    Mesh,
    Object3D,
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
import {
    filterCommandMapMarkersBySelection,
    filterCommandMapItemsBySelection,
    getCommandMapFocusConfig,
    resolveCommandMapFeatureDisplayName,
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

function useMapMarkers(markers: PovertyMarker[], projection: GeoProjection) {
    return useMemo(() => markers.flatMap((marker) => {
        const latitude = Number(marker.latitude);
        const longitude = Number(marker.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

        const projected = projection([longitude, latitude]);
        if (!projected) return [];

        return {
            marker,
            position: [projected[0], -projected[1], 9] as [number, number, number],
        };
    }), [markers, projection]);
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
                <div className="pointer-events-none min-w-[116px] rounded-lg border border-orange-200 bg-white/95 px-2 py-1 text-center text-[11px] shadow-lg">
                    <div className="truncate font-semibold text-gray-900">{region.displayName}</div>
                    <div className="font-semibold text-red-600">{total.toLocaleString("vi-VN")} hộ</div>
                </div>
            </Html>
        </group>
    );
}

function HouseholdPoint({
    item,
    visualScale = 1,
}: {
    item: { marker: PovertyMarker; position: [number, number, number] };
    visualScale?: number;
}) {
    const baseGlowRef = useRef<Mesh>(null);
    const beamMeshRef = useRef<InstancedMesh>(null);
    const isPoor = item.marker.povertyType === "POOR";
    const isNone = item.marker.povertyType === "NONE";
    const color = isPoor ? "#e11d48" : isNone ? "#64748b" : "#f97316";
    const beamHeight = 13;
    const markerZ = beamHeight + 0.9;
    const [rawBaseGlowTexture, rawBeamTexture] = useLoader(TextureLoader, [
        "/images/poverty-dashboard/guangquan01.png",
        "/images/poverty-dashboard/huiguang.png",
    ]);
    const markerColor = useMemo(() => new Color(color), [color]);
    const beamColor = useMemo(() => new Color(isPoor ? "#fb7185" : isNone ? "#94a3b8" : "#fb923c"), [isNone, isPoor]);
    const baseGlowTexture = useMemo(() => {
        const texture = rawBaseGlowTexture.clone();
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
        return texture;
    }, [rawBaseGlowTexture]);
    const beamTexture = useMemo(() => {
        const texture = rawBeamTexture.clone();
        texture.colorSpace = SRGBColorSpace;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(1, 1);
        texture.needsUpdate = true;
        return texture;
    }, [rawBeamTexture]);

    useEffect(() => () => {
        baseGlowTexture.dispose();
        beamTexture.dispose();
    }, [baseGlowTexture, beamTexture]);

    useEffect(() => {
        const rotations = [0, 60, 120];
        const object3D = new Object3D();

        rotations.forEach((degree, index) => {
            object3D.rotation.set(Math.PI / 2, (Math.PI / 180) * degree, 0);
            object3D.updateMatrix();
            beamMeshRef.current?.setMatrixAt(index, object3D.matrix);
        });

        if (beamMeshRef.current) {
            beamMeshRef.current.instanceMatrix.needsUpdate = true;
        }
    }, []);

    useFrame((_, delta) => {
        if (baseGlowRef.current) baseGlowRef.current.rotation.z += delta + 0.02;
    });

    return (
        <group position={item.position} scale={[visualScale, visualScale, visualScale]}>
            <pointLight color={color} intensity={2.4} distance={24} position={[0, 0, beamHeight / 2]} />
            <mesh renderOrder={5} position={[0, 0, beamHeight / 2]} raycast={() => null}>
                <instancedMesh
                    ref={beamMeshRef}
                    matrixAutoUpdate={false}
                    args={[undefined, undefined, 3]}
                    renderOrder={10}
                    rotation-x={Math.PI / 2}
                    raycast={() => null}
                >
                    <planeGeometry args={[3.5, beamHeight]} />
                    <meshBasicMaterial
                        transparent
                        color={beamColor}
                        map={beamTexture}
                        opacity={0.48}
                        side={DoubleSide}
                        depthWrite={false}
                        blending={AdditiveBlending}
                    />
                </instancedMesh>
                <boxGeometry args={[0.32, 0.32, beamHeight]} translate={[0, 0, beamHeight / 2]} />
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.92}
                    depthTest={false}
                    depthWrite={false}
                    blending={AdditiveBlending}
                />
            </mesh>
            <mesh ref={baseGlowRef} renderOrder={6} raycast={() => null}>
                <planeGeometry args={[2, 2]} />
                <meshBasicMaterial
                    transparent
                    color={markerColor}
                    map={baseGlowTexture}
                    alphaMap={baseGlowTexture}
                    opacity={0.8}
                    depthTest={false}
                    depthWrite={false}
                    blending={AdditiveBlending}
                />
            </mesh>
            <mesh position-z={markerZ} renderOrder={11}>
                <sphereGeometry args={[0.4, 18, 18]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.25} roughness={0.35} />
            </mesh>
            <Html position={[0, 0, markerZ + 2.4]} center distanceFactor={95}>
                <div className="pointer-events-none min-w-[128px] rounded-lg border border-white/70 bg-white/95 px-2 py-1 text-center text-[11px] shadow-lg">
                    <div className="truncate font-semibold text-gray-900">{item.marker.headFullName || item.marker.code || "Hộ chưa có tên"}</div>
                    <div className={isPoor ? "font-medium text-rose-600" : "font-medium text-orange-600"}>
                        {isPoor ? "Hộ nghèo" : "Hộ cận nghèo"}
                    </div>
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
    const [hovered, setHovered] = useState(false);
    const [shape, shapeGeometry] = useMemo(() => {
        const shapes = region.points.map((points) => new Shape(points));
        return [shapes, new ShapeGeometry(shapes)];
    }, [region.points]);

    useFrame(() => {
        if (groupRef.current) groupRef.current.scale.lerp(targetScale.current, 0.14);
    });

    return (
        <group
            ref={groupRef}
            onPointerOver={(event) => {
                event.stopPropagation();
                targetScale.current.set(1, 1, 1.18);
                setHovered(true);
                document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
                targetScale.current.set(1, 1, 1);
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
    const ringOneRef = useRef<Mesh>(null);
    const ringTwoRef = useRef<Mesh>(null);
    const [glow, grid, gridMask, ringOne, ringTwo] = useLoader(TextureLoader, [
        "/images/poverty-dashboard/gaoguang1.png",
        "/images/poverty-dashboard/grid.png",
        "/images/poverty-dashboard/gridBlack.png",
        "/images/poverty-dashboard/rotationBorder1.png",
        "/images/poverty-dashboard/rotationBorder2.png",
    ]);

    useMemo(() => {
        [grid, gridMask].forEach((texture) => {
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            texture.repeat.set(80, 80);
        });
    }, [grid, gridMask]);

    useFrame((_, delta) => {
        if (ringOneRef.current) ringOneRef.current.rotation.z += delta * 0.08;
        if (ringTwoRef.current) ringTwoRef.current.rotation.z -= delta * 0.18;
    });

    return (
        <group visible={visible} rotation-x={-Math.PI / 2} position-y={-0.2}>
            <mesh>
                <planeGeometry args={[320, 320]} />
                <meshBasicMaterial transparent map={glow} color="#f97316" opacity={0.56} />
            </mesh>
            <mesh ref={ringOneRef} position-z={0.08}>
                <planeGeometry args={[260, 260]} />
                <meshBasicMaterial transparent map={ringOne} color="#fed7aa" opacity={0.22} depthWrite={false} />
            </mesh>
            <mesh ref={ringTwoRef} position-z={0.1}>
                <planeGeometry args={[238, 238]} />
                <meshBasicMaterial transparent map={ringTwo} color="#fb923c" opacity={0.45} depthWrite={false} />
            </mesh>
            <mesh position-z={0.04}>
                <planeGeometry args={[1000, 1000]} />
                <meshBasicMaterial transparent map={grid} alphaMap={gridMask} color="#fb923c" opacity={0.22} depthWrite={false} />
            </mesh>
        </group>
    );
}

function CloudLayer({ visible }: { visible: boolean }) {
    const groupRef = useRef<Group>(null);
    const cloudTexture = useLoader(TextureLoader, "/images/poverty-dashboard/cloud.png");
    const clouds = useMemo(() => [
        { position: [-74, 28, 62] as [number, number, number], scale: [70, 28, 1] as [number, number, number], speed: 0.08 },
        { position: [42, 34, 70] as [number, number, number], scale: [82, 32, 1] as [number, number, number], speed: -0.06 },
        { position: [4, 18, 52] as [number, number, number], scale: [58, 22, 1] as [number, number, number], speed: 0.04 },
    ], []);

    useFrame((_, delta) => {
        if (groupRef.current) groupRef.current.rotation.y += delta * 0.02;
    });

    return (
        <group ref={groupRef} visible={visible} rotation={[-Math.PI / 2, 0, 0]}>
            {clouds.map((cloud, index) => (
                <mesh key={index} position={cloud.position} scale={cloud.scale} raycast={() => null}>
                    <planeGeometry args={[1, 1]} />
                    <meshBasicMaterial transparent opacity={0.38} map={cloudTexture} depthWrite={false} />
                </mesh>
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
    const { bar, cloud, rotation, baseLayer } = useCommandDashboardStore();
    const mapData = canThoMapData as unknown as GeoJsonData;
    const { items, bbox, projection } = useMapRegions(regions, selectedRegionName);
    const visibleMarkers = useMemo(
        () => filterCommandMapMarkersBySelection(markers, selectedRegionName),
        [markers, selectedRegionName]
    );
    const markerPoints = useMapMarkers(visibleMarkers, projection);
    const maxValue = Math.max(1, ...items.map((item) => Number(item.stat.total ?? 0)));
    const selectedRegion = selectedRegionName ? items[0] : null;
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
    const markerVisualScale = selectedRegion
        ? Math.max(0.3, Math.min(1, 1 / selectedRegionScale))
        : 1;
    const mapGroupPosition: [number, number, number] = selectedRegion
        ? [
            -selectedRegionCenter.x * selectedRegionScale,
            0,
            selectedRegionCenter.y * selectedRegionScale,
        ]
        : [0, 0, 0];
    const focusDistance = selectedRegion ? focusConfig.focusDistance : 160;

    return (
        <>
            <CameraFocus
                target={focusTarget}
                selected={Boolean(selectedRegion)}
                distance={focusDistance}
                controlsRef={controlsRef}
            />
            <ambientLight intensity={1.5} />
            <directionalLight position={[80, 120, 110]} intensity={3.2} />
            <pointLight position={[-80, 90, -80]} intensity={1.6} color="#fb923c" />
            <CloudLayer visible={cloud} />
            <group
                rotation={[-Math.PI / 2, 0, 0]}
                position={mapGroupPosition}
                scale={[selectedRegionScale, selectedRegionScale, 1]}
            >
                {items.map((region) => (
                    <RegionMesh key={region.name} region={region} bbox={textureBbox} maxValue={maxValue} mapTexture={mapTexture} showBar={bar} />
                ))}
                {markerPoints.map((item) => (
                    <HouseholdPoint key={item.marker.id} item={item} visualScale={markerVisualScale} />
                ))}
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
