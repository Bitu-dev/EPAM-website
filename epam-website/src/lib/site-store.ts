import { create } from "zustand";

export type InquiryKind = "contact" | "partner" | "support";

interface SiteState {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  inquiryKind: InquiryKind;
  setInquiryKind: (kind: InquiryKind) => void;
}

export const useSiteStore = create<SiteState>((set) => ({
  menuOpen: false,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  inquiryKind: "contact",
  setInquiryKind: (inquiryKind) => set({ inquiryKind }),
}));
