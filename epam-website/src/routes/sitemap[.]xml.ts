import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async (ctx) => (await load()).sitemap(ctx),
    },
  },
});
