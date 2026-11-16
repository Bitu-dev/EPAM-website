import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/api/v1/auth/me")({
  server: {
    handlers: {
      GET: async (ctx) => (await load()).me(ctx),
      OPTIONS: async (ctx) => (await load()).me(ctx),
    },
  },
});
