import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RightPanelTab = 'library' | 'properties';
export type BottomPanelTab = 'console' | 'output';

interface LayoutState {
  // Right panel (Library / Properties)
  rightPanelOpen: boolean;
  rightPanelSize: number; // percentage (0-100)
  rightPanelTab: RightPanelTab;

  // Bottom panel (Console / Output)
  bottomPanelOpen: boolean;
  bottomPanelSize: number; // percentage (0-100)
  bottomPanelTab: BottomPanelTab;

  // Command palette
  commandPaletteOpen: boolean;
}

interface LayoutActions {
  // Right panel
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelSize: (size: number) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;

  // Bottom panel
  toggleBottomPanel: () => void;
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelSize: (size: number) => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;

  // Command palette
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
}

const initialState: LayoutState = {
  rightPanelOpen: false,
  rightPanelSize: 25, // 25% of width
  rightPanelTab: 'library',

  bottomPanelOpen: true,
  bottomPanelSize: 30, // 30% of height
  bottomPanelTab: 'console',

  commandPaletteOpen: false,
};

export const useLayoutStore = create<LayoutState & LayoutActions>()(
  persist(
    (set) => ({
      ...initialState,

      // Right panel actions
      toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
      setRightPanelSize: (size) => set({ rightPanelSize: Math.max(15, Math.min(50, size)) }),
      setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightPanelOpen: true }),

      // Bottom panel actions
      toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
      setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
      setBottomPanelSize: (size) => set({ bottomPanelSize: Math.max(15, Math.min(60, size)) }),
      setBottomPanelTab: (tab) => set({ bottomPanelTab: tab, bottomPanelOpen: true }),

      // Command palette actions
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
    }),
    {
      name: 'carf-layout',
      partialize: (state) => ({
        rightPanelOpen: state.rightPanelOpen,
        rightPanelSize: state.rightPanelSize,
        rightPanelTab: state.rightPanelTab,
        bottomPanelOpen: state.bottomPanelOpen,
        bottomPanelSize: state.bottomPanelSize,
        bottomPanelTab: state.bottomPanelTab,
      }),
    }
  )
);
