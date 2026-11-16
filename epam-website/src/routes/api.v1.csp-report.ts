import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/api/v1/csp-report")({
  server: {
    handlers: {
      POST: async (ctx) => (await load()).cspReport(ctx),
    },
  },
});
