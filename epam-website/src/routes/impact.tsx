import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHeader } from "@/components/SiteLayout";
import { CtaButtons } from "./index";

export const Route = createFileRoute("/impact")({
  head: () => ({
    meta: [
      { title: "Impact & Interventions 2021–2026 — EPMA" },
      {
        name: "description",
        content:
          "Timeline of EPMA peace interventions: Tigray mediation, conflict-zone response and university peace calls.",
      },
      { property: "og:title", content: "EPMA Impact & Interventions" },
      { property: "og:description", content: "Our 2021–2026 peace track record." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Impact,
});

const timeline = [
  {
    year: "2021",
    title: "Pre-Conflict Mediation",
    text: "Documenting pre-clash peace dialogues in Tigray between TPLF and central government representatives.",
  },
  {
    year: "Ongoing",
    title: "Active Conflict Area Response",
    text: "Frontline peace calls in Amhara, Oromia, Benishangul-Gumuz, and Gambella.",
  },
  {
    year: "2021 – Today",
    title: "University Peace Calls",
    text: "Campus engagement across public universities since 2021.",
  },
];

function Impact() {
  return (
    <SiteLayout>
      <PageHeader
        title="Impact & Interventions"
        subtitle="Our historical peace interventions, 2021–2026."
      />
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ol className="relative border-l-4 border-secondary">
          {timeline.map((t) => (
            <li key={t.title} className="mb-12 ml-8">
              <span className="absolute -left-3 mt-1 h-5 w-5 rounded-full bg-accent ring-4 ring-background" />
              <p className="text-sm font-bold uppercase tracking-wider text-secondary">{t.year}</p>
              <h2 className="mt-1 text-2xl font-semibold text-primary">{t.title}</h2>
              <p className="mt-2 text-muted-foreground">{t.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <CtaButtons />
        </div>
      </div>
    </SiteLayout>
  );
}
