"use client";

import { useEffect, useMemo, useRef } from "react";
import { Box2, CanvasTexture, Color, DoubleSide, SRGBColorSpace, type Mesh, type PlaneGeometry, type ShaderMaterial } from "three";

import { buildHeatmapCanvasData, getHeatmapGradientStops } from "./PovertyCommandHeatmap.utils";
import type { CommandMapHeatmapPoint } from "./PovertyCommandMap.utils";

const CANVAS_SIZE = 512;
const RADIUS = 28;

function createTextureFromCanvas(canvas: HTMLCanvasElement) {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

function buildHeatTextures(points: { x: number; y: number; value: number }[], max: number) {
    const alphaCanvas = document.createElement("canvas");
    alphaCanvas.width = CANVAS_SIZE;
    alphaCanvas.height = CANVAS_SIZE;
    const alphaContext = alphaCanvas.getContext("2d");
    if (!alphaContext) {
        throw new Error("Canvas 2D context is unavailable");
    }

    alphaContext.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    points.forEach((point) => {
        const gradient = alphaContext.createRadialGradient(point.x, point.y, 0, point.x, point.y, RADIUS);
        const opacity = Math.max(0.2, Math.min(1, point.value / max));
        gradient.addColorStop(0, `rgba(255,255,255,${opacity})`);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        alphaContext.fillStyle = gradient;
        alphaContext.fillRect(point.x - RADIUS, point.y - RADIUS, RADIUS * 2, RADIUS * 2);
    });

    const greyCanvas = document.createElement("canvas");
    greyCanvas.width = CANVAS_SIZE;
    greyCanvas.height = CANVAS_SIZE;
    const greyContext = greyCanvas.getContext("2d");
    if (!greyContext) {
        throw new Error("Canvas 2D context is unavailable");
    }
    greyContext.putImageData(alphaContext.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE), 0, 0);

    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = CANVAS_SIZE;
    colorCanvas.height = CANVAS_SIZE;
    const colorContext = colorCanvas.getContext("2d");
    if (!colorContext) {
        throw new Error("Canvas 2D context is unavailable");
    }

    const palette = colorContext.createLinearGradient(0, 0, 256, 0);
    Object.entries(getHeatmapGradientStops()).forEach(([offset, color]) => {
        palette.addColorStop(Number(offset), color);
    });
    colorContext.fillStyle = palette;
    colorContext.fillRect(0, 0, 256, 1);

    const palettePixels = colorContext.getImageData(0, 0, 256, 1).data;
    const image = alphaContext.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (let index = 0; index < image.data.length; index += 4) {
        const alpha = image.data[index + 3];
        if (alpha === 0) {
            continue;
        }

        const paletteIndex = alpha * 4;
        image.data[index] = palettePixels[paletteIndex];
        image.data[index + 1] = palettePixels[paletteIndex + 1];
        image.data[index + 2] = palettePixels[paletteIndex + 2];
    }

    colorContext.putImageData(image, 0, 0);

    return {
        heatTexture: createTextureFromCanvas(colorCanvas),
        greyTexture: createTextureFromCanvas(greyCanvas),
    };
}

export default function PovertyCommandHeatmapLayer({
    bbox,
    points,
    visible,
    zOffset = 7.2,
}: {
    bbox: Box2;
    points: CommandMapHeatmapPoint[];
    visible: boolean;
    zOffset?: number;
}) {
    const meshRef = useRef<Mesh<PlaneGeometry, ShaderMaterial>>(null);
    const texturesRef = useRef<{ heatTexture: CanvasTexture | null; greyTexture: CanvasTexture | null }>({
        heatTexture: null,
        greyTexture: null,
    });
    const uniforms = useMemo(
        () => ({
            heatMap: { value: null },
            greyMap: { value: null },
            z_scale: { value: 3.8 },
            u_color: { value: new Color("#ffffff") },
            u_opacity: { value: 0.96 },
        }),
        []
    );
    const layout = useMemo(
        () => buildHeatmapCanvasData({
            bbox,
            canvasSize: CANVAS_SIZE,
            points,
        }),
        [bbox, points]
    );

    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh || layout.points.length === 0) {
            return;
        }

        texturesRef.current.heatTexture?.dispose();
        texturesRef.current.greyTexture?.dispose();

        const nextTextures = buildHeatTextures(layout.points, layout.max);
        texturesRef.current = nextTextures;
        mesh.material.uniforms.heatMap.value = nextTextures.heatTexture;
        mesh.material.uniforms.greyMap.value = nextTextures.greyTexture;
        mesh.material.needsUpdate = true;

        return () => {
            nextTextures.heatTexture.dispose();
            nextTextures.greyTexture.dispose();
            texturesRef.current = { heatTexture: null, greyTexture: null };
        };
    }, [layout]);

    useEffect(() => () => {
        texturesRef.current.heatTexture?.dispose();
        texturesRef.current.greyTexture?.dispose();
    }, []);

    const width = Math.max(1, bbox.max.x - bbox.min.x);
    const height = Math.max(1, bbox.max.y - bbox.min.y);
    const centerX = (bbox.min.x + bbox.max.x) / 2;
    const centerY = (bbox.min.y + bbox.max.y) / 2;

    return (
        <group visible={visible && points.length > 0}>
            <mesh ref={meshRef} position={[centerX, centerY, zOffset]} renderOrder={11}>
                <planeGeometry args={[width, height, 300, 300]} />
                <shaderMaterial
                    transparent
                    side={DoubleSide}
                    depthWrite={false}
                    uniforms={uniforms}
                    vertexShader={`
                        varying vec2 vUv;
                        uniform float z_scale;
                        uniform sampler2D greyMap;

                        void main() {
                            vUv = uv;
                            vec4 frgColor = texture2D(greyMap, uv);
                            float height = z_scale * frgColor.a;
                            vec3 transformed = vec3(position.x, position.y, position.z + height);
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
                        }
                    `}
                    fragmentShader={`
                        #ifdef GL_ES
                        precision highp float;
                        #endif

                        varying vec2 vUv;
                        uniform sampler2D heatMap;
                        uniform vec3 u_color;
                        uniform float u_opacity;

                        void main() {
                            gl_FragColor = vec4(u_color, u_opacity) * texture2D(heatMap, vUv);
                        }
                    `}
                />
            </mesh>
        </group>
    );
}
