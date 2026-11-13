import { Link } from "@tanstack/react-router";
import {
  Menu,
  X,
  Mail,
  MapPin,
  Phone,
  ChevronDown,
  FileText,
  Image,
  Download,
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
} from "lucide-react";
import logo from "@/assets/epma_logo.jpg.asset.json";
import { useSiteStore } from "@/lib/site-store";
import type { ReactNode } from "react";

type Item = { to: "/" | "/about" | "/impact" | "/media" | "/partners" | "/contact"; label: string };
const nav: { label: string; to?: Item["to"]; children?: Item[] }[] = [
  { label: "Home", to: "/" },
  { label: "News", to: "/media" },
  {
    label: "About Us",
    children: [
      { to: "/about", label: "Who We Are" },
      { to: "/about", label: "Our History" },
      { to: "/about", label: "Vision, Mission & Values" },
      { to: "/about", label: "Leadership & Governance" },
    ],
  },
  {
    label: "Our Approach",
    children: [
      { to: "/about", label: "Indigenous Knowledge Systems" },
      { to: "/about", label: "Social Cohesion" },
      { to: "/impact", label: "Impact & Interventions" },
    ],
  },
  {
    label: "Programs",
    children: [
      { to: "/about", label: "University Peace & Social Cohesion" },
      { to: "/about", label: "Women-Led Reconciliation" },
      { to: "/about", label: "Community Peacebuilding" },
      { to: "/about", label: "Peace Education & Advocacy" },
    ],
  },
  {
    label: "Resources",
    children: [
      { to: "/media", label: "Press Releases & Peace Calls" },
      { to: "/media", label: "Photo & Video Gallery" },
      { to: "/partners", label: "Partners" },
      { to: "/contact", label: "Contact" },
    ],
  },
];

export function SiteLayout({ children }: { children: ReactNode }) {
  const { menuOpen, setMenuOpen } = useSiteStore();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-card/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <img src={logo.url} alt="EPMA logo" className="h-14 w-14 rounded-full" />
            <span className="leading-tight">
              <span className="block font-display text-sm font-bold text-primary">
                የኢትዮጵያ የሰላም እናቶች ማህበር
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary">
                Ethiopian Peace Mothers Association
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 lg:flex">
            {nav.map((n) =>
              n.to ? (
                <Link
                  key={n.label}
                  to={n.to}
                  className="text-sm font-medium text-foreground hover:text-primary"
                >
                  {n.label}
                </Link>
              ) : (
                <div key={n.label} className="group relative">
                  <button className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary">
                    {n.label} <ChevronDown size={14} />
                  </button>
                  <div className="invisible absolute left-0 top-full z-50 w-60 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100">
                    <div className="rounded-lg border border-border bg-card p-2 shadow-lg">
                      {n.children!.map((c) => (
                        <Link
                          key={c.label}
                          to={c.to}
                          className="block rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary"
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ),
            )}
          </nav>
          <button
            className="text-primary lg:hidden"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen && (
          <nav className="max-h-[70vh] overflow-y-auto border-t border-border px-4 pb-4 lg:hidden">
            {nav.map((n) => (
              <div key={n.label} className="py-1">
                {n.to ? (
                  <Link
                    to={n.to}
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 font-medium"
                  >
                    {n.label}
                  </Link>
                ) : (
                  <>
                    <p className="py-2 font-semibold text-primary">{n.label}</p>
                    {n.children!.map((c) => (
                      <Link
                        key={c.label}
                        to={c.to}
                        onClick={() => setMenuOpen(false)}
                        className="block py-1.5 pl-4 text-sm text-muted-foreground"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-footer text-footer-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-3">
          <div>
            <h3 className="text-2xl font-semibold">About Us</h3>
            <img src={logo.url} alt="" className="my-3 h-14 w-14 rounded bg-card p-1" />
            <p className="text-sm font-semibold leading-relaxed">
              Ethiopian Peace Mother Association (EPMA) is a legally registered civil society
              organization under the Authority for Civil Society Organizations (ACSO). Established
              by 21 visionary women founders representing all regions of Ethiopia, EPMA was born out
              of an urgent imperative: to leverage the moral authority and indigenous wisdom of
              mothers to de-escalate violent conflict.
            </p>
            <p className="mt-3 text-xs opacity-80">ACSO Registration No.: [To be provided]</p>
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Resources</h3>
            <ul className="mt-4 space-y-4 text-sm">
              {[
                [FileText, "Press Releases & Peace Calls", "Explore Statements →"],
                [Image, "Photo & Video Gallery", "View Gallery →"],
                [Download, "Organization Profile", "Download PDF"],
              ].map(([Icon, t, l]) => {
                const I = Icon as typeof FileText;
                return (
                  <li
                    key={t as string}
                    className="flex gap-3 border-b border-footer-foreground/20 pb-3"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded bg-card text-footer">
                      <I size={16} />
                    </span>
                    <Link to="/media">
                      <p className="font-semibold">{t as string}</p>
                      <p className="text-xs text-secondary-on-dark">{l as string}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Contact Us</h3>
            <ul className="mt-4 space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-card text-footer">
                  <MapPin size={16} />
                </span>
                <div>
                  <p className="font-semibold">Our Location</p>
                  <p className="text-xs opacity-80">Addis Ababa, Ethiopia</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-card text-footer">
                  <Mail size={16} />
                </span>
                <div>
                  <p className="font-semibold">Email Us</p>
                  <p className="text-xs opacity-80">info@ethiopianpeacemothers.org</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-card text-footer">
                  <Phone size={16} />
                </span>
                <div>
                  <p className="font-semibold">Call Us</p>
                  <p className="text-xs opacity-80">+251 [To be provided]</p>
                </div>
              </li>
            </ul>
            <p className="mt-6 border-t border-footer-foreground/20 pt-4 font-semibold">
              Follow Our Work
            </p>
            <div className="mt-3 flex gap-2">
              {[Facebook, Instagram, Youtube, Linkedin].map((I, i) => (
                <span
                  key={i}
                  className="grid h-8 w-8 place-items-center rounded-full bg-card text-footer"
                >
                  <I size={15} />
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="border-t border-footer-foreground/20 py-4 text-center text-xs">
          © {new Date().getFullYear()}{" "}
          <span className="font-semibold text-secondary-on-dark">
            Ethiopian Peace Mother Association (EPMA)
          </span>
          . All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <section className="bg-muted px-4 py-16 text-center">
      <h1 className="text-4xl font-bold text-primary md:text-5xl">{title}</h1>
      {subtitle && <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{subtitle}</p>}
    </section>
  );
}
