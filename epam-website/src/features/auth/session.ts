import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/api/auth-store";
import { apiRequest, refreshSession } from "@/lib/api/http";
import { authResponseSchema, type LoginInput } from "@/lib/api/types";
import { z } from "zod";

/** On first mount, silently restore the session from the httpOnly refresh cookie (if there is one). */
export function useSessionBootstrap() {
  const initialized = useAuthStore((s) => s.initialized);
  useEffect(() => {
    if (!initialized) void refreshSession().then(() => useAuthStore.getState().markInitialized());
  }, [initialized]);
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await apiRequest("/auth/login", authResponseSchema, {
        method: "POST",
        body: input,
        auth: false,
      });
      useAuthStore.getState().setSession(res.accessToken, res.user);
    },
  });
}

export async function logout(): Promise<void> {
  try {
    await apiRequest("/auth/logout", z.unknown(), { method: "POST", auth: false });
  } finally {
    useAuthStore.getState().clear();
  }
}
