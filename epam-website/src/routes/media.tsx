import { createFileRoute } from "@tanstack/react-router";
import { FileText, Download } from "lucide-react";
import { SiteLayout, PageHeader } from "@/components/SiteLayout";
import photo from "@/assets/mothers-group.jpg";
import logo from "@/assets/epma_logo.jpg.asset.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/media")({
  head: () => ({
    meta: [
      { title: "Resource & Media Center — EPMA" },
      {
        name: "description",
        content:
          "Press releases, peace calls, photo and video gallery and downloadable profile of EPMA.",
      },
      { property: "og:title", content: "EPMA Resource & Media Center" },
      { property: "og:description", content: "Peace calls, gallery and donor factsheet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Media,
});

function Media() {
  return (
    <SiteLayout>
      <PageHeader title="Resource & Media Center" />
      <div className="mx-auto max-w-5xl space-y-16 px-4 py-16">
        <section>
          <h2 className="text-3xl font-semibold text-primary">Photo & Video Gallery</h2>
          <p className="mt-2 text-muted-foreground">
            Visual evidence of mother-led peace circles, regional dialogues, and university forums.
          </p>
          <img
            src={photo}
            alt="Mother-led peace circle"
            loading="lazy"
            width={1280}
            height={960}
            className="mt-6 w-full rounded-xl shadow-xl"
          />
        </section>
        <section>
          <h2 className="text-3xl font-semibold text-primary">Press Releases & Peace Calls</h2>
          <p className="mt-2 text-muted-foreground">
            Written public statements, joint peace calls, and mediation summaries released since
            2021.
          </p>
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card p-6">
            <FileText className="text-secondary" /> Statements will be published here.
          </div>
        </section>
        <section className="flex flex-col items-center gap-4 rounded-xl bg-muted p-8 text-center">
          <img src={logo.url} alt="" className="h-20 w-20 rounded-full" />
          <h2 className="text-2xl font-semibold text-primary">Downloadable Profile</h2>
          <p className="text-muted-foreground">A 1-page factsheet for visiting donors.</p>
          <Button onClick={() => window.print()} variant="secondary">
            <Download /> Download / Print Profile
          </Button>
        </section>
      </div>
    </SiteLayout>
  );
}
