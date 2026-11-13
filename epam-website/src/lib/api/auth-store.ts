import { create } from "zustand";
import type { User } from "./types";

/**
 * The access token lives in memory only (never localStorage), so an XSS payload cannot exfiltrate a
 * long-lived credential. The refresh token is an httpOnly cookie that JavaScript cannot read at all.
 */
interface AuthState {
  accessToken: string | null;
  user: User | null;
  /** True once the first silent refresh attempt has finished, so the UI doesn't flash the login form. */
  initialized: boolean;
  setSession: (accessToken: string, user: User) => void;
  clear: () => void;
  markInitialized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  initialized: false,
  setSession: (accessToken, user) => set({ accessToken, user, initialized: true }),
  clear: () => set({ accessToken: null, user: null, initialized: true }),
  markInitialized: () => set({ initialized: true }),
}));
