import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async (ctx) => (await load()).robots(ctx),
    },
  },
});
