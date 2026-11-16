import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as contactRoute } from "@/routes/contact";

const toastError = vi.fn();
vi.mock("sonner", async (orig) => ({
  ...(await orig<typeof import("sonner")>()),
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}));

const envelope = (data: unknown, status = 201) =>
  new Response(
    JSON.stringify({ success: true, data, requestId: "r1", timestamp: new Date().toISOString() }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
const errorEnvelope = (code: string, status: number) =>
  new Response(
    JSON.stringify({
      success: false,
      error: { code, message: "nope" },
      requestId: "r1",
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );

// The real contact page component, mounted in a minimal router. (The full app shell waits on stylesheets
// that jsdom never loads, so it cannot render here; the form logic and API client are the parts under test.)
async function openContactPage() {
  const component = contactRoute.options.component;
  if (!component) throw new Error("the contact route has no component");
  const root = createRootRoute({ component: Outlet });
  const page = createRoute({
    getParentRoute: () => root,
    path: "/contact",
    component,
  });
  const router = createRouter({
    routeTree: root.addChildren([page]),
    history: createMemoryHistory({ initialEntries: ["/contact"] }),
  });
  render(<RouterProvider router={router} />);
  return screen.findByPlaceholderText("Full name");
}

function fillForm() {
  fireEvent.change(screen.getByPlaceholderText("Full name"), {
    target: { value: "  Selam Bekele " },
  });
  fireEvent.change(screen.getByPlaceholderText("Email"), {
    target: { value: "selam@example.org" },
  });
  fireEvent.change(screen.getByPlaceholderText("Your message"), {
    target: { value: "We would like to help." },
  });
}

describe("contact form → API (integration)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    toastError.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("posts the trimmed form as JSON to /api/v1/inquiries and shows the thank-you message", async () => {
    fetchMock.mockResolvedValue(
      envelope({
        id: "6f9619ff-8b86-4d11-b42d-00c04fc964ff",
        receivedAt: new Date().toISOString(),
      }),
    );
    await openContactPage();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/api/v1/inquiries");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      kind: "contact",
      name: "Selam Bekele",
      email: "selam@example.org",
      organization: null,
      message: "We would like to help.",
    });
  });

  it("sends the inquiry type chosen by the visitor", async () => {
    fetchMock.mockResolvedValue(
      envelope({
        id: "6f9619ff-8b86-4d11-b42d-00c04fc964ff",
        receivedAt: new Date().toISOString(),
      }),
    );
    await openContactPage();
    fireEvent.click(screen.getByRole("button", { name: "Partner with us" }));
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await screen.findByText("Thank you!");
    expect(
      JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)).kind,
    ).toBe("partner");
  });

  it("keeps the form and tells the visitor when the server rejects the message (e.g. rate limit)", async () => {
    fetchMock.mockResolvedValue(errorEnvelope("RATE_LIMITED", 429));
    await openContactPage();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.queryByText("Thank you!")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Full name")).toHaveValue("  Selam Bekele ");
    expect(screen.getByRole("button", { name: /send message/i })).toBeEnabled();
  });

  it("keeps the form when the network is down", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await openContactPage();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.queryByText("Thank you!")).not.toBeInTheDocument();
  });

  it("disables the button while sending so a double click cannot submit twice", async () => {
    let release!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (release = r)));
    await openContactPage();
    fillForm();
    const button = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /sending/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release(
      envelope({
        id: "6f9619ff-8b86-4d11-b42d-00c04fc964ff",
        receivedAt: new Date().toISOString(),
      }),
    );
    await screen.findByText("Thank you!");
  });
});
