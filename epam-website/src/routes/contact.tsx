import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SiteLayout, PageHeader } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitInquiry } from "@/lib/api/submit-inquiry";
import { useSiteStore, type InquiryKind } from "@/lib/site-store";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact, Support & Partner With EPMA" },
      {
        name: "description",
        content:
          "Reach the Ethiopian Peace Mother Association in Addis Ababa, support our mediation or become a partner.",
      },
      { property: "og:title", content: "Contact EPMA" },
      {
        property: "og:description",
        content: "Support our frontline mediation or partner with us.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Contact,
});

const kinds: { value: InquiryKind; label: string }[] = [
  { value: "contact", label: "General inquiry" },
  { value: "support", label: "Support our mediation" },
  { value: "partner", label: "Partner with us" },
];

function Contact() {
  const { inquiryKind, setInquiryKind } = useSiteStore();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSending(true);
    try {
      await submitInquiry({
        kind: inquiryKind,
        name: String(f.get("name")).trim(),
        email: String(f.get("email")).trim(),
        organization: String(f.get("organization") || "").trim() || null,
        message: String(f.get("message")).trim(),
      });
    } catch {
      setSending(false);
      toast.error("Could not send your message. Please try again.");
      return;
    }
    setSending(false);
    setSent(true);
  }

  return (
    <SiteLayout>
      <PageHeader
        title="Get in Touch"
        subtitle="Support our frontline mediation, partner with us, or send a general inquiry."
      />
      <div className="mx-auto max-w-2xl px-4 py-16">
        {sent ? (
          <div className="rounded-xl bg-accent p-8 text-center text-accent-foreground">
            <h2 className="text-2xl font-semibold">Thank you!</h2>
            <p className="mt-2">Your message has been received. Our team will reach out soon.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-card p-6 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {kinds.map((k) => (
                <Button
                  key={k.value}
                  type="button"
                  variant={inquiryKind === k.value ? "default" : "outline"}
                  onClick={() => setInquiryKind(k.value)}
                >
                  {k.label}
                </Button>
              ))}
            </div>
            <Input name="name" placeholder="Full name" required maxLength={120} />
            <Input name="email" type="email" placeholder="Email" required maxLength={255} />
            <Input name="organization" placeholder="Organization (optional)" maxLength={200} />
            <Textarea
              name="message"
              placeholder="Your message"
              required
              maxLength={3000}
              rows={6}
            />
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              disabled={sending}
              className="w-full"
            >
              {sending ? "Sending…" : "Send message"}
            </Button>
          </form>
        )}
      </div>
    </SiteLayout>
  );
}
