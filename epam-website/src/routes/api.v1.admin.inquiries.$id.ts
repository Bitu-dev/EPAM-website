import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/api/v1/admin/inquiries/$id")({
  server: {
    handlers: {
      GET: async (ctx) => (await load()).adminGet(ctx),
      DELETE: async (ctx) => (await load()).adminDelete(ctx),
      OPTIONS: async (ctx) => (await load()).adminGet(ctx),
    },
  },
});
