import { Box2 } from "three";

import type { CommandMapHeatmapPoint } from "./PovertyCommandMap.utils";

export const getHeatmapGradientStops = () => ({
    0.2: "#fde68a",
    0.4: "#fb923c",
    0.65: "#f97316",
    0.85: "#ef4444",
    1: "#be123c",
});

export const buildHeatmapCanvasData = (input: {
    bbox: Box2;
    canvasSize: number;
    points: CommandMapHeatmapPoint[];
}) => {
    const width = Math.max(1, input.bbox.max.x - input.bbox.min.x);
    const height = Math.max(1, input.bbox.max.y - input.bbox.min.y);
    const size = Math.max(1, input.canvasSize);
    const cells = new Map<string, { x: number; y: number; value: number }>();

    input.points.forEach((point) => {
        const x = Math.round(((point.x - input.bbox.min.x) / width) * size);
        const y = Math.round(size - (((point.y - input.bbox.min.y) / height) * size));
        const key = `${x}:${y}`;
        const current = cells.get(key);

        if (current) {
            current.value += point.value;
            return;
        }

        cells.set(key, { x, y, value: point.value });
    });

    const mapped = [...cells.values()];

    return {
        points: mapped,
        max: Math.max(1, ...mapped.map((point) => point.value)),
    };
};
