import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHeader } from "@/components/SiteLayout";
import { CtaButtons } from "./index";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Partners & Collaborators — EPMA" },
      {
        name: "description",
        content:
          "EPMA's collaborative ecosystem of institutions, universities and peacebuilding coalitions.",
      },
      { property: "og:title", content: "EPMA Partners & Collaborators" },
      { property: "og:description", content: "Our collaborative stakeholder network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Partners,
});

const groups = [
  {
    title: "Institutional & Regulatory Bodies",
    items: ["Authority for Civil Society Organizations (ACSO)", "Ministry of Peace (MoP)"],
    tone: "border-primary",
  },
  {
    title: "Academic & Youth Partners",
    items: [
      "Ethiopian Public Universities (Nationwide)",
      "Student Peace Committees & Youth Peace Councils",
    ],
    tone: "border-secondary",
  },
  {
    title: "Peacebuilding Coalitions",
    items: ["Local & Regional CSOs", "Women, Peace & Security Networks"],
    tone: "border-accent",
  },
];

export function PartnersGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {groups.map((g) => (
        <div key={g.title} className={`rounded-xl border-t-4 ${g.tone} bg-card p-6 shadow-sm`}>
          <h3 className="text-lg font-semibold text-primary">{g.title}</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {g.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Partners() {
  return (
    <SiteLayout>
      <PageHeader title="Partners & Collaborators" subtitle="Our Collaborative Ecosystem" />
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-16">
        <PartnersGrid />
        <CtaButtons />
      </div>
    </SiteLayout>
  );
}
