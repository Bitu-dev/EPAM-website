import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/api/v1/auth/logout")({
  server: {
    handlers: {
      POST: async (ctx) => (await load()).logout(ctx),
      OPTIONS: async (ctx) => (await load()).logout(ctx),
    },
  },
});
