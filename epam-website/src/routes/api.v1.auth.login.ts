import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/api/v1/auth/login")({
  server: {
    handlers: {
      POST: async (ctx) => (await load()).login(ctx),
      OPTIONS: async (ctx) => (await load()).login(ctx),
    },
  },
});
