import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { KINDS, STATUSES } from "./inquiries.server";

/**
 * Drift guard: docs/openapi.yaml must describe exactly the API the code serves.
 * If you add, rename or remove an endpoint or enum value, this test fails until the spec is updated.
 */
const spec = parse(readFileSync("docs/openapi.yaml", "utf8")) as {
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, { enum?: string[] }> };
};

function implementedRoutes(): Set<string> {
  const dir = "src/routes";
  const found = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.startsWith("api.v1.") && f.endsWith(".ts"))) {
    const src = readFileSync(join(dir, file), "utf8");
    const path = /createFileRoute\("\/api\/v1([^"]*)"\)/.exec(src)?.[1];
    if (!path || path === "/csp-report") continue; // browser-internal, intentionally undocumented
    for (const m of src.matchAll(/^\s+(GET|POST|PATCH|DELETE|PUT):/gm)) {
      found.add(`${m[1]!.toLowerCase()} ${path.replace(/\$(\w+)/g, "{$1}")}`);
    }
  }
  return found;
}

describe("OpenAPI spec matches the implementation", () => {
  const documented = new Set(
    Object.entries(spec.paths).flatMap(([path, ops]) =>
      Object.keys(ops)
        .filter((k) => ["get", "post", "patch", "delete", "put"].includes(k))
        .map((method) => `${method} ${path}`),
    ),
  );

  it("documents every implemented endpoint and nothing that does not exist", () => {
    const implemented = implementedRoutes();
    expect(implemented.size).toBeGreaterThanOrEqual(8);
    expect([...documented].sort()).toEqual([...implemented].sort());
  });

  it("uses the same enum values as the code", () => {
    expect(spec.components.schemas["InquiryKind"]!.enum).toEqual([...KINDS]);
    expect(spec.components.schemas["InquiryStatus"]!.enum).toEqual([...STATUSES]);
  });

  it("lists exactly the error codes the server can return", () => {
    const http = readFileSync("src/server/http.server.ts", "utf8");
    const block = /const STATUS: Record<ErrorCode, number> = \{([\s\S]*?)\};/.exec(http)![1]!;
    const codes = [...block.matchAll(/^\s+([A-Z_]+):/gm)].map((m) => m[1]!);
    expect([...spec.components.schemas["ErrorCode"]!.enum!].sort()).toEqual(codes.sort());
  });
});
