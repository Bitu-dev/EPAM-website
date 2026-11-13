import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useAuthStore } from "./auth-store";
import { ApiError, apiRequest } from "./http";

vi.mock("./config", () => ({
  API_BASE_URL: "/api/v1",
  API_ENABLED: true,
  REQUEST_TIMEOUT_MS: 5000,
}));

const user = {
  id: "6f1c8a52-2f5c-4c6f-9a55-1b8c3f6d2a10",
  email: "a@b.org",
  fullName: "A",
  role: "ADMIN",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ok = (data: unknown) => json(200, { success: true, data });
const schema = z.object({ n: z.number() });

describe("apiRequest", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    useAuthStore.setState({ accessToken: "old", user: null, initialized: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns validated data and sends the bearer token", async () => {
    fetchMock.mockResolvedValueOnce(ok({ n: 1 }));
    await expect(apiRequest("/x", schema)).resolves.toEqual({ n: 1 });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer old");
  });

  it("throws a typed ApiError carrying the backend error code", async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, {
        success: false,
        error: { code: "VALIDATION_FAILED", message: "bad", details: [] },
      }),
    );
    await expect(apiRequest("/x", schema)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
    });
  });

  it("rejects a response that violates the contract", async () => {
    fetchMock.mockResolvedValueOnce(ok({ n: "not-a-number" }));
    await expect(apiRequest("/x", schema)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("refreshes once on 401 and retries the original request", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(401, { success: false, error: { code: "UNAUTHENTICATED", message: "no" } }),
      )
      .mockResolvedValueOnce(ok({ accessToken: "new", tokenType: "Bearer", expiresIn: 900, user }))
      .mockResolvedValueOnce(ok({ n: 2 }));

    await expect(apiRequest("/x", schema)).resolves.toEqual({ n: 2 });
    expect(useAuthStore.getState().accessToken).toBe("new");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shares one refresh call between concurrent 401s", async () => {
    const unauth = () =>
      json(401, { success: false, error: { code: "UNAUTHENTICATED", message: "no" } });
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/auth/refresh")) {
        return Promise.resolve(
          ok({ accessToken: "new", tokenType: "Bearer", expiresIn: 900, user }),
        );
      }
      const token = useAuthStore.getState().accessToken;
      return Promise.resolve(token === "new" ? ok({ n: 3 }) : unauth());
    });

    await Promise.all([apiRequest("/a", schema), apiRequest("/b", schema)]);
    const refreshCalls = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("clears the session when refresh fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(401, { success: false, error: { code: "UNAUTHENTICATED", message: "no" } }),
      )
      .mockResolvedValueOnce(
        json(401, { success: false, error: { code: "INVALID_REFRESH_TOKEN", message: "no" } }),
      );
    await expect(apiRequest("/x", schema)).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("never retries a failed POST", async () => {
    fetchMock.mockRejectedValue(new TypeError("network down"));
    await expect(apiRequest("/x", schema, { method: "POST", body: {} })).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
