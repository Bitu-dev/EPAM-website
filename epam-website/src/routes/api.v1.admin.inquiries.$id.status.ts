import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/api/v1/admin/inquiries/$id/status")({
  server: {
    handlers: {
      PATCH: async (ctx) => (await load()).adminSetStatus(ctx),
      OPTIONS: async (ctx) => (await load()).adminSetStatus(ctx),
    },
  },
});
