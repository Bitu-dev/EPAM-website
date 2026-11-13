import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Accessibility guard (WCAG 2.x AA): reads the real colour tokens from src/styles.css and checks that every
 * text/background pair the site uses is readable. If someone changes a brand colour and breaks readability,
 * this fails with the exact pair and ratio.
 */
const css = readFileSync("src/styles.css", "utf8");

function tokens(block: "root" | "dark"): Record<string, string> {
  const out: Record<string, string> = {};
  // every :root { } block (the file has more than one), or the .dark block
  const re = block === "root" ? /:root\s*\{([^}]*)\}/g : /\.dark\s*\{([^}]*)\}/g;
  for (const m of css.matchAll(re)) {
    for (const d of m[1]!.matchAll(/--([a-z-]+):\s*(oklch\([^)]*\))/g)) out[d[1]!] = d[2]!;
  }
  return out;
}

function oklchToLinearSrgb(value: string): [number, number, number] {
  const [L, C, h] = /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value)!.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb: [number, number, number] = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return rgb.map((x) => Math.min(Math.max(x, 0), 1)) as [number, number, number];
}
const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function ratio(fg: string, bg: string): number {
  const x = luminance(oklchToLinearSrgb(fg));
  const y = luminance(oklchToLinearSrgb(bg));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const light = tokens("root");
const AA = 4.5;

// [foreground token, background token, where it is used]
const pairs: [string, string, string][] = [
  ["foreground", "background", "body text"],
  ["primary", "background", "headings and links in primary colour"],
  ["primary-foreground", "primary", "primary buttons"],
  ["muted-foreground", "background", "secondary body text"],
  ["secondary-foreground", "secondary", "orange buttons and banners (white text)"],
  ["secondary-foreground", "secondary-hover", "orange button hover"],
  ["secondary", "background", "orange text on the page"],
  ["secondary", "card", "orange text on cards"],
  ["accent-foreground", "accent", "green buttons and banners (white text)"],
  ["accent-foreground", "accent-hover", "green button hover"],
  ["accent", "background", "green text on the page"],
  ["accent", "card", "green text on cards"],
  ["footer-foreground", "footer", "footer text"],
  ["secondary-on-dark", "footer", "orange labels in the footer"],
];

describe("WCAG AA colour contrast (light theme)", () => {
  it.each(pairs)("%s on %s is at least 4.5:1 (%s)", (fg, bg) => {
    expect(light[fg], `missing token --${fg}`).toBeDefined();
    expect(light[bg], `missing token --${bg}`).toBeDefined();
    expect(ratio(light[fg]!, light[bg]!)).toBeGreaterThanOrEqual(AA);
  });
});
