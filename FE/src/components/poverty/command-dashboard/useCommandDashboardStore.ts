import { create } from "zustand";

export type CommandMapBaseLayer = "terrain" | "roadmap" | "satellite";

type CommandDashboardState = {
    cloud: boolean;
    bar: boolean;
    rotation: boolean;
    heat: boolean;
    mode: boolean;
    baseLayer: CommandMapBaseLayer;
    toggle: (key: keyof Omit<CommandDashboardState, "toggle" | "reset">) => void;
    cycleBaseLayer: () => void;
    reset: () => void;
};

const initialState = {
    cloud: true,
    bar: true,
    rotation: true,
    heat: true,
    mode: true,
    baseLayer: "satellite" as CommandMapBaseLayer,
};

const baseLayerOrder: CommandMapBaseLayer[] = ["terrain", "roadmap", "satellite"];

export const useCommandDashboardStore = create<CommandDashboardState>((set) => ({
    ...initialState,
    toggle: (key) => set((state) => ({ [key]: !state[key] })),
    cycleBaseLayer: () => set((state) => {
        const currentIndex = baseLayerOrder.indexOf(state.baseLayer);
        const nextIndex = (currentIndex + 1) % baseLayerOrder.length;
        return { baseLayer: baseLayerOrder[nextIndex] };
    }),
    reset: () => set(initialState),
}));
