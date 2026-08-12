import { create } from "zustand";

interface MapState {
  center: [number, number];
  zoom: number;
  selectedDataCenterId: string | null;
  activeLayers: string[];
  searchQuery: string;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setSelectedDataCenter: (id: string | null) => void;
  toggleLayer: (layer: string) => void;
  setSearchQuery: (query: string) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [0, 20],
  zoom: 2,
  selectedDataCenterId: null,
  activeLayers: ["data-centers"],
  searchQuery: "",

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setSelectedDataCenter: (id) => set({ selectedDataCenterId: id }),
  toggleLayer: (layer) =>
    set((state) => ({
      activeLayers: state.activeLayers.includes(layer)
        ? state.activeLayers.filter((l) => l !== layer)
        : [...state.activeLayers, layer],
    })),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
