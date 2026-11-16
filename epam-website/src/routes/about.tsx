import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHeader } from "@/components/SiteLayout";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us & Our History — EPMA" },
      {
        name: "description",
        content:
          "History, vision, mission, governance and methodology of the Ethiopian Peace Mother Association.",
      },
      { property: "og:title", content: "About the Ethiopian Peace Mother Association" },
      {
        property: "og:description",
        content: "Founded by 21 women representing all regions of Ethiopia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

const activities = [
  "Utilizing indigenous dialogue circles led by mother figures to defuse ethnic tensions on campus.",
  "Facilitating structured cross-cultural dialogue workshops to enhance student social cohesion.",
  "Providing mentorship and psychological support for students during times of unrest.",
  "Cross-Regional Women-Led Reconciliation.",
  "Facilitating inter-regional peace forums bringing together mothers from conflict-affected zones using traditional mediation practices.",
  "Building regional peace networks to act as early-warning systems for community disputes.",
  "Peace Education & Community Advocacy.",
  "Conducting community-level peace awareness campaigns centered on indigenous conflict resolution.",
  "Advocating for women's inclusion at high-level peace and policy discussions.",
];

function About() {
  return (
    <SiteLayout>
      <PageHeader title="About Us & Our History" />
      <div className="mx-auto max-w-4xl space-y-16 px-4 py-16">
        <section>
          <p className="text-lg">
            Ethiopian Peace Mother Association (EPMA) is a legally registered civil society
            organization under the Authority for Civil Society Organizations (ACSO). Established by
            21 visionary women founders representing all regions of Ethiopia, EPMA was born out of
            an urgent imperative: to leverage the moral authority and indigenous wisdom of mothers
            to de-escalate violent conflict.
          </p>
          <p className="mt-6 font-semibold text-primary">
            Since 2021, EPMA has engaged in direct, high-stakes peace interventions:
          </p>
          <ul className="mt-4 space-y-3">
            <li>
              <b>Pre-Conflict Mediation in Tigray:</b> Facilitating high-level peace dialogues and
              mediation attempts between local leadership (TPLF) and central government authorities
              prior to the escalation of major conflict.
            </li>
            <li>
              <b>Active Conflict Mitigation:</b> Conducting grassroots mediation and peace calls in
              volatile zones across Amhara, Oromia, Benishangul-Gumuz, and Gambella.
            </li>
            <li>
              <b>Nationwide Campus Mobilization:</b> Carrying out peace calls across all Ethiopian
              universities since 2021 to prevent ethnic friction among students.
            </li>
          </ul>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl bg-primary p-8 text-primary-foreground">
            <h2 className="text-2xl font-semibold">Vision</h2>
            <p className="mt-3 opacity-90">
              "A peaceful, reconciled, and unified Ethiopia where women lead indigenous conflict
              resolution, restore broken social cohesion, and guide future generations away from
              violence."
            </p>
          </div>
          <div className="rounded-xl bg-secondary p-8 text-secondary-foreground">
            <h2 className="text-2xl font-semibold">Mission</h2>
            <p className="mt-3">
              "To mobilize Ethiopian mothers across all regions—leveraging indigenous knowledge and
              maternal authority—to mediate active conflicts, restore community social cohesion in
              volatile zones (including Tigray, Amhara, Oromia, Benishangul-Gumuz, and Gambella),
              and conduct university peace calls nationwide."
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-semibold text-primary">Key Activities</h2>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {activities.map((a) => (
              <li key={a} className="rounded-lg border-l-4 border-accent bg-card p-4 shadow-sm">
                {a}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-3xl font-semibold text-primary">Leadership & Governance</h2>
          <ul className="mt-6 space-y-3">
            <li>
              <b>Board-Led Governance:</b> Strategically directed by a dedicated Board composed of
              founder members representing the rich diversity of Ethiopia.
            </li>
            <li>
              <b>Core Team:</b> Comprising 35 dedicated women professionals, peace advocates, and
              community leaders.
            </li>
            <li>
              <b>Compliance:</b> Fully compliant with national CSO guidelines under ACSO
              registration.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-3xl font-semibold text-primary">Strategic Focus & Methodology</h2>
          <p className="mt-4">
            EPMA's interventions rely on a twin-pillar approach tailored to Ethiopia's complex
            social landscape:
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl bg-muted p-6">
              <h3 className="text-xl font-semibold text-secondary">Indigenous Knowledge Systems</h3>
              <p className="mt-2">
                Harnessing traditional mediation practices, maternal moral authority, customary
                conflict resolution mechanisms, and intergenerational wisdom to address local
                grievances and prevent escalation.
              </p>
            </div>
            <div className="rounded-xl bg-muted p-6">
              <h3 className="text-xl font-semibold text-accent">
                Social Cohesion & University Peace Dialogues
              </h3>
              <p className="mt-2">
                Rebuilding trust, mutual understanding, and shared national identity among
                university youth and local communities in key conflict-sensitive regions—including
                Tigray, Amhara, Oromia, Benishangul-Gumuz, and beyond.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-8">
          <h2 className="text-3xl font-semibold text-primary">
            🌿 Rooted in Customary Wisdom & Social Restoration
          </h2>
          <p className="mt-4">
            EPMA operates on the belief that enduring peace comes from within communities. By
            combining indigenous Ethiopian mediation practices with modern approaches to social
            cohesion, EPMA serves as an impartial, trusted bridge between opposing factions.
          </p>
          <ul className="mt-4 space-y-3">
            <li>
              <b>Maternal Moral Authority & Indigenous Mediation:</b> Utilizing the respected social
              standing of mother figures to enter conflict zones, facilitate dialogue, and calm
              escalating violence where formal politics stall.
            </li>
            <li>
              <b>Rebuilding Social Cohesion:</b> Restoring broken inter-ethnic bonds, empathy, and
              community trust in war-impacted areas.
            </li>
          </ul>
        </section>
      </div>
    </SiteLayout>
  );
}
