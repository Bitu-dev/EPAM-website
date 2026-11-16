import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: async (ctx) => (await load()).healthz(ctx),
    },
  },
});
