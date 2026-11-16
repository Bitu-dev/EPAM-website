import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.server";
import { resolveClientIp } from "./http.server";
import { sanitizeText, submitSchema, listQuerySchema } from "./inquiries.server";
import { hashPassword, verifyPassword } from "./password.server";
import { sha256Hex } from "./tokens.server";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  JWT_SECRET: Buffer.alloc(48, 7).toString("base64"),
};

describe("env validation", () => {
  it("accepts a minimal valid environment and applies safe defaults", () => {
    const env = parseEnv({ ...base, NODE_ENV: "production" });
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.TRUSTED_PROXY_HOPS).toBe(0);
    expect(env.notificationsEnabled).toBe(false);
  });
  it("treats empty strings as unset (docker-compose ${VAR:-})", () => {
    expect(parseEnv({ ...base, SMTP_URL: "", NOTIFY_TO: "" }).notificationsEnabled).toBe(false);
  });
  it("rejects a short JWT secret and a non-postgres URL with a readable message", () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
    expect(() => parseEnv({ ...base, DATABASE_URL: "mysql://x/y" })).toThrow(/DATABASE_URL/);
  });
  it("enables notifications only when SMTP and recipients are all set", () => {
    const env = parseEnv({
      ...base,
      SMTP_URL: "smtp://h:25",
      SMTP_FROM: "a@b.org",
      NOTIFY_TO: "x@b.org, y@b.org",
    });
    expect(env.notificationsEnabled).toBe(true);
    expect(env.NOTIFY_TO).toEqual(["x@b.org", "y@b.org"]);
  });
});

describe("client IP resolution", () => {
  it("ignores X-Forwarded-For entirely when no proxy is trusted", () => {
    expect(resolveClientIp("6.6.6.6", "10.0.0.5", 0)).toBe("10.0.0.5");
  });
  it("takes the entry our trusted proxy appended, ignoring anything the client prepended", () => {
    expect(resolveClientIp("6.6.6.6, 7.7.7.7, 203.0.113.9", "10.0.0.5", 1)).toBe("203.0.113.9");
    expect(resolveClientIp("203.0.113.9, 172.16.0.2", "10.0.0.5", 2)).toBe("203.0.113.9");
  });
  it("falls back to the socket for missing or malformed headers", () => {
    expect(resolveClientIp(null, "10.0.0.5", 1)).toBe("10.0.0.5");
    expect(resolveClientIp("<script>", "10.0.0.5", 1)).toBe("10.0.0.5");
    expect(resolveClientIp(null, undefined, 0)).toBe("unknown");
  });
});

describe("input sanitising and validation", () => {
  it("strips control and bidi-override characters but keeps newlines", () => {
    expect(sanitizeText("a\u0000b\u202Ec\r\nd\u200Be")).toBe("abc\nde");
  });
  it("normalises a valid submission", () => {
    const r = submitSchema.parse({
      kind: "partner",
      name: "  A   B ",
      email: " X@Y.ORG ",
      organization: "",
      message: " hi ",
    });
    expect(r).toMatchObject({ name: "A B", email: "x@y.org", organization: null, message: "hi" });
  });
  it("rejects unknown fields, bad emails and oversize text", () => {
    const ok = { kind: "contact", name: "A", email: "a@b.org", message: "m" };
    expect(submitSchema.safeParse({ ...ok, role: "ADMIN" }).success).toBe(false);
    expect(submitSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
    expect(submitSchema.safeParse({ ...ok, message: "x".repeat(3001) }).success).toBe(false);
  });
  it("whitelists sort fields and caps page size", () => {
    expect(listQuerySchema.safeParse({ sort: "password_hash" }).success).toBe(false);
    expect(listQuerySchema.safeParse({ size: "101" }).success).toBe(false);
    expect(listQuerySchema.parse({}).size).toBe(20);
  });
});

describe("passwords and hashing", () => {
  it("verifies the right password and rejects the wrong one; salts differ", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("wrong horse battery!", a)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
  it("sha256 is stable hex", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
