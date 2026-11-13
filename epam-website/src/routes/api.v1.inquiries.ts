import { createFileRoute } from "@tanstack/react-router";

const load = () => import("../server/handlers.server");

export const Route = createFileRoute("/api/v1/inquiries")({
  server: {
    handlers: {
      POST: async (ctx) => (await load()).submitInquiry(ctx),
      OPTIONS: async (ctx) => (await load()).submitInquiry(ctx),
    },
  },
});
