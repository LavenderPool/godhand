import { create } from "zustand";
import type { McpStatus } from "@/lib/api";

interface AppState {
  status: McpStatus | null;
  setStatus: (s: McpStatus | null) => void;
  lastEvent: { type: string; payload: unknown } | null;
  setLastEvent: (e: { type: string; payload: unknown }) => void;
  skullOverlayOpen: boolean;
  setSkullOverlayOpen: (open: boolean) => void;
  toggleSkullOverlay: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
  lastEvent: null,
  setLastEvent: (lastEvent) => set({ lastEvent }),
  skullOverlayOpen: false,
  setSkullOverlayOpen: (skullOverlayOpen) => set({ skullOverlayOpen }),
  toggleSkullOverlay: () => set((s) => ({ skullOverlayOpen: !s.skullOverlayOpen })),
}));
