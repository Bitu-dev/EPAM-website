import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/api/v1/admin/inquiries")({
  server: {
    handlers: {
      GET: async (ctx) => (await load()).adminList(ctx),
      OPTIONS: async (ctx) => (await load()).adminList(ctx),
    },
  },
});
