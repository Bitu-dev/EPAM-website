import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/readyz")({
  server: {
    handlers: {
      GET: async (ctx) => (await load()).readyz(ctx),
    },
  },
});
