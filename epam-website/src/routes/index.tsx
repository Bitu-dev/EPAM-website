import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Scale, Quote, Heart, Lightbulb, Target, Eye, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import hero from "@/assets/mothers-group.jpg";
import { SiteLayout } from "@/components/SiteLayout";
import { useSiteStore } from "@/lib/site-store";
import { PartnersGrid } from "./partners";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EPMA — Mothers Uniting Ethiopia for Sustainable Peace" },
      {
        name: "description",
        content:
          "Ethiopian Peace Mother Association empowers women across all regions to lead peace dialogues and national reconciliation.",
      },
      { property: "og:title", content: "Ethiopian Peace Mother Association" },
      { property: "og:description", content: "Mothers uniting Ethiopia for sustainable peace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

export function CtaButtons() {
  const setKind = useSiteStore((s) => s.setInquiryKind);
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Button asChild size="lg" variant="secondary" className="rounded-full">
        <Link to="/contact" onClick={() => setKind("support")}>
          ⭐ Support Our Frontline Mediation
        </Link>
      </Button>
      <Button
        asChild
        size="lg"
        className="rounded-full bg-accent text-accent-foreground hover:bg-accent-hover"
      >
        <Link to="/contact" onClick={() => setKind("partner")}>
          ⭐ Partner With Us
        </Link>
      </Button>
      <Button
        asChild
        size="lg"
        variant="outline"
        className="rounded-full border-primary text-primary"
      >
        <Link to="/impact">⭐ Read Our 2021–2026 Track Record</Link>
      </Button>
    </div>
  );
}

const values = [
  [
    Scale,
    "Maternal Neutrality",
    "Operating as an impartial bridge between opposing political and regional factions.",
  ],
  [
    Quote,
    "Indigenous Mediation",
    "Grounding peace interventions in customary conflict-resolution wisdom and traditional dialogue.",
  ],
  [
    Heart,
    "Social Cohesion",
    "Restoring inter-ethnic trust, mutual empathy, and community unity across conflict divides.",
  ],
  [
    Lightbulb,
    "Nationwide Unity",
    "Maintaining 100% regional representation from founding mothers and core members.",
  ],
] as const;

function Index() {
  return (
    <SiteLayout>
      <section className="relative overflow-hidden bg-card">
        <svg
          className="pointer-events-none absolute right-0 top-0 h-40 w-2/3 text-secondary"
          viewBox="0 0 600 120"
          fill="none"
          preserveAspectRatio="none"
        >
          <path d="M0 110 C 200 10, 420 0, 600 30" stroke="currentColor" strokeWidth="4" />
        </svg>
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pt-12 lg:grid-cols-2 lg:pt-16">
          <div className="relative z-10 pb-12">
            <h1 className="text-5xl font-bold leading-[1.05] md:text-6xl">
              <span className="text-primary">Mothers Uniting</span>
              <br />
              <span className="text-secondary">Ethiopia for</span>
              <br />
              <span className="text-accent">Sustainable Peace.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-primary">
              Empowering women across all regions to lead peace dialogues, foster national
              reconciliation, and build harmonious university communities.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/about">
                  Learn More <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-primary text-primary"
              >
                <Link to="/impact">Our Impact</Link>
              </Button>
            </div>
            <Leaf className="mt-10 h-16 w-16 -rotate-45 text-accent" strokeWidth={1.2} />
          </div>
          <img
            src={hero}
            alt="Ethiopian peace mothers together"
            width={1280}
            height={960}
            className="hero-photo-mask h-full max-h-[560px] w-full object-cover"
          />
        </div>
      </section>

      <section className="bg-muted px-4 py-20">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <div className="rounded-xl bg-card p-8 shadow-md">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Eye size={20} />
            </span>
            <h2 className="mt-4 text-xl font-bold text-primary">Our Vision</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              A peaceful, reconciled, and unified Ethiopia where women lead indigenous conflict
              resolution, restore broken social cohesion, and guide future generations away from
              violence.
            </p>
          </div>
          <div className="rounded-xl bg-card p-8 shadow-md">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/15 text-secondary">
              <Target size={20} />
            </span>
            <h2 className="mt-4 text-xl font-bold text-primary">Our Mission</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              To mobilize Ethiopian mothers across all regions—leveraging indigenous knowledge and
              maternal authority—to mediate active conflicts, restore community social cohesion in
              volatile zones (including Tigray, Amhara, Oromia, Benishangul-Gumuz, and Gambella),
              and conduct university peace calls nationwide.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-primary">Our Core Values</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            The principles that guide our peacebuilding initiatives, mediation activities, and
            community engagement
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(([Icon, t, d]) => (
              <div key={t} className="rounded-xl border-t-4 border-accent bg-card p-6 shadow-sm">
                <Icon size={18} className="text-primary" />
                <h3 className="mt-3 font-sans text-base font-bold text-primary">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 rounded-xl bg-secondary px-6 py-8 text-center text-secondary-foreground">
            <h2 className="font-sans text-2xl font-bold">Peace Begins with Dialogue</h2>
            <p className="mt-2 text-sm">
              Empowering mothers and communities to build a more peaceful, reconciled, and united
              Ethiopia
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-primary">Our Collaborative Ecosystem</h2>
        <div className="mt-10">
          <PartnersGrid />
        </div>
        <div className="mt-12">
          <CtaButtons />
        </div>
      </section>
    </SiteLayout>
  );
}
