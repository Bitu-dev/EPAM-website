import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { InquiriesAdmin } from "@/features/inquiries/InquiriesAdmin";

// Staff-only and client-rendered: the access token lives in browser memory, so there is nothing to render on the server.
export const Route = createFileRoute("/admin/inquiries")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Inquiries — EPMA Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: () => (
    <SiteLayout>
      <InquiriesAdmin />
    </SiteLayout>
  ),
});
